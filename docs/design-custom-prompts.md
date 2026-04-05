# Design: Custom Prompts & Extensibility

## Overview

Adds user-defined prompt fragments — custom modifiers, custom axis values, and custom presets — via CLI flags and a JSON config file. This extends the Parse → Resolve → Assemble pipeline with a config loading step and relaxes axis types from strict unions to strings that resolve to either built-in names or absolute file paths.

### Key Design Decisions

1. **Axis values widen from union types to strings.** `AxisConfig.agency` changes from `Agency` to `string`. After resolution, a string is either a built-in name (e.g., `"autonomous"`) or an absolute path (e.g., `"/home/user/my-agency.md"`). Built-in `Agency`, `Quality`, `Scope` types and `*_VALUES` arrays remain for validation helpers.

2. **Path vs. name heuristic.** A value is treated as a file path if it contains `/`, `\`, or ends with `.md`. Otherwise it's a name to resolve against built-in values then config values.

3. **Resolve does path resolution but not file reads.** `resolve()` calls `path.resolve()` to make paths absolute but doesn't check existence. Assembly fails on missing files, consistent with built-in fragment handling.

4. **Custom fragments get template variable substitution.** Since they're part of the assembled prompt string, `substituteTemplateVars` runs over them automatically. Custom files containing `{{UNKNOWN_VAR}}` patterns will trigger the existing fail-fast error.

5. **Custom agency defaults to cautious actions.** When a custom agency file path is used (not a built-in name), the actions variant defaults to `actions-cautious.md` — the safe choice.

6. **First positional is always a preset candidate.** Currently, unrecognized first positionals fall through to passthrough args. With config presets, the first positional is treated as a preset name; resolve validates it against built-in + config presets.

### Updated Pipeline

```
1. Parse (args.ts)       → ParsedArgs (raw strings, no axis validation)
2. Load config (config.ts) → UserConfig | null + configDir
3. Resolve (resolve.ts)  → ModeConfig (validated, paths resolved to absolute)
4. Detect env (env.ts)   → TemplateVars
5. Assemble (assemble.ts) → prompt string
```

---

## Implementation Units

### Unit 1: Config Types and Loader

**File**: `src/config.ts` (new)

```typescript
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { homedir } from "node:os";

/** Schema for .claude-mode.json */
export interface UserConfig {
  modifiers?: Record<string, string>;
  axes?: {
    agency?: Record<string, string>;
    quality?: Record<string, string>;
    scope?: Record<string, string>;
  };
  presets?: Record<string, CustomPresetDef>;
}

export interface CustomPresetDef {
  agency?: string;
  quality?: string;
  scope?: string;
  modifiers?: string[];
  readonly?: boolean;
  contextPacing?: boolean;
}

export interface LoadedConfig {
  config: UserConfig;
  configDir: string; // directory the config file lives in, for resolving relative paths
}

/**
 * Loads config from .claude-mode.json in CWD, falling back to
 * ~/.config/claude-mode/config.json. Returns null if neither exists.
 * Throws on invalid JSON or schema violations.
 */
export function loadConfig(): LoadedConfig | null;

/**
 * Validates the loaded config object. Throws descriptive errors for:
 * - Non-object top-level value
 * - Invalid field types (modifiers must be Record<string, string>, etc.)
 * - Custom preset names that collide with built-in preset names
 * - Custom modifier names that collide with built-in modifier names
 */
function validateConfig(raw: unknown, configPath: string): UserConfig;

/**
 * Resolves a path from the config file relative to the config file's directory.
 * Absolute paths are returned as-is.
 */
