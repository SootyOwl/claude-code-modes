#!/usr/bin/env bun
import { join } from "node:path";
import { rmSync } from "node:fs";
import { parseCliArgs } from "./args.js";
import { loadConfig } from "./config.js";
import { resolveConfig } from "./resolve.js";
import { assemblePrompt, writeTempPrompt } from "./assemble.js";
import { detectEnv, buildTemplateVars } from "./env.js";
import { runConfigCommand } from "./config-cli.js";
import { runInspectCommand } from "./inspect.js";

function printUsage(): void {
  const usage = `Usage: claude-mode [preset] [options] [-- claude-args...]

Subcommands:
  config            Manage configuration
  inspect [--print] Show prompt assembly plan with provenance and warnings

Presets:
  create          autonomous / architect / unrestricted
  extend          autonomous / pragmatic / adjacent
  safe            collaborative / minimal / narrow
  refactor        autonomous / pragmatic / unrestricted
  explore         collaborative / architect / narrow (readonly)
  none            no behavioral instructions

Base:
  --base <name|path>      Built-in: standard, chill
  Base can also be a config-defined name or a directory path.

Axis overrides:
  --agency <value>        Built-in: autonomous, collaborative, surgical
  --quality <value>       Built-in: architect, pragmatic, minimal
  --scope <value>         Built-in: unrestricted, adjacent, narrow
  Axis values can also be config-defined names or file paths (.md files).

Modifiers:
  --readonly              Prevent file modifications
  --context-pacing        Include context pacing prompt
  --modifier <name|path>  Add a custom modifier (repeatable)
  --print                 Print assembled prompt instead of launching claude

Forwarded to claude:
  --append-system-prompt <text>
  --append-system-prompt-file <path>

Config: .claude-mode.json (project) or ~/.config/claude-mode/config.json (global)

Everything after -- is passed to claude verbatim.

Examples:
  claude-mode create
  claude-mode create --quality pragmatic
  claude-mode create --modifier ./my-rules.md
  claude-mode --agency autonomous --quality ./team-quality.md
  claude-mode team-default                    # custom preset from config
  claude-mode explore --print
  claude-mode create -- --verbose --model sonnet`;

  process.stdout.write(usage + "\n");
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);

  // No args or --help: show usage
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    printUsage();
    process.exit(0);
  }

  // Prompts directory — embedded prompts are primary; disk is fallback
  const promptsDir = join(import.meta.dir, "..", "prompts");

  // Config subcommand routing
  if (argv[0] === "config") {
    try {
      runConfigCommand(argv.slice(1));
    } catch (err) {
      process.stderr.write(`Error: ${(err as Error).message}\n`);
      process.exit(1);
    }
    process.exit(0);
  }

  // Inspect subcommand routing
  if (argv[0] === "inspect") {
    try {
      runInspectCommand(argv.slice(1), promptsDir);
    } catch (err) {
      process.stderr.write(`Error: ${(err as Error).message}\n`);
      process.exit(1);
    }
    process.exit(0);
  }

  let parsed;
  try {
    parsed = parseCliArgs(argv);
  } catch (err) {
    process.stderr.write(`Error: ${(err as Error).message}\n`);
    process.exit(1);
  }

  // Load config between parse and resolve
  let loadedConfig;
  try {
    loadedConfig = loadConfig();
  } catch (err) {
    process.stderr.write(`Error: ${(err as Error).message}\n`);
    process.exit(1);
  }

  // Resolve with config
  let config;
  try {
    config = resolveConfig(parsed, loadedConfig);
  } catch (err) {
    process.stderr.write(`Error: ${(err as Error).message}\n`);
    process.exit(1);
  }

  // Detect environment and build template vars
  const env = detectEnv();
  const templateVars = buildTemplateVars(env);

  // Assemble the prompt
  const prompt = assemblePrompt({
    mode: config,
    templateVars,
    promptsDir,
  });

  // --print: output the prompt itself (for debugging)
  if (parsed.modifiers.print) {
    process.stdout.write(prompt);
    process.exit(0);
  }

  // Write to temp file
  const tempFile = writeTempPrompt(prompt);

  // Build claude args
  const claudeArgs: string[] = ["--system-prompt-file", tempFile];

  // Forward append-system-prompt flags
  if (parsed.forwarded.appendSystemPrompt) {
    claudeArgs.push("--append-system-prompt", parsed.forwarded.appendSystemPrompt);
  }
  if (parsed.forwarded.appendSystemPromptFile) {
    claudeArgs.push("--append-system-prompt-file", parsed.forwarded.appendSystemPromptFile);
  }

  // Add passthrough args
  claudeArgs.push(...parsed.passthroughArgs);

  // Spawn claude directly — gives it full TTY ownership
  const proc = Bun.spawn(["claude", ...claudeArgs], {
    stdio: ["inherit", "inherit", "inherit"],
  });

  // Forward signals to the child process
  process.on("SIGINT", () => proc.kill("SIGINT"));
  process.on("SIGTERM", () => proc.kill("SIGTERM"));

  const exitCode = await proc.exited;

  // Clean up temp file after claude exits
  try {
    const { dirname } = await import("node:path");
    rmSync(dirname(tempFile), { recursive: true, force: true });
  } catch {
    // Best-effort cleanup; don't fail if temp dir is already gone
  }

  process.exit(exitCode);
}

main().catch((err) => {
  process.stderr.write(`Error: ${(err as Error).message}\n`);
  process.exit(1);
});
