import { describe, test, expect } from "bun:test";
import { join } from "node:path";
import {
  readFragment,
  substituteTemplateVars,
  getFragmentOrder,
  assemblePrompt,
  writeTempPrompt,
} from "./assemble.js";
import { existsSync, unlinkSync, rmdirSync } from "node:fs";
import { dirname } from "node:path";
import type { ModeConfig, TemplateVars } from "./types.js";

const PROMPTS_DIR = join(import.meta.dir, "..", "prompts");

describe("readFragment", () => {
  test("reads existing fragment", () => {
    const content = readFragment(PROMPTS_DIR, "base/intro.md");
    expect(content).not.toBeNull();
    expect(content).toContain("Claude Code");
  });

  test("returns null for non-existent fragment", () => {
    const content = readFragment(PROMPTS_DIR, "base/nonexistent.md");
    expect(content).toBeNull();
  });
});

describe("substituteTemplateVars", () => {
  const vars: TemplateVars = {
    CWD: "/test",
    IS_GIT: "true",
    PLATFORM: "linux",
    SHELL: "bash",
    OS_VERSION: "Linux 6.0",
    MODEL_NAME: "Test Model",
    MODEL_ID: "test-model-1",
    KNOWLEDGE_CUTOFF: "January 2025",
    GIT_STATUS: "clean",
  };

  test("replaces all template variables", () => {
    const result = substituteTemplateVars("Dir: {{CWD}}, Shell: {{SHELL}}", vars);
    expect(result).toBe("Dir: /test, Shell: bash");
  });

  test("replaces multiple occurrences of same variable", () => {
    const result = substituteTemplateVars("{{CWD}} and {{CWD}}", vars);
    expect(result).toBe("/test and /test");
  });

  test("throws on unreplaced variables", () => {
    expect(() => substituteTemplateVars("{{UNKNOWN_VAR}}", vars)).toThrow(
      "Unreplaced template variables"
    );
  });

  test("does not throw when all variables are replaced", () => {
    expect(() =>
      substituteTemplateVars("{{CWD}} {{PLATFORM}}", vars)
    ).not.toThrow();
  });
});

describe("getFragmentOrder", () => {
  const noneMode: ModeConfig = {
    axes: null,
    modifiers: { readonly: false },
  };

  const autonomousMode: ModeConfig = {
    axes: { agency: "autonomous", quality: "architect", scope: "unrestricted" },
    modifiers: { readonly: false },
  };

  const collaborativeMode: ModeConfig = {
    axes: { agency: "collaborative", quality: "pragmatic", scope: "adjacent" },
    modifiers: { readonly: false },
  };

  test("none mode has no axis fragments", () => {
    const order = getFragmentOrder(noneMode);
    expect(order.some((p) => p.startsWith("axis/"))).toBe(false);
  });

  test("none mode includes all base fragments", () => {
    const order = getFragmentOrder(noneMode);
    expect(order).toContain("base/intro.md");
    expect(order).toContain("base/system.md");
    expect(order).toContain("base/doing-tasks.md");
    expect(order).toContain("base/tools.md");
    expect(order).toContain("base/tone.md");
    expect(order).toContain("base/session-guidance.md");
    expect(order).toContain("base/env.md");
  });

  test("none mode uses cautious actions", () => {
    const order = getFragmentOrder(noneMode);
    expect(order).toContain("base/actions-cautious.md");
    expect(order).not.toContain("base/actions-autonomous.md");
  });

  test("autonomous mode uses autonomous actions", () => {
    const order = getFragmentOrder(autonomousMode);
    expect(order).toContain("base/actions-autonomous.md");
    expect(order).not.toContain("base/actions-cautious.md");
  });

  test("collaborative mode uses cautious actions", () => {
    const order = getFragmentOrder(collaborativeMode);
    expect(order).toContain("base/actions-cautious.md");
  });

  test("includes axis fragments when axes are set", () => {
    const order = getFragmentOrder(autonomousMode);
    expect(order).toContain("axis/agency/autonomous.md");
    expect(order).toContain("axis/quality/architect.md");
    expect(order).toContain("axis/scope/unrestricted.md");
  });

  test("always includes context-pacing", () => {
    expect(getFragmentOrder(noneMode)).toContain("modifiers/context-pacing.md");
    expect(getFragmentOrder(autonomousMode)).toContain("modifiers/context-pacing.md");
  });

  test("includes readonly only when flagged", () => {
    const readonlyMode: ModeConfig = { axes: null, modifiers: { readonly: true } };
    expect(getFragmentOrder(readonlyMode)).toContain("modifiers/readonly.md");
    expect(getFragmentOrder(noneMode)).not.toContain("modifiers/readonly.md");
  });

  test("env.md is always last", () => {
    const order = getFragmentOrder(noneMode);
    expect(order[order.length - 1]).toBe("base/env.md");
  });
});

describe("assemblePrompt", () => {
  const vars: TemplateVars = {
    CWD: "/test/project",
    IS_GIT: "true",
    PLATFORM: "linux",
    SHELL: "bash",
    OS_VERSION: "Linux 6.0",
    MODEL_NAME: "Claude Opus 4.6",
    MODEL_ID: "claude-opus-4-6",
    KNOWLEDGE_CUTOFF: "May 2025",
    GIT_STATUS: "Current branch: main\n\nStatus:\n(clean)",
  };

  test("assembles none mode without errors", () => {
    const result = assemblePrompt({
      mode: { axes: null, modifiers: { readonly: false } },
      templateVars: vars,
      promptsDir: PROMPTS_DIR,
    });
    expect(result.length).toBeGreaterThan(0);
  });

  test("assembled prompt has no unreplaced template variables", () => {
    const result = assemblePrompt({
      mode: { axes: null, modifiers: { readonly: false } },
      templateVars: vars,
      promptsDir: PROMPTS_DIR,
    });
    expect(result).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });

  test("assembled prompt contains key sections", () => {
    const result = assemblePrompt({
      mode: { axes: null, modifiers: { readonly: false } },
      templateVars: vars,
      promptsDir: PROMPTS_DIR,
    });
    expect(result).toContain("Claude Code");
    expect(result).toContain("# System");
    expect(result).toContain("# Doing tasks");
    expect(result).toContain("# Using your tools");
    expect(result).toContain("# Tone and style");
    expect(result).toContain("# Context and pacing");
    expect(result).toContain("# Environment");
  });

  test("throws on missing fragment", () => {
    expect(() =>
      assemblePrompt({
        mode: {
          axes: { agency: "autonomous", quality: "architect", scope: "unrestricted" },
          modifiers: { readonly: false },
        },
        templateVars: vars,
        promptsDir: PROMPTS_DIR,
      })
    ).toThrow("Missing prompt fragment");
    // This will throw because axis fragments don't exist in Phase 1
  });
});

describe("writeTempPrompt", () => {
  test("writes file to temp directory", () => {
    const content = "test prompt content";
    const path = writeTempPrompt(content);
    expect(existsSync(path)).toBe(true);

    // Cleanup
    unlinkSync(path);
    rmdirSync(dirname(path));
  });

  test("file contains correct content", async () => {
    const content = "test prompt content";
    const path = writeTempPrompt(content);
    const read = await Bun.file(path).text();

    // Cleanup
    unlinkSync(path);
    rmdirSync(dirname(path));

    expect(read).toBe(content);
  });
});