export function resolveConfigPath(configDir: string, relativePath: string): string;
```

**Implementation Notes**:
- Config search order: `join(process.cwd(), ".claude-mode.json")` → `join(homedir(), ".config", "claude-mode", "config.json")`
- First found wins — no merging
- `readFileSync` + `JSON.parse` with try/catch — invalid JSON gets: `Invalid config file ${path}: ${parseError.message}`
- Validation checks: top-level is object, `modifiers` values are strings, `axes` sub-objects have string values, `presets` entries have correct shape
- Collision check: config preset names against `PRESET_NAMES`, modifier names against `BUILTIN_MODIFIER_NAMES`

**Acceptance Criteria**:
- [ ] Returns null when no config file exists
- [ ] Loads `.claude-mode.json` from CWD when present
- [ ] Falls back to `~/.config/claude-mode/config.json` when no local config
- [ ] Does not load global config when local config exists
- [ ] Throws descriptive error on invalid JSON
- [ ] Throws on preset name collision with built-in names
- [ ] Throws on modifier name collision with built-in names
- [ ] `resolveConfigPath` resolves relative paths against configDir
- [ ] `resolveConfigPath` returns absolute paths unchanged

---

### Unit 2: Type Changes

**File**: `src/types.ts`

```typescript
// Existing — UNCHANGED (kept for validation helpers)
export const AGENCY_VALUES = ["autonomous", "collaborative", "surgical"] as const;
export type Agency = (typeof AGENCY_VALUES)[number];

export const QUALITY_VALUES = ["architect", "pragmatic", "minimal"] as const;
export type Quality = (typeof QUALITY_VALUES)[number];

export const SCOPE_VALUES = ["unrestricted", "adjacent", "narrow"] as const;
export type Scope = (typeof SCOPE_VALUES)[number];

export const PRESET_NAMES = [
  "create", "extend", "safe", "refactor", "explore", "none",
] as const;
export type PresetName = (typeof PRESET_NAMES)[number];

// NEW: built-in modifier names for collision checking
export const BUILTIN_MODIFIER_NAMES = ["readonly", "context-pacing"] as const;
export type BuiltinModifier = (typeof BUILTIN_MODIFIER_NAMES)[number];

// CHANGED: axis values are now strings (built-in name or absolute path)
export interface AxisConfig {
  agency: string;
  quality: string;
  scope: string;
}

// CHANGED: modifiers gains custom list
export interface ModeConfig {
  axes: AxisConfig | null;
  modifiers: {
    readonly: boolean;
    contextPacing: boolean;
    custom: string[]; // ordered list of absolute paths to custom modifier files
  };
}

// UNCHANGED
export interface EnvInfo { /* ... */ }
export interface TemplateVars { /* ... */ }
export interface AssembleOptions { /* ... */ }
```

**Implementation Notes**:
- `AxisConfig` fields widen from `Agency`/`Quality`/`Scope` to `string`. This is the only breaking type change — all existing code that pattern-matches on axis values (e.g., `agency === "autonomous"`) continues to work because built-in string values haven't changed.
- `BUILTIN_MODIFIER_NAMES` array added for config validation collision checks.
- `ModeConfig.modifiers.custom` is an empty array `[]` by default when no custom modifiers are used.

**Acceptance Criteria**:
- [ ] `BUILTIN_MODIFIER_NAMES` array exists and is exported
- [ ] `AxisConfig` fields accept any string
- [ ] `ModeConfig.modifiers.custom` is `string[]`
- [ ] All existing code compiles with the widened types

---

### Unit 3: Args Parsing Changes

**File**: `src/args.ts`

```typescript
export interface ParsedArgs {
  preset: string | null;  // CHANGED: was PresetName | null
  overrides: {
    agency?: string;   // CHANGED: was Agency
    quality?: string;  // CHANGED: was Quality
    scope?: string;    // CHANGED: was Scope
  };
  modifiers: {
    readonly: boolean;
    print: boolean;
    contextPacing: boolean;
  };
  customModifiers: string[];  // NEW: --modifier values
  forwarded: {
    appendSystemPrompt?: string;
    appendSystemPromptFile?: string;
  };
  passthroughArgs: string[];
}

export function parseCliArgs(argv: string[]): ParsedArgs;
```

**Changes to `parseCliArgs`**:

1. Add `modifier` to parseArgs options: `modifier: { type: "string", multiple: true }`
2. Add `"modifier"` to `knownFlags` set
3. Remove `validateAxisValue` calls — store raw strings for agency, quality, scope overrides
4. First positional is always taken as preset candidate (remove `isPresetName` guard)
5. Extract `customModifiers` from `values.modifier` (array or empty)

```typescript
// Change: first positional is always a preset candidate
let preset: string | null = null;
const remainingPositionals: string[] = [];
for (const pos of positionals) {
  if (preset === null) {
    preset = pos; // always treat first positional as preset
  } else {
    remainingPositionals.push(pos);
  }
}

