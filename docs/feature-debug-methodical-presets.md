# Feature: Debug and Methodical Presets

## Summary

Add two new built-in presets — `debug` and `methodical` — each composed from existing axes plus a new dedicated modifier carrying the unique behavioral shaping. Both default to the `chill` base (overridable via `--base` or config). No new axes needed — the behavioral nuance lives in the modifiers, which are reusable independently of the presets.

## Requirements

### Debug Preset

- **Preset definition**: `debug` maps to `agency: collaborative`, `quality: pragmatic`, `scope: narrow`, `base: chill`, with built-in modifier `debug`.
  - *Acceptance criteria*: `claude-mode debug` launches with collaborative/pragmatic/narrow axes, chill base, and the debug modifier applied. `claude-mode debug --base standard` overrides to standard base. `claude-mode debug --agency autonomous` overrides agency.

- **Debug modifier** (`prompts/modifiers/debug.md`): Behavioral instructions for investigation-first problem solving:
  - Prioritize understanding the root cause before attempting fixes
  - Gather evidence and form hypotheses — read code, check logs, trace data flow
  - When presenting findings, include file paths, line numbers, and concrete evidence the user can verify
  - If a fix is clear, apply it. If not, that's fine — present what you've learned so far
  - When stuck, stop and tell the user: what you've investigated, what you've ruled out, where you think the issue might be, and ask for guidance on where to look next
  - Avoid destructive actions out of frustration — don't delete code, force-reset, or take shortcuts to "make the error go away" without understanding why it's happening
  - *Acceptance criteria*: The modifier content uses calm, confident language (no ALL-CAPS emphasis). It shapes investigation behavior without encoding a rigid workflow. It explicitly addresses the "stuck" case with a graceful exit. Applying `--modifier debug` to any preset adds these instructions.

- **Debug modifier is reusable**: `--modifier debug` works independently of the debug preset.
  - *Acceptance criteria*: `claude-mode create --modifier debug` applies the debug modifier on top of the create preset's axes.

### Methodical Preset

- **Preset definition**: `methodical` maps to `agency: surgical`, `quality: architect`, `scope: narrow`, `base: chill`, with built-in modifier `methodical`.
  - *Acceptance criteria*: `claude-mode methodical` launches with surgical/architect/narrow axes, chill base, and the methodical modifier applied. Axis and base overrides work the same as debug.

- **Methodical modifier** (`prompts/modifiers/methodical.md`): Behavioral instructions for step-by-step craftsmanship:
  - Work through tasks step by step — complete each step before moving to the next
  - Follow the user's instructions precisely. If instructions are ambiguous, ask for clarification rather than interpreting freely
  - Attend to details — formatting, naming, edge cases, test coverage. Take satisfaction in getting the small things right
  - Stay within the boundaries of what was asked. If you notice adjacent improvements, note them but don't act on them
  - When the task is complete, say so and stop. Don't suggest next steps, don't mention tangential improvements, don't keep going
  - *Acceptance criteria*: The modifier uses calm, positive emotional framing ("take satisfaction in thoroughness" rather than "don't rush"). It explicitly addresses the "stop when done" behavior. Applying `--modifier methodical` to any preset adds these instructions.

- **Methodical modifier is reusable**: `--modifier methodical` works independently.
  - *Acceptance criteria*: `claude-mode extend --modifier methodical` applies the methodical modifier on top of the extend preset.

### Preset Base Override

- **Presets can specify a base**: The `PresetDefinition` type and `PRESETS` record in `presets.ts` gain an optional `base` field. When present, it sets the default base for that preset (overridable by `--base` CLI flag or config `defaultBase`).
  - *Acceptance criteria*: `getPreset("debug").base` returns `"chill"`. The resolve step uses the preset's base as a fallback in the priority chain: CLI `--base` > config `defaultBase` > preset base > `"standard"`.

- **Existing presets unaffected**: Built-in presets that don't specify a base continue defaulting to `"standard"` (or whatever config says).
  - *Acceptance criteria*: `getPreset("create").base` returns `undefined`. `claude-mode create` without `--base` or config still uses standard.

### Integration

- **Usage text updated**: `printUsage()` in both `cli.ts` and `build-prompt.ts` lists debug and methodical in the presets section.
  - *Acceptance criteria*: `claude-mode --help` shows both new presets with brief descriptions.

- **Inspect shows modifiers**: `claude-mode inspect debug` shows the debug modifier in the fragment list with correct provenance.
  - *Acceptance criteria*: Inspect output includes the debug modifier fragment labeled as `built-in`.

## Scope

**In scope:**
- Two new presets (`debug`, `methodical`) added to built-in presets
- Two new modifiers (`debug.md`, `methodical.md`) in `prompts/modifiers/`
- Optional `base` field on `PresetDefinition` 
- Resolve step updated to include preset base in priority chain
- Usage text updates
- Embedded prompts regenerated to include new modifiers
- Tests for new presets, modifiers, and preset-base resolution

**Out of scope:**
- New axes (the feature intentionally avoids adding a fourth axis)
- Changes to existing preset definitions
- Config CLI commands for managing built-in modifiers (they're built-in, not config-managed)
- Changes to the debug/methodical modifier content based on user testing (iterate later)

## Technical Context

- **Existing code**: `src/presets.ts` defines `PresetDefinition` and `PRESETS` record. `src/types.ts` defines `PRESET_NAMES` and `BUILTIN_MODIFIER_NAMES`. `src/resolve.ts` already resolves preset base via `customPreset.base` for config-defined presets — built-in presets need the same path. `scripts/generate-prompts.ts` embeds modifier files.
- **Dependencies**: Depends on the base design system feature (the `base` field on `ModeConfig` and the chill base). No external dependencies.
- **Constraints**: Modifier content should follow chill base principles — no ALL-CAPS, calm/confident framing, positive language where possible. The modifiers are behavioral shaping, not encoded workflows — they should be short (under ~200 words each).

## Open Questions

- **Preset base priority**: The design doc says CLI `--base` > preset base > config `defaultBase` > "standard". But what about config `defaultBase`? Should config `defaultBase` override preset base, or should preset base take priority over config? The user said "default to chill, allow overriding via flags or config" — this suggests: CLI `--base` > config `defaultBase` > preset base > "standard".
- **BUILTIN_MODIFIER_NAMES collision**: The new modifiers are built-in but they're also preset-specific. Should "debug" and "methodical" be added to `BUILTIN_MODIFIER_NAMES` (preventing config from defining a modifier with those names)? Probably yes for consistency.
- **Preset modifiers in PresetDefinition**: Currently built-in `PresetDefinition` only has `axes` and `readonly`. Config-defined `CustomPresetDef` has `modifiers`. Should `PresetDefinition` gain a `modifiers` field, or should the resolve step special-case debug/methodical?
