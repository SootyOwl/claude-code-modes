import { describe, test, expect } from "bun:test";
import { join } from "node:path";
import { assemblePrompt } from "./assemble.js";
import { detectEnv, buildTemplateVars } from "./env.js";

const PROMPTS_DIR = join(import.meta.dir, "..", "prompts");

describe("full assembly integration", () => {
  test("none mode produces valid prompt with real env", () => {
    const env = detectEnv();
    const vars = buildTemplateVars(env);
    const result = assemblePrompt({
      mode: { axes: null, modifiers: { readonly: false } },
      templateVars: vars,
      promptsDir: PROMPTS_DIR,
    });

    // No unreplaced vars
    expect(result).not.toMatch(/\{\{[A-Z_]+\}\}/);

    // Contains actual CWD
    expect(result).toContain(process.cwd());

    // Contains all major sections
    expect(result).toContain("# System");
    expect(result).toContain("# Doing tasks");
    expect(result).toContain("# Executing actions with care");
    expect(result).toContain("# Using your tools");
    expect(result).toContain("# Tone and style");
    expect(result).toContain("# Session-specific guidance");
    expect(result).toContain("# Context and pacing");
    expect(result).toContain("# Environment");
  });

  test("none mode with readonly includes readonly modifier", () => {
    const env = detectEnv();
    const vars = buildTemplateVars(env);
    const result = assemblePrompt({
      mode: { axes: null, modifiers: { readonly: true } },
      templateVars: vars,
      promptsDir: PROMPTS_DIR,
    });

    expect(result).toContain("readonly");
  });
});
