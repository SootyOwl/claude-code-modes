import { describe, test, expect } from "bun:test";
import { join } from "node:path";
import { execSync } from "node:child_process";

const SCRIPT = join(import.meta.dir, "..", "claude-mode");
const PROJECT_ROOT = join(import.meta.dir, "..");

function run(args: string): string {
  return execSync(`${SCRIPT} ${args}`, {
    encoding: "utf8",
    timeout: 15000,
    cwd: PROJECT_ROOT,
  }).trim();
}

function runExpectFail(args: string): string {
  try {
    execSync(`${SCRIPT} ${args}`, {
      encoding: "utf8",
      timeout: 15000,
      cwd: PROJECT_ROOT,
    });
    throw new Error("Expected command to fail");
  } catch (err: any) {
    return (err.stderr || err.message || "").toString();
  }
}

describe("claude-mode e2e", () => {
  // Help and usage
  test("no args prints usage", () => {
    const output = run("");
    expect(output).toContain("Usage: claude-mode");
  });

  test("--help prints usage", () => {
    const output = run("--help");
    expect(output).toContain("Usage: claude-mode");
  });

  test("-h prints usage", () => {
    const output = run("-h");
    expect(output).toContain("Usage: claude-mode");
  });

  // --print mode for each preset
  test("new-project --print contains correct axis headers", () => {
    const output = run("new-project --print");
    expect(output).toContain("# Agency: Autonomous");
    expect(output).toContain("# Quality: Architect");
    expect(output).toContain("# Scope: Unrestricted");
    expect(output).not.toContain("# Read-only mode");
  });

  test("vibe-extend --print contains correct axis headers", () => {
    const output = run("vibe-extend --print");
    expect(output).toContain("# Agency: Autonomous");
    expect(output).toContain("# Quality: Pragmatic");
    expect(output).toContain("# Scope: Adjacent");
  });

  test("safe-small --print contains correct axis headers", () => {
    const output = run("safe-small --print");
    expect(output).toContain("# Agency: Collaborative");
    expect(output).toContain("# Quality: Minimal");
    expect(output).toContain("# Scope: Narrow");
  });

  test("refactor --print contains correct axis headers", () => {
    const output = run("refactor --print");
    expect(output).toContain("# Agency: Autonomous");
    expect(output).toContain("# Quality: Pragmatic");
    expect(output).toContain("# Scope: Unrestricted");
  });

  test("explore --print contains readonly modifier", () => {
    const output = run("explore --print");
    expect(output).toContain("# Agency: Collaborative");
    expect(output).toContain("# Quality: Architect");
    expect(output).toContain("# Scope: Narrow");
    expect(output).toContain("# Read-only mode");
  });

  test("none --print has no axis headers", () => {
    const output = run("none --print");
    expect(output).not.toContain("# Agency:");
    expect(output).not.toContain("# Quality:");
    expect(output).not.toContain("# Scope:");
  });

  // All presets include universal sections
  test("all presets include context pacing", () => {
    for (const preset of ["new-project", "vibe-extend", "safe-small", "refactor", "explore", "none"]) {
      const output = run(`${preset} --print`);
      expect(output).toContain("# Context and pacing");
    }
  });

  test("all presets include environment section", () => {
    for (const preset of ["new-project", "vibe-extend", "safe-small", "refactor", "explore", "none"]) {
      const output = run(`${preset} --print`);
      expect(output).toContain("# Environment");
      expect(output).toContain(process.cwd());
    }
  });

  // Axis override through bash script
  test("preset with axis override works", () => {
    const output = run("new-project --quality pragmatic --print");
    expect(output).toContain("# Quality: Pragmatic");
    expect(output).not.toContain("# Quality: Architect");
    expect(output).toContain("# Agency: Autonomous");
  });

  // --readonly modifier
  test("--readonly adds readonly content", () => {
    const output = run("new-project --readonly --print");
    expect(output).toContain("# Read-only mode");
  });

  // Error handling through bash script
  test("invalid agency error propagates", () => {
    const err = runExpectFail("--agency invalid");
    expect(err).toContain("Invalid --agency");
  });

  test("--system-prompt error propagates", () => {
    const err = runExpectFail("new-project --system-prompt foo");
    expect(err).toContain("Cannot use --system-prompt");
  });

  // Normal mode (non-print) produces claude command
  test("normal mode outputs claude command", () => {
    const output = run("new-project");
    expect(output).toMatch(/^claude --system-prompt-file /);
  });

  // Passthrough args
  test("passthrough args via -- separator", () => {
    const output = run("new-project -- --verbose --model sonnet");
    expect(output).toContain("--verbose");
    expect(output).toContain("--model");
    expect(output).toContain("sonnet");
  });

  // No template variable leaks in any mode
  test("no unreplaced template variables in any preset", () => {
    for (const preset of ["new-project", "vibe-extend", "safe-small", "refactor", "explore", "none"]) {
      const output = run(`${preset} --print`);
      expect(output).not.toMatch(/\{\{[A-Z_]+\}\}/);
    }
  });
});
