import type { ModeConfig } from "./types.js";
import type { ParsedArgs } from "./args.js";
import type { LoadedConfig } from "./config.js";
import { resolveConfigPath } from "./config.js";
import { getPreset, isPresetName } from "./presets.js";
import {
  AGENCY_VALUES,
  QUALITY_VALUES,
  SCOPE_VALUES,
  BUILTIN_MODIFIER_NAMES,
  BUILTIN_BASE_NAMES,
  PRESET_NAMES,
  isBuiltinModifier,
  isBuiltinBase,
} from "./types.js";
import { resolve as pathResolve, isAbsolute } from "node:path";

const DEFAULT_AGENCY = "collaborative";
const DEFAULT_QUALITY = "pragmatic";
const DEFAULT_SCOPE = "adjacent";

/**
 * Returns true if a string looks like a file path rather than a name.
 * Paths contain "/" or "\" or end with ".md".
 */
function looksLikeFilePath(value: string): boolean {
  return value.includes("/") || value.includes("\\") || value.endsWith(".md");
}

/**
 * Resolves an axis value to either a built-in name or an absolute path.
 * Resolution order: built-in values → config-defined names → file path heuristic.
 * Throws with descriptive error if unresolvable.
 */
function resolveAxisValue(
  raw: string,
  axisName: "agency" | "quality" | "scope",
  builtinValues: readonly string[],
  loadedConfig: LoadedConfig | null,
): string {
  // 1. Built-in value
  if (builtinValues.includes(raw)) return raw;

  // 2. Config-defined custom name
  const configAxes = loadedConfig?.config.axes?.[axisName];
  if (configAxes && raw in configAxes) {
    return resolveConfigPath(loadedConfig!.configDir, configAxes[raw]);
  }

  // 3. File path
  if (looksLikeFilePath(raw)) {
    return isAbsolute(raw) ? raw : pathResolve(raw);
  }

  // 4. Unknown
  const configHint = loadedConfig
    ? ` Config loaded from: ${loadedConfig.configDir}`
    : " No config file found.";
  throw new Error(
    `Unknown --${axisName} value: "${raw}". ` +
    `Must be one of: ${builtinValues.join(", ")}, ` +
    `a name defined in your config, or a file path.${configHint}`
  );
}

/**
 * Resolves a modifier reference to either a built-in flag name or an absolute path.
 * Resolution order: built-in modifier name → config-defined name → file path.
 */
function resolveModifier(
  raw: string,
  loadedConfig: LoadedConfig | null,
): { kind: "builtin"; name: string } | { kind: "custom"; path: string } {
  // 1. Built-in modifier
  if (isBuiltinModifier(raw)) {
    return { kind: "builtin", name: raw };
  }

  // 2. Config-defined custom modifier
  const configModifiers = loadedConfig?.config.modifiers;
  if (configModifiers && raw in configModifiers) {
    return {
      kind: "custom",
      path: resolveConfigPath(loadedConfig!.configDir, configModifiers[raw]),
    };
  }

  // 3. File path
  if (looksLikeFilePath(raw)) {
    const absPath = isAbsolute(raw) ? raw : pathResolve(raw);
    return { kind: "custom", path: absPath };
  }

  // 4. Unknown
  const configHint = loadedConfig
    ? ` Config loaded from: ${loadedConfig.configDir}`
    : " No config file found.";
  throw new Error(
    `Unknown modifier: "${raw}". ` +
    `Must be a built-in modifier (${BUILTIN_MODIFIER_NAMES.join(", ")}), ` +
    `a name defined in your config, or a file path.${configHint}`
  );
}

/** Resolves a list of modifier references, updating flags and custom paths in place. */
function applyModifiers(
  modifiers: string[],
  loadedConfig: LoadedConfig | null,
  flags: { readonly: boolean; contextPacing: boolean },
  customPaths: string[],
  position: "append" | "prepend",
): void {
  for (const raw of modifiers) {
    const resolved = resolveModifier(raw, loadedConfig);
    if (resolved.kind === "builtin") {
      if (resolved.name === "readonly") flags.readonly = true;
      if (resolved.name === "context-pacing") flags.contextPacing = true;
    } else {
      if (!customPaths.includes(resolved.path)) {
        if (position === "prepend") customPaths.unshift(resolved.path);
        else customPaths.push(resolved.path);
      }
    }
  }
}

/**
 * Resolves a base reference to a built-in name or absolute directory path.
 * Priority: CLI --base > preset base > config defaultBase > "standard"
 */
function resolveBase(
  raw: string | undefined,
  loadedConfig: LoadedConfig | null,
  presetBase: string | undefined,
): string {
  const config = loadedConfig?.config ?? null;

  // Priority: CLI --base > preset base > config defaultBase > "standard"
  const value = raw ?? presetBase ?? config?.defaultBase ?? "standard";

  // 1. Built-in name
  if (isBuiltinBase(value)) return value;

  // 2. Config-defined name
  const configBases = config?.bases;
  if (configBases && value in configBases) {
    return resolveConfigPath(loadedConfig!.configDir, configBases[value]);
  }

  // 3. Directory path
  if (looksLikeFilePath(value)) {
    return isAbsolute(value) ? value : pathResolve(value);
  }

  // 4. Unknown
  const configHint = loadedConfig
    ? ` Config loaded from: ${loadedConfig.configDir}`
    : " No config file found.";
  throw new Error(
    `Unknown --base value: "${value}". ` +
    `Must be one of: ${BUILTIN_BASE_NAMES.join(", ")}, ` +
    `a name defined in your config, or a directory path.${configHint}`
  );
}

