import { describe, test, expect } from "bun:test";
import { createCliRunner } from "./test-helpers.js";
import { join } from "node:path";

const { run, runExpectFail } = createCliRunner(
  `bun run ${join(import.meta.dir, "cli.ts")}`,
  10000,
);

describe("cli.ts --help", () => {
  test("prints usage", () => {
    const output = run("--help");
    expect(output).toContain("Usage: claude-mode");
    expect(output).toContain("Presets:");
    expect(output).toContain("create");
    expect(output).toContain("explore");
  });

  test("-h prints usage", () => {
    const output = run("-h");
    expect(output).toContain("Usage: claude-mode");
  });

  test("no args prints usage", () => {
    const output = run("");
    expect(output).toContain("Usage: claude-mode");
  });
});

describe("cli.ts create --print", () => {
  test("produces a valid prompt containing 'Claude Code'", () => {
    const output = run("create --print");
    expect(output).toContain("Claude Code");
  });

  test("prompt has no unreplaced template variables", () => {
    const output = run("create --print");
    expect(output).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });

  test("prompt contains expected sections", () => {
    const output = run("create --print");
    expect(output).toContain("# Agency: Autonomous");
    expect(output).toContain("# Quality: Architect");
    expect(output).toContain("# Scope: Unrestricted");
  });
});

describe("cli.ts config show", () => {
  test("config show runs without error", () => {
    // May print empty config or actual config — just ensure it doesn't crash
    expect(() => run("config show")).not.toThrow();
  });
});

describe("cli.ts error cases", () => {
  test("--system-prompt is rejected", () => {
    const output = runExpectFail("--system-prompt 'something'");
    expect(output).toContain("Error");
  });
});
