# Feature: Custom Prompts & Extensibility

## Summary

Users can bring their own prompt fragments — custom modifiers, custom axis values, and custom presets — via CLI flags for one-offs and a config file for reusable setups. This lets teams standardize behavior through version-controlled configs and lets individuals experiment with prompt variations without forking the project.

## Requirements

### Custom modifiers via CLI

- `--modifier <name-or-path>` appends a markdown file to the assembled prompt, in the same position as built-in modifiers (after session-guidance, before env)
- Multiple `--modifier` flags are allowed and applied in order
- Accepts either a file path (`./my-prompt.md`, `/abs/path.md`) or a name defined in the config file (`rust-style`)
- If the value is not a file path and not a name in the config, fail with a descriptive error
- Acceptance: `claude-mode create --modifier ./my-rules.md --print` includes the file's content in the assembled prompt

### Custom axis values via CLI

- `--agency <path>`, `--quality <path>`, `--scope <path>` accept file paths in addition to built-in values
- When a file path is provided, it replaces the built-in axis fragment entirely
- When a name is provided, it resolves against: built-in values first, then config-defined custom values
- Acceptance: `claude-mode --quality ./team-quality.md --print` uses the custom file in place of the quality axis fragment

### Config file

- Loaded from `.claude-mode.json` in the current working directory (project-local)
- Falls back to `~/.config/claude-mode/config.json` (global)
- Project-local is checked first; if found, global is not loaded (no merging)
- File is optional — missing config is not an error
- Invalid JSON or schema violations fail with descriptive errors

### Config file schema

```json
{
  "modifiers": {
    "<name>": "<relative-or-absolute-path-to-md>"
  },
  "axes": {
    "agency": { "<name>": "<path>" },
    "quality": { "<name>": "<path>" },
    "scope": { "<name>": "<path>" }
  },
  "presets": {
    "<name>": {
      "agency": "<built-in-or-custom-name>",
      "quality": "<built-in-or-custom-name>",
      "scope": "<built-in-or-custom-name>",
      "modifiers": ["<built-in-or-custom-name>"],
      "readonly": true
    }
  }
}
```

- All fields are optional (empty config is valid)
- Paths are relative to the config file's directory
- Acceptance: a `.claude-mode.json` with a custom preset is usable via `claude-mode <custom-preset-name>`

### Custom presets in config

- Custom presets appear alongside built-in presets — `claude-mode <name>` works the same way
- Custom preset names must not collide with built-in preset names (`create`, `extend`, `safe`, `refactor`, `explore`, `none`)
- A custom preset can reference:
  - Built-in axis values by name (`"agency": "autonomous"`)
  - Custom axis values by name (`"quality": "team-standard"`, resolved from the same config's `axes` section)
  - Built-in modifiers by name (`"readonly"`, `"context-pacing"`)
  - Custom modifiers by name (`"rust-style"`, resolved from the same config's `modifiers` section)
- CLI axis overrides (`--quality pragmatic`) still work on top of custom presets
- Acceptance: `claude-mode team-default` resolves a custom preset from config with mixed built-in and custom axis values and modifiers

### Custom modifier names in config

- Named modifiers defined in the config can be referenced by:
  - Custom presets' `modifiers` array
  - CLI `--modifier <name>` flag
- Built-in modifier names: `readonly`, `context-pacing`
- Custom modifier names must not collide with built-in modifier names
- Acceptance: `claude-mode create --modifier rust-style` resolves the name from config and includes the file

## Scope

**In scope:**
- `--modifier` CLI flag (repeatable, accepts paths or config names)
- File path support for `--agency`, `--quality`, `--scope` flags
- Config file loading from project-local and global locations
- Config schema: custom modifiers, custom axis values, custom presets
- Config validation with descriptive error messages
- Custom presets composing built-in and custom values
- Resolution order: built-in values first, then config values, then file paths

**Out of scope:**
- Merging project-local and global configs (project-local wins entirely if present)
- Config file creation wizard or scaffolding command
- Template variable support in custom fragments (custom files are included as-is, no `{{VAR}}` substitution)
- Config file format other than JSON (no YAML, TOML)
- Custom base fragment replacement (intro, system, tools, etc.)
- Publishing or sharing configs (npm package, registry)

## Technical Context

**Existing code this touches:**
- `src/types.ts` — `ModeConfig.modifiers` needs to support a list of custom modifier paths; axis values need to accept file paths
- `src/args.ts` — parse `--modifier` (repeatable string flag), detect file paths in axis flags
- `src/resolve.ts` — resolve custom names against config, resolve file paths, validate references
- `src/assemble.ts` — `getFragmentOrder()` and `assemblePrompt()` need to handle custom fragment paths (outside the `prompts/` directory)
- `src/presets.ts` — `isPresetName()` needs to check config-defined presets; `getPreset()` needs config awareness
- `src/build-prompt.ts` — load config before parsing, thread config through the pipeline

**New code needed:**
- `src/config.ts` — config file loading, schema validation, path resolution
- Config type definitions in `types.ts`

**Dependencies:** None (JSON parsing and file reading are Bun built-ins)

**Constraints:**
- No runtime dependencies beyond Bun built-ins (project convention)
- Config loading must not slow down the happy path noticeably (lazy load, fail fast)
- Custom fragment files that don't exist must fail with clear errors at assembly time, not silently skip
- The `prompts/` directory structure and built-in fragments are unchanged

## Open Questions

- Should custom fragments support `{{VAR}}` template variable substitution, or is raw inclusion enough? (Current decision: raw inclusion, but design should evaluate the tradeoff)
- Should the config file support comments (JSONC) for better DX? (Would require a parser change)
- When a custom preset references a custom axis value name, and that name isn't defined in the config, should the error suggest checking the config file path?
- Should `--modifier` flags always append after built-in modifiers, or should there be a way to control ordering?
