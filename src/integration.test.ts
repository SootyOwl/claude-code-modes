import { describe, test, expect } from "bun:test";
import { join } from "node:path";
import { assemblePrompt } from "./assemble.js";
import { detectEnv, buildTemplateVars } from "./env.js";
import { getPreset } from "./presets.js";
import { PRESET_NAMES } from "./types.js";
import type { ModeConfig } from "./types.js";

const PROMPTS_DIR = join(import.meta.dir, "..", "prompts");

describe("full assembly integration", () => {
  test("none mode produces valid prompt with real env", () => {
    const env = detectEnv();
    const vars = buildTemplateVars(env);
    const result = assemblePrompt({
      mode: { base: "standard", axes: null, modifiers: { readonly: false, contextPacing: false, custom: [] } },
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
    expect(result).toContain("# Environment");
  });

  test("none mode with readonly includes readonly modifier", () => {
    const env = detectEnv();
    const vars = buildTemplateVars(env);
    const result = assemblePrompt({
      mode: { base: "standard", axes: null, modifiers: { readonly: true, contextPacing: false, custom: [] } },
      templateVars: vars,
      promptsDir: PROMPTS_DIR,
    });

    expect(result).toContain("# Read-only mode");
  });
});

describe("preset assembly integration", () => {
  const env = detectEnv();
  const vars = buildTemplateVars(env);

  for (const presetName of PRESET_NAMES) {
    test(`${presetName} preset assembles without errors`, () => {
      const preset = getPreset(presetName);
      const mode: ModeConfig = {
        base: "standard",
        axes: preset.axes,
        modifiers: { readonly: preset.readonly, contextPacing: false, custom: [] },
      };
      const result = assemblePrompt({ mode, templateVars: vars, promptsDir: PROMPTS_DIR });
      expect(result.length).toBeGreaterThan(0);
      expect(result).not.toMatch(/\{\{[A-Z_]+\}\}/);
    });
  }

  test("create contains architect quality content", () => {
    const preset = getPreset("create");
    const mode: ModeConfig = { base: "standard", axes: preset.axes, modifiers: { readonly: preset.readonly, contextPacing: false, custom: [] } };
    const result = assemblePrompt({ mode, templateVars: vars, promptsDir: PROMPTS_DIR });
    expect(result).toContain("# Quality: Architect");
    expect(result).toContain("# Agency: Autonomous");
    expect(result).toContain("# Scope: Unrestricted");
    expect(result).not.toContain("# Quality: Minimal");
    expect(result).not.toContain("# Quality: Pragmatic");
  });

  test("safe contains minimal quality and shared actions content", () => {
    const preset = getPreset("safe");
    const mode: ModeConfig = { base: "standard", axes: preset.axes, modifiers: { readonly: preset.readonly, contextPacing: false, custom: [] } };
    const result = assemblePrompt({ mode, templateVars: vars, promptsDir: PROMPTS_DIR });
    expect(result).toContain("# Quality: Minimal");
    expect(result).toContain("# Agency: Collaborative");
    expect(result).toContain("# Scope: Narrow");
    expect(result).toContain("# Executing actions with care");
  });

  test("create contains actions content", () => {
    const preset = getPreset("create");
    const mode: ModeConfig = { base: "standard", axes: preset.axes, modifiers: { readonly: preset.readonly, contextPacing: false, custom: [] } };
    const result = assemblePrompt({ mode, templateVars: vars, promptsDir: PROMPTS_DIR });
    expect(result).toContain("# Executing actions with care");
    expect(result).toContain("# Agency: Autonomous");
  });

  test("explore includes readonly modifier", () => {
    const preset = getPreset("explore");
    const mode: ModeConfig = { base: "standard", axes: preset.axes, modifiers: { readonly: preset.readonly, contextPacing: false, custom: [] } };
    const result = assemblePrompt({ mode, templateVars: vars, promptsDir: PROMPTS_DIR });
    expect(result).toContain("Read-only mode");
    expect(result).toContain("Do NOT create, edit, move, or delete any files");
  });

  test("none mode has no axis headers", () => {
    const preset = getPreset("none");
    const mode: ModeConfig = { base: "standard", axes: preset.axes, modifiers: { readonly: preset.readonly, contextPacing: false, custom: [] } };
    const result = assemblePrompt({ mode, templateVars: vars, promptsDir: PROMPTS_DIR });
    expect(result).not.toContain("# Agency:");
    expect(result).not.toContain("# Quality:");
    expect(result).not.toContain("# Scope:");
  });

  test("presets exclude context pacing by default, include when opted in", () => {
    const preset = getPreset("create");
    const without: ModeConfig = { base: "standard", axes: preset.axes, modifiers: { readonly: false, contextPacing: false, custom: [] } };
    expect(assemblePrompt({ mode: without, templateVars: vars, promptsDir: PROMPTS_DIR })).not.toContain("# Context and pacing");

    const withPacing: ModeConfig = { base: "standard", axes: preset.axes, modifiers: { readonly: false, contextPacing: true, custom: [] } };
    expect(assemblePrompt({ mode: withPacing, templateVars: vars, promptsDir: PROMPTS_DIR })).toContain("# Context and pacing");
  });

  test("axis override on preset works", () => {
    const preset = getPreset("create");
    // Override quality from architect to pragmatic
    const mode: ModeConfig = {
      base: "standard",
      axes: { ...preset.axes!, quality: "pragmatic" },
      modifiers: { readonly: false, contextPacing: false, custom: [] },
    };
    const result = assemblePrompt({ mode, templateVars: vars, promptsDir: PROMPTS_DIR });
    expect(result).toContain("# Quality: Pragmatic");
    expect(result).not.toContain("# Quality: Architect");
    // Agency and scope should still be from create
    expect(result).toContain("# Agency: Autonomous");
    expect(result).toContain("# Scope: Unrestricted");
  });
});

describe("chill base integration", () => {
  const env = detectEnv();
  const vars = buildTemplateVars(env);

  for (const presetName of PRESET_NAMES) {
    test(`${presetName} preset with chill base assembles without errors`, () => {
      const preset = getPreset(presetName);
      const mode: ModeConfig = {
        base: "chill",
        axes: preset.axes,
        modifiers: { readonly: preset.readonly, contextPacing: false, custom: [] },
      };
      const result = assemblePrompt({ mode, templateVars: vars, promptsDir: PROMPTS_DIR });
      expect(result.length).toBeGreaterThan(0);
      expect(result).not.toMatch(/\{\{[A-Z_]+\}\}/);
    });
  }

  test("chill base contains no ALL-CAPS emphasis words", () => {
    const mode: ModeConfig = {
      base: "chill",
      axes: { agency: "collaborative", quality: "pragmatic", scope: "adjacent" },
      modifiers: { readonly: false, contextPacing: false, custom: [] },
    };
    const result = assemblePrompt({ mode, templateVars: vars, promptsDir: PROMPTS_DIR });
    expect(result).not.toMatch(/\bIMPORTANT\b/);
    expect(result).not.toMatch(/\bCRITICAL\b/);
    expect(result).not.toMatch(/\bMUST\b/);
    expect(result).not.toMatch(/\bNEVER\b/);
  });

  test("chill base is shorter than standard base for same axes", () => {
    const axes = { agency: "collaborative", quality: "pragmatic", scope: "adjacent" };
    const modifiers = { readonly: false, contextPacing: false, custom: [] };

    const standard = assemblePrompt({
      mode: { base: "standard", axes, modifiers },
      templateVars: vars,
      promptsDir: PROMPTS_DIR,
    });
    const chill = assemblePrompt({
      mode: { base: "chill", axes, modifiers },
      templateVars: vars,
      promptsDir: PROMPTS_DIR,
    });

    expect(chill.length).toBeLessThan(standard.length);
  });

  test("chill base with chill axis fragments works", () => {
    const mode: ModeConfig = {
      base: "chill",
      axes: { agency: "autonomous", quality: "architect", scope: "unrestricted" },
      modifiers: { readonly: false, contextPacing: false, custom: [] },
    };
    const result = assemblePrompt({ mode, templateVars: vars, promptsDir: PROMPTS_DIR });
    expect(result).toContain("# Agency: Autonomous");
    expect(result).toContain("# Quality: Architect");
    expect(result).toContain("# Scope: Unrestricted");
  });

  test("chill none mode has no axis headers", () => {
    const mode: ModeConfig = {
      base: "chill",
      axes: null,
      modifiers: { readonly: false, contextPacing: false, custom: [] },
    };
    const result = assemblePrompt({ mode, templateVars: vars, promptsDir: PROMPTS_DIR });
    expect(result).not.toContain("# Agency:");
    expect(result).not.toContain("# Quality:");
    expect(result).not.toContain("# Scope:");
  });
});
