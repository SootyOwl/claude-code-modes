#!/usr/bin/env bun
/**
 * Downloads @anthropic-ai/claude-code, extracts cli.js, and locates the system
 * prompt section functions by content markers. Outputs raw function bodies to
 * upstream-prompts/ for manual review and diffing.
 *
 * This is a helper — it gets you the raw material fast. A human (or Claude)
 * still needs to read the output and compare against prompts/base/.
 *
 * Usage:
 *   bun run scripts/extract-upstream-prompt.ts          # latest
 *   bun run scripts/extract-upstream-prompt.ts 2.1.92   # specific version
 *
 * Output: upstream-prompts/claude-code-v{version}-system-prompt.md
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "fs";
import { execSync } from "child_process";
import { join } from "path";

const PROJECT_ROOT = join(import.meta.dir, "..");
const TMP = join(PROJECT_ROOT, ".tmp-extract");
const OUT_DIR = join(PROJECT_ROOT, "upstream-prompts");

// ---------------------------------------------------------------------------
// Download & unpack
// ---------------------------------------------------------------------------

function downloadPackage(version?: string): { src: string; resolvedVersion: string } {
  if (existsSync(TMP)) rmSync(TMP, { recursive: true });
  mkdirSync(TMP, { recursive: true });

  const spec = version ? `@anthropic-ai/claude-code@${version}` : "@anthropic-ai/claude-code";
  console.log(`Downloading ${spec}...`);
  execSync(`npm pack ${spec} --pack-destination ${TMP} 2>&1`, { encoding: "utf8" });
  execSync(`cd ${TMP} && tar xzf *.tgz`, { encoding: "utf8" });

  const pkg = JSON.parse(readFileSync(join(TMP, "package", "package.json"), "utf8"));
  const resolvedVersion: string = pkg.version;

  const cliPath = join(TMP, "package", "cli.js");
  if (!existsSync(cliPath)) throw new Error("cli.js not found in package");

  return { src: readFileSync(cliPath, "utf8"), resolvedVersion };
}

// ---------------------------------------------------------------------------
// Extraction helpers
// ---------------------------------------------------------------------------

/** Extract a JS function body by name (brace-matched, string-aware). */
function extractFnBody(src: string, name: string): string | null {
  const idx = src.indexOf(`function ${name}(`);
  if (idx === -1) return null;

  const braceStart = src.indexOf("{", idx);
  if (braceStart === -1) return null;

  let depth = 0;
  for (let i = braceStart; i < src.length; i++) {
    const ch = src[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return src.slice(idx, i + 1);
    }
    if (ch === "`") {
      i++;
      while (i < src.length && src[i] !== "`") {
        if (src[i] === "\\") i++;
        i++;
      }
    } else if (ch === '"') {
      i++;
      while (i < src.length && src[i] !== '"') {
        if (src[i] === "\\") i++;
        i++;
      }
    } else if (ch === "'") {
      i++;
      while (i < src.length && src[i] !== "'") {
        if (src[i] === "\\") i++;
        i++;
      }
    }
  }
  return null;
}

/**
 * Find the function name whose body contains `marker`.
 * Searches backwards from marker to nearest `function <name>(`.
 */