export function resolveConfig(
  parsed: ParsedArgs,
  loadedConfig: LoadedConfig | null,
): ModeConfig {
  const config = loadedConfig?.config ?? null;

  // Resolve modifiers: defaultModifiers (config) → --modifier flags (CLI)
  const flags = { readonly: parsed.modifiers.readonly, contextPacing: parsed.modifiers.contextPacing };
  const customModifierPaths: string[] = [];

  // 1. Config defaultModifiers — always applied first
  if (config?.defaultModifiers) {
    applyModifiers(config.defaultModifiers, loadedConfig, flags, customModifierPaths, "append");
  }

  // 2. CLI --modifier flags — appended after defaults
  applyModifiers(parsed.customModifiers, loadedConfig, flags, customModifierPaths, "append");

  // Handle "none" preset — resolve base before early return
  if (parsed.preset === "none") {
    const base = resolveBase(parsed.base, loadedConfig, undefined);
    return {
      base,
      axes: null,
      modifiers: {
        readonly: flags.readonly,
        contextPacing: flags.contextPacing,
        custom: customModifierPaths,
      },
    };
  }

  let agency: string;
  let quality: string;
  let scope: string;
  let presetBase: string | undefined;

  if (parsed.preset) {
    // Check built-in presets first, then config presets
    if (isPresetName(parsed.preset)) {
      const preset = getPreset(parsed.preset);
      if (preset.axes === null) throw new Error(`Preset "${parsed.preset}" has null axes`);
      agency = parsed.overrides.agency
        ? resolveAxisValue(parsed.overrides.agency, "agency", AGENCY_VALUES, loadedConfig)
        : preset.axes.agency;
      quality = parsed.overrides.quality
        ? resolveAxisValue(parsed.overrides.quality, "quality", QUALITY_VALUES, loadedConfig)
        : preset.axes.quality;
      scope = parsed.overrides.scope
        ? resolveAxisValue(parsed.overrides.scope, "scope", SCOPE_VALUES, loadedConfig)
        : preset.axes.scope;
      flags.readonly = flags.readonly || preset.readonly;
      // Built-in presets don't specify a base — presetBase stays undefined
    } else if (config?.presets && parsed.preset in config.presets) {
      // Config-defined preset
      const customPreset = config.presets[parsed.preset];
      presetBase = customPreset.base;
      agency = parsed.overrides.agency
        ? resolveAxisValue(parsed.overrides.agency, "agency", AGENCY_VALUES, loadedConfig)
        : customPreset.agency
          ? resolveAxisValue(customPreset.agency, "agency", AGENCY_VALUES, loadedConfig)
          : DEFAULT_AGENCY;
      quality = parsed.overrides.quality
        ? resolveAxisValue(parsed.overrides.quality, "quality", QUALITY_VALUES, loadedConfig)
        : customPreset.quality
          ? resolveAxisValue(customPreset.quality, "quality", QUALITY_VALUES, loadedConfig)
          : DEFAULT_QUALITY;
      scope = parsed.overrides.scope
        ? resolveAxisValue(parsed.overrides.scope, "scope", SCOPE_VALUES, loadedConfig)
        : customPreset.scope
          ? resolveAxisValue(customPreset.scope, "scope", SCOPE_VALUES, loadedConfig)
          : DEFAULT_SCOPE;
      if (customPreset.readonly) flags.readonly = true;
      if (customPreset.contextPacing) flags.contextPacing = true;

      // Resolve preset's modifiers list — inserted before CLI modifiers
      if (customPreset.modifiers) {
        applyModifiers(customPreset.modifiers, loadedConfig, flags, customModifierPaths, "prepend");
      }
    } else {
      throw new Error(
        `Unknown preset: "${parsed.preset}". ` +
        `Built-in presets: ${PRESET_NAMES.join(", ")}. ` +
        (config?.presets
          ? `Config presets: ${Object.keys(config.presets).join(", ")}.`
          : "No config file found.")
      );
    }
  } else {
    // No preset: use overrides with defaults
    agency = parsed.overrides.agency
      ? resolveAxisValue(parsed.overrides.agency, "agency", AGENCY_VALUES, loadedConfig)
      : DEFAULT_AGENCY;
    quality = parsed.overrides.quality
      ? resolveAxisValue(parsed.overrides.quality, "quality", QUALITY_VALUES, loadedConfig)
      : DEFAULT_QUALITY;
    scope = parsed.overrides.scope
      ? resolveAxisValue(parsed.overrides.scope, "scope", SCOPE_VALUES, loadedConfig)
      : DEFAULT_SCOPE;
  }

  const base = resolveBase(parsed.base, loadedConfig, presetBase);

  return {
    base,
    axes: { agency, quality, scope },
    modifiers: {
      readonly: flags.readonly,
      contextPacing: flags.contextPacing,
      custom: customModifierPaths,
    },
  };
}