// Change: raw axis overrides, no validation
const overrides: ParsedArgs["overrides"] = {};
if (values.agency !== undefined) overrides.agency = values.agency as string;
if (values.quality !== undefined) overrides.quality = values.quality as string;
if (values.scope !== undefined) overrides.scope = values.scope as string;

// New: custom modifiers
const customModifiers: string[] = (values.modifier as string[] | undefined) ?? [];
```

**Implementation Notes**:
- The `validateAxisValue` helper function is removed entirely — validation moves to resolve.
- `isPresetName` import is removed from args.ts — preset validation moves to resolve.
- The `ParsedArgs.preset` type widens from `PresetName | null` to `string | null`.

**Acceptance Criteria**:
- [ ] `--modifier ./path.md` populates `customModifiers` with one entry
- [ ] `--modifier a --modifier b` populates `customModifiers` with `["a", "b"]`
- [ ] `--agency ./custom-agency.md` stores raw string in `overrides.agency`
- [ ] `--quality team-standard` stores raw string in `overrides.quality`
- [ ] First positional always stored as `preset` regardless of name
- [ ] `--system-prompt` rejection still works
- [ ] No axis value validation errors in parse stage

---

### Unit 4: Resolve Changes

**File**: `src/resolve.ts`

```typescript
import type { ModeConfig } from "./types.js";
import type { ParsedArgs } from "./args.js";
import type { UserConfig, LoadedConfig } from "./config.js";
import { resolveConfigPath } from "./config.js";
import { getPreset, isPresetName } from "./presets.js";
import { AGENCY_VALUES, QUALITY_VALUES, SCOPE_VALUES, BUILTIN_MODIFIER_NAMES } from "./types.js";
import { resolve as pathResolve, isAbsolute } from "node:path";

export function resolveConfig(
  parsed: ParsedArgs,
  loadedConfig: LoadedConfig | null,
): ModeConfig;
```

**New helper functions** (private, before `resolveConfig`):

```typescript
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
  if ((builtinValues as readonly string[]).includes(raw)) return raw;

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
 * Resolves a modifier reference to an absolute path.
 * Resolution order: built-in modifier name → config-defined name → file path.
 */