function findFnNameContaining(src: string, marker: string): string | null {
  const idx = src.indexOf(marker);
  if (idx === -1) return null;

  const searchStart = Math.max(0, idx - 10_000);
  const prefix = src.slice(searchStart, idx);

  const fnRegex = /function\s+(\w+)\s*\(/g;
  let match: RegExpExecArray | null;
  let lastMatch: RegExpExecArray | null = null;
  while ((match = fnRegex.exec(prefix)) !== null) lastMatch = match;
  if (!lastMatch) return null;

  const fnName = lastMatch[1];
  const fnBody = extractFnBody(src, fnName);
  if (fnBody && fnBody.includes(marker)) return fnName;
  return null;
}

/** Find a backtick-delimited string containing `marker`. */
function extractBacktickString(src: string, marker: string, maxLen = 30_000): string | null {
  const idx = src.indexOf(marker);
  if (idx === -1) return null;

  let start = idx;
  while (start > 0 && src[start] !== "`") start--;
  let end = idx + 100;
  while (end < src.length && end - start < maxLen) {
    if (src[end] === "`" && src[end - 1] !== "\\") break;
    end++;
  }
  return src.slice(start + 1, end);
}

// ---------------------------------------------------------------------------
// Section markers — unique strings to locate each prompt section
// ---------------------------------------------------------------------------

const SECTIONS = [
  { label: "Intro", marker: "an interactive agent that helps users" },
  { label: "System Rules", marker: "# System" },
  { label: "Doing Tasks", marker: "primarily request you to perform software engineering tasks" },
  { label: "Executing Actions with Care", marker: "Carefully consider the reversibility and blast radius" },
  { label: "Using Your Tools", marker: "Do NOT use the ${e7} to run commands" },
  { label: "Tone and Style", marker: "Only use emojis if the user explicitly requests it" },
  { label: "Output Efficiency", marker: "Go straight to the point" },
  { label: "Session Guidance", marker: "Session-specific guidance" },
  { label: "Environment Info", marker: "You have been invoked in the following environment" },
  { label: "Main Assembler", marker: "CLAUDE_CODE_SIMPLE" },
] as const;

// ---------------------------------------------------------------------------
// Build output
// ---------------------------------------------------------------------------

function buildOutput(src: string, version: string): string {
  const lines: string[] = [];
  const index: { label: string; fnName: string }[] = [];

  lines.push(`# Claude Code v${version} — Extracted Prompt Functions`);
  lines.push("");
  lines.push(`Extracted from \`@anthropic-ai/claude-code@${version}\` on ${new Date().toISOString().slice(0, 10)}`);
  lines.push(`Source: \`cli.js\` (${(src.length / 1e6).toFixed(1)}MB)`);
  lines.push("");
  lines.push("Each section below is the raw minified JS function body.");
  lines.push("Variable names are mangled but string content is intact.");
  lines.push("");

  for (const section of SECTIONS) {
    lines.push(`${"=".repeat(78)}`);
    lines.push(`## ${section.label}`);
    lines.push(`${"=".repeat(78)}`);
    lines.push("");

    const fnName = findFnNameContaining(src, section.marker);
    if (!fnName) {
      lines.push(`NOT FOUND — marker: ${section.marker.slice(0, 60)}`);
      lines.push("");
      continue;
    }

    const fnBody = extractFnBody(src, fnName)!;
    index.push({ label: section.label, fnName });
    lines.push(`Function: ${fnName}`);
    lines.push("");
    lines.push(fnBody);
    lines.push("");
  }

  // Verification agent prompt (bonus)
  const verifyStr = extractBacktickString(src, "you are bad at verification");
  if (verifyStr) {
    lines.push(`${"=".repeat(78)}`);
    lines.push("## Verification Agent Prompt");
    lines.push(`${"=".repeat(78)}`);
    lines.push("");
    lines.push(verifyStr);
    lines.push("");
  }

  // Index
  lines.push(`${"=".repeat(78)}`);
  lines.push("## Function Index");
  lines.push(`${"=".repeat(78)}`);
  lines.push("");
  for (const { label, fnName } of index) {
    lines.push(`${label}: ${fnName}`);
  }
  lines.push("");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const requestedVersion = process.argv[2];

try {
  const { src, resolvedVersion } = downloadPackage(requestedVersion);
  console.log(`cli.js v${resolvedVersion} (${(src.length / 1e6).toFixed(1)}MB)`);

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  const outPath = join(OUT_DIR, `claude-code-v${resolvedVersion}-system-prompt.md`);
  const doc = buildOutput(src, resolvedVersion);
  writeFileSync(outPath, doc);
  console.log(`Wrote ${outPath}`);

  rmSync(TMP, { recursive: true });
  console.log("Done. Review the file and compare against prompts/base/.");
} catch (err) {
  console.error("Error:", err);
  if (existsSync(TMP)) rmSync(TMP, { recursive: true });
  process.exit(1);
}
