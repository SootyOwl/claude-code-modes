# Changelog

## v0.2.3

**Fixes**

- `inspect` subcommand now works in compiled binaries (handles `/$bunfs/` virtual filesystem paths)
- `suspicious-path` regex no longer false-positives on macOS `/private/var` paths

## v0.2.2

**Improvements**

- Refined all three behavioral modifiers (`director`, `methodical`, `debug`) based on prompt quality evaluation against Anthropic emotion research criteria:
  - **director**: Bolder, more confident tone — "you own the outcome" framing, stronger quality-gate language. Added priority hierarchy for when to break from delegation.
  - **methodical**: Added two worked examples showing scoped, step-by-step execution. Added priority line (precision over speed).
  - **debug**: Added second worked example covering partial-findings scenario. Added priority line (understanding over speed).
- All three modifiers now score 10/10 on prompt quality criteria (up from 8-9/10). Zero negative instructions, zero ALL-CAPS markers, calm emotional tone preserved throughout.
- New `bold` built-in modifier — activates confident, idiomatic code output. Counters post-training hedging with capability-affirming framing. Use via `--modifier bold` with any preset.

## v0.2.0

**Breaking Changes**

- `ModeConfig.modifiers` changed from `{ readonly: boolean; contextPacing: boolean; custom: string[] }` to `string[]` — a flat ordered list of modifier fragment paths. Any code constructing or reading `ModeConfig` directly needs updating.

**Features**

- Two new presets: `debug` (collaborative/pragmatic/narrow, chill base) — investigation-first problem solving with evidence gathering and graceful stuck-handling; `methodical` (surgical/architect/narrow, chill base) — step-by-step craftsmanship with explicit stop-when-done behavior
- `director` preset (autonomous/architect/unrestricted, chill base) — delegate implementation to sub-agents, orchestrate and verify results
- Unified modifier model: all built-in modifiers are fragment-based. `--modifier readonly` now works identically to `--readonly`; `--modifier context-pacing` works identically to `--context-pacing`. Adding new built-in modifiers requires only a name in `BUILTIN_MODIFIER_NAMES` plus a `.md` file.
- Preset base support: built-in presets can specify a default base via `PresetDefinition.base`. Priority chain: CLI `--base` > config `defaultBase` > preset `base` > `"standard"`
- Preset modifiers support: built-in presets can include modifiers via `PresetDefinition.modifiers`

## v0.1.3

**Fixes**

- Release workflow: remove broken npm self-upgrade step that prevented npm publish

## v0.1.2

**Fixes**

- npm OIDC publish: add explicit `id-token: write` permission to publish job and upgrade npm before publishing

**Chill base**

- Context pacing baked in by default — no `--context-pacing` flag needed when using `--base chill`
- Added warm, grounding tone: opening affirmation, failures reframed as information, pacing section says "you have time to do this well"
- Actions section opens with permission to act freely, reserves caution for genuinely risky operations

## v0.1.1

**Fixes**

- CI: generate embedded prompts before typecheck step (fixes build failure on fresh checkout)

## v0.1.0

**Features**

- Pluggable base prompt system — `--base <name|path>` flag selects the foundational prompt layer. Built-in bases: `standard` (upstream-derived) and `chill` (emotion-research-informed, ~65% the size, calm framing, worked examples, priority hierarchy)
- Manifest-driven base assembly — bases declare fragment order via `base.json` flat JSON arrays with `"axes"` and `"modifiers"` as reserved insertion points
- `--base` config support — `defaultBase` and `bases` fields in `.claude-mode.json`; preset definitions can specify a default base
- Inspect subcommand — `claude-mode inspect [--print]` shows fragment assembly plan with provenance classification and security warnings
- Config management CLI — `claude-mode config init/show/add-*/remove-*` for managing `.claude-mode.json` without manual JSON editing
- Custom prompt extensibility — custom modifiers, axis values, and presets via config file
- Single binary distribution — compiled Bun binary via `install.sh` with SHA-256 checksum verification
- `cli.ts` entry point — spawns claude directly with inherited stdio; `build-prompt.ts` outputs command string for scripting

**Internal**

- Typed predicates (`isBuiltinBase`, `isBuiltinModifier`, `isPresetName`, `isBuiltinAxisValue`) replacing repeated `as readonly string[]` casts
- Shared `printUsage()` extracted to `usage.ts`
- Config validation helpers (`validateStringRecord`, `validateStringArray`)
- `src/embedded-prompts.ts` gitignored (generated at build/publish time)
- CI: type checking step (`bunx tsc --noEmit`) added before tests