function resolveModifier(
  raw: string,
  loadedConfig: LoadedConfig | null,
): { kind: "builtin"; name: string } | { kind: "custom"; path: string } {
  // 1. Built-in modifier
  if ((BUILTIN_MODIFIER_NAMES as readonly string[]).includes(raw)) {
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
```

**Updated `resolveConfig` logic**:

```typescript
export function resolveConfig(
  parsed: ParsedArgs,
  loadedConfig: LoadedConfig | null,
): ModeConfig {
  const config = loadedConfig?.config ?? null;

  // Resolve custom modifiers from --modifier flags
  let readonlyFlag = parsed.modifiers.readonly;
  let contextPacingFlag = parsed.modifiers.contextPacing;
  const customModifierPaths: string[] = [];

  for (const raw of parsed.customModifiers) {
    const resolved = resolveModifier(raw, loadedConfig);
    if (resolved.kind === "builtin") {
      if (resolved.name === "readonly") readonlyFlag = true;
      if (resolved.name === "context-pacing") contextPacingFlag = true;
    } else {
      customModifierPaths.push(resolved.path);
    }
  }

  // Handle "none" preset
  if (parsed.preset === "none") {
    return {
      axes: null,
      modifiers: {
        readonly: readonlyFlag,
        contextPacing: contextPacingFlag,
        custom: customModifierPaths,
      },
    };
  }

  let agency: string;
  let quality: string;
  let scope: string;

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
      readonlyFlag = readonlyFlag || preset.readonly;
    } else if (config?.presets && parsed.preset in config.presets) {
      // Config-defined preset
      const customPreset = config.presets[parsed.preset];
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
      if (customPreset.readonly) readonlyFlag = true;
      if (customPreset.contextPacing) contextPacingFlag = true;

      // Resolve preset's modifiers list
      if (customPreset.modifiers) {
        for (const mod of customPreset.modifiers) {
          const resolved = resolveModifier(mod, loadedConfig);
          if (resolved.kind === "builtin") {
            if (resolved.name === "readonly") readonlyFlag = true;
            if (resolved.name === "context-pacing") contextPacingFlag = true;
          } else {
            // Avoid duplicates — preset modifiers come before CLI modifiers
            if (!customModifierPaths.includes(resolved.path)) {
              customModifierPaths.unshift(resolved.path);
            }
          }
        }
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

  return {
    axes: { agency, quality, scope },
    modifiers: {
      readonly: readonlyFlag,
      contextPacing: contextPacingFlag,
      custom: customModifierPaths,
    },
  };
}
```

**Implementation Notes**:
- Preset modifiers are inserted before CLI modifiers (unshift) so CLI `--modifier` additions come after preset-defined ones in the final prompt.
- `resolveAxisValue` and `resolveModifier` are private module helpers (pattern: defined before their caller, unexported).
- The `PRESET_NAMES` import is still needed for `isPresetName` and error messages.
- `resolveConfig` signature changes — all callers must be updated.

**Acceptance Criteria**:
- [ ] Built-in axis values resolve unchanged (`"autonomous"` → `"autonomous"`)
- [ ] Config-defined axis names resolve to absolute paths
- [ ] File path axis values resolve to absolute paths
- [ ] Unknown axis values throw with config path hint
- [ ] Built-in modifier names (`--modifier readonly`) set boolean flags
- [ ] Config-defined modifier names resolve to absolute paths
- [ ] File path modifiers resolve to absolute paths
- [ ] Unknown modifier names throw with config path hint
- [ ] Config-defined presets resolve correctly with mixed built-in/custom values
- [ ] CLI overrides apply on top of config presets
- [ ] Unknown preset names throw listing both built-in and config presets
- [ ] Preset modifiers come before CLI modifiers in the custom list

---

### Unit 5: Assembly Changes

**File**: `src/assemble.ts`

```typescript
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { join, resolve, isAbsolute } from "node:path";
import { tmpdir } from "node:os";
import type { AssembleOptions, TemplateVars, ModeConfig } from "./types.js";
import { AGENCY_VALUES } from "./types.js";

// CHANGED: handles both relative (built-in) and absolute (custom) fragment paths
export function getFragmentOrder(mode: ModeConfig): string[];

// CHANGED: reads fragments using absolute path detection
export function assemblePrompt(options: AssembleOptions): string;
```

**Updated `getFragmentOrder`**:

```typescript
export function getFragmentOrder(mode: ModeConfig): string[] {
  const fragments: string[] = [
    "base/intro.md",
    "base/system.md",
  ];

  // Axis fragments — skipped for "none" mode
  if (mode.axes) {
    for (const [axis, value] of [
      ["agency", mode.axes.agency],
      ["quality", mode.axes.quality],
      ["scope", mode.axes.scope],
    ] as const) {
      if (isAbsolute(value)) {
        fragments.push(value); // custom absolute path
      } else {
        fragments.push(`axis/${axis}/${value}.md`); // built-in relative path
      }
    }
  }

  fragments.push("base/doing-tasks.md");

  // Actions variant: autonomous only for built-in "autonomous" agency
  const isAutonomous = mode.axes
    && (AGENCY_VALUES as readonly string[]).includes(mode.axes.agency)
    && mode.axes.agency === "autonomous";
  if (isAutonomous) {
    fragments.push("base/actions-autonomous.md");
  } else {
    fragments.push("base/actions-cautious.md");
  }

  fragments.push("base/tools.md");
  fragments.push("base/tone.md");
  fragments.push("base/session-guidance.md");

  // Built-in modifiers
  if (mode.modifiers.contextPacing) {
    fragments.push("modifiers/context-pacing.md");
  }
  if (mode.modifiers.readonly) {
    fragments.push("modifiers/readonly.md");
  }

  // Custom modifiers — after built-in modifiers, before env
  for (const customPath of mode.modifiers.custom) {
    fragments.push(customPath);
  }

  // Environment info — always last
  fragments.push("base/env.md");

  return fragments;
}
```

**Updated `assemblePrompt`**:

```typescript
export function assemblePrompt(options: AssembleOptions): string {
  const { mode, templateVars, promptsDir } = options;
  const fragmentPaths = getFragmentOrder(mode);

  const sections: string[] = [];
  for (const fragPath of fragmentPaths) {
    // Absolute paths are custom fragments; relative paths are built-in
    const fullPath = isAbsolute(fragPath)
      ? fragPath
      : resolve(promptsDir, fragPath);

    let content: string | null;
    try {
      content = readFileSync(fullPath, "utf8");
    } catch {
      content = null;
    }

    if (content === null) {
      throw new Error(`Missing prompt fragment: ${fragPath}`);
    }
    sections.push(content.trim());
  }

  const joined = sections.join("\n\n");
  return substituteTemplateVars(joined, templateVars);
}
```

**Implementation Notes**:
- `readFragment` helper is kept but `assemblePrompt` inlines the logic to handle both path types. Alternatively, `readFragment` can be updated to accept absolute paths — either way is fine.
- `isAbsolute` from `node:path` is the reliable way to distinguish custom from built-in paths.
- Template variable substitution runs over the entire joined prompt including custom fragments (user's choice).
- The `AGENCY_VALUES` import is needed for the actions variant check.

**Acceptance Criteria**:
- [ ] Built-in axis values produce relative paths (`axis/agency/autonomous.md`)
- [ ] Custom axis values (absolute paths) appear as-is in fragment list
- [ ] Custom modifier paths appear after built-in modifiers, before `base/env.md`
- [ ] `assemblePrompt` reads absolute paths directly, relative paths via `promptsDir`
- [ ] Missing custom fragment files throw `Missing prompt fragment: /path/to/file.md`
- [ ] Custom fragments get template variable substitution
- [ ] Custom agency path defaults to cautious actions variant

---

### Unit 6: Orchestrator Changes

**File**: `src/build-prompt.ts`

```typescript
// NEW import
import { loadConfig } from "./config.js";

function main(): void {
  const argv = process.argv.slice(2);

  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    printUsage();
    process.exit(0);
  }

  let parsed;
  try {
    parsed = parseCliArgs(argv);
  } catch (err) {
    process.stderr.write(`Error: ${(err as Error).message}\n`);
    process.exit(1);
  }

  // NEW: load config between parse and resolve
  let loadedConfig;
  try {
    loadedConfig = loadConfig();
  } catch (err) {
    process.stderr.write(`Error: ${(err as Error).message}\n`);
    process.exit(1);
  }

  // CHANGED: pass config to resolveConfig
  let config;
  try {
    config = resolveConfig(parsed, loadedConfig);
  } catch (err) {
    process.stderr.write(`Error: ${(err as Error).message}\n`);
    process.exit(1);
  }

  // ... rest unchanged ...
}
```

**Updated `printUsage`** — add new flags:

```typescript
function printUsage(): void {
  const usage = `Usage: claude-mode [preset] [options] [-- claude-args...]

Presets:
  create          autonomous / architect / unrestricted
  extend          autonomous / pragmatic / adjacent
  safe            collaborative / minimal / narrow
  refactor        autonomous / pragmatic / unrestricted
  explore         collaborative / architect / narrow (readonly)
  none            no behavioral instructions

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
```

**Implementation Notes**:
- Config loading gets its own try/catch so config errors are clearly distinguished from parse errors.
- Resolve also gets its own try/catch (currently it's uncaught — any resolve error would be an unhandled exception). This is a bug fix.
- The error handling pattern is maintained: all catches write to stderr and exit(1).

**Acceptance Criteria**:
- [ ] Config is loaded before resolve
- [ ] Config errors produce clear stderr messages
- [ ] Resolve errors (unknown preset, unknown axis value) produce clear stderr messages
- [ ] Usage text includes `--modifier` flag and config file locations
- [ ] Pipeline works end-to-end: parse → load config → resolve → detect env → assemble

---

## Implementation Order

1. **Unit 2: Type Changes** — Foundation. All other units depend on the new type shapes. Update `types.ts` and fix all compilation errors in existing code (test fixtures need `custom: []` in modifiers).
2. **Unit 1: Config Types and Loader** — New `config.ts` module. No existing code depends on it yet. Can be built and tested in isolation.
3. **Unit 3: Args Parsing Changes** — Remove axis validation, add `--modifier` flag, widen preset type. Tests update to match.
4. **Unit 4: Resolve Changes** — The core logic. Depends on config types, new ParsedArgs shape. Most complex unit.
5. **Unit 5: Assembly Changes** — Handle absolute paths in fragment list. Depends on new ModeConfig shape.
6. **Unit 6: Orchestrator Changes** — Wire everything together. Depends on all previous units.

---

## Testing

### Unit Tests: `src/config.test.ts` (new)

Key test cases:
- Returns null when no config file exists
- Loads and parses valid `.claude-mode.json`
- Throws on invalid JSON
- Throws on wrong types (e.g., modifier value is number not string)
- Throws on built-in preset name collision
- Throws on built-in modifier name collision
- `resolveConfigPath` resolves relative paths correctly
- `resolveConfigPath` returns absolute paths unchanged

Test approach: create temporary config files in a temp directory using `mkdtempSync`, write JSON, call `loadConfig` with a patched CWD or by directly calling internal parse/validate functions with the file path.

### Unit Tests: `src/args.test.ts` (updated)

New/changed test cases:
- `--modifier` flag produces `customModifiers` array
- Multiple `--modifier` flags produce ordered array
- Axis values stored as raw strings (no validation)
- First positional always stored as `preset`
- `--modifier` added to known flags (not passed through)

### Unit Tests: `src/resolve.test.ts` (updated)

New test cases:
- Built-in axis values resolve unchanged
- Config-defined axis names resolve to absolute paths
- File path axis values (`./foo.md`) resolve to absolute paths
- Unknown axis values throw with descriptive error including config hint
- `--modifier readonly` sets readonly flag
- `--modifier context-pacing` sets contextPacing flag
- `--modifier ./custom.md` adds to custom modifier paths
- `--modifier config-name` resolves via config to absolute path
- Config preset resolves with mixed built-in and custom axes
- Config preset modifiers come before CLI modifiers
- CLI overrides apply on top of config presets
- Unknown preset throws listing both built-in and config presets

Base fixture update: add `customModifiers: []` and `custom: []` fields.

### Unit Tests: `src/assemble.test.ts` (updated)

New test cases:
- Fragment list includes absolute paths for custom axis values
- Fragment list includes custom modifier paths before env.md
- `assemblePrompt` reads absolute paths directly
- Missing custom fragment throws descriptive error
- Custom agency defaults to cautious actions variant

Base fixture update: add `custom: []` to modifiers.

### E2E Tests: `src/e2e.test.ts` (updated)

New test cases:
- `claude-mode create --modifier ./test-modifier.md --print` includes custom modifier content
- `claude-mode --quality ./test-quality.md --print` includes custom quality content
- Config-defined preset works end-to-end (create temp `.claude-mode.json`, run CLI)

Test approach: create temp markdown files and a temp config file, pass paths to CLI via `createCliRunner`.

---

## Verification Checklist

```bash
# All tests pass
bun test

# Built-in presets still work
bun run src/build-prompt.ts create --print | head -5
bun run src/build-prompt.ts explore --print | grep "Read-only"

# Custom modifier via path
echo "# Custom Rule" > /tmp/test-modifier.md
bun run src/build-prompt.ts create --modifier /tmp/test-modifier.md --print | grep "Custom Rule"

# Custom axis via path
echo "# Quality: Team Standard" > /tmp/team-quality.md
bun run src/build-prompt.ts --quality /tmp/team-quality.md --print | grep "Team Standard"

# Config-defined preset (create temp config first)
cat > /tmp/test-config/.claude-mode.json << 'EOF'
{
  "presets": {
    "team": {
      "agency": "collaborative",
      "quality": "architect",
      "scope": "adjacent"
    }
  }
}
EOF
cd /tmp/test-config && bun run /path/to/build-prompt.ts team --print | grep "Collaborative"

# Error cases
bun run src/build-prompt.ts --quality unknown-value 2>&1 | grep "Unknown"
bun run src/build-prompt.ts --modifier nonexistent 2>&1 | grep "Unknown"
```
