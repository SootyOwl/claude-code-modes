# claude-code-modes — Roadmap

Solo AI-assisted build. Phases are chunky — each completable in one session. Full test suite throughout.

---

## Phase 1: Project Scaffold + Base Prompt Fragments

**Goal:** Project compiles and assembles a complete base prompt (the `none` mode) from markdown fragments with dynamic env info.

**Build:**
- `package.json` with bun, typescript config, test setup
- `tsconfig.json`
- `src/types.ts` — Agency, Quality, Scope enums, preset type, CLI args type
- `src/env.ts` — shell exec calls for CWD, git status, platform, shell, OS version, git log
- `src/assemble.ts` — reads markdown fragments from `prompts/`, substitutes `{{VAR}}` template variables, concatenates in order, writes temp file
- `prompts/base/intro.md` — identity + cyber risk (extracted from Claude Code `getSimpleIntroSection`)
- `prompts/base/system.md` — tool permissions, hooks, tags, compression (extracted from `getSimpleSystemSection`)
- `prompts/base/doing-tasks.md` — universal KEEP-only instructions from audit (extracted from `getSimpleDoingTasksSection`)
- `prompts/base/actions-autonomous.md` — softened risky-action guidance
- `prompts/base/actions-cautious.md` — full risky-action guidance (near-verbatim from `getActionsSection`)
- `prompts/base/tools.md` — tool usage preferences (extracted from `getUsingYourToolsSection`)
- `prompts/base/tone.md` — style guidelines, stripped of behavioral items (extracted from `getSimpleToneAndStyleSection`)
- `prompts/base/session-guidance.md` — AskUserQuestion, `!` command, agent tool, skills (extracted from `getSessionSpecificGuidanceSection`)
- `prompts/base/env.md` — template with all `{{VAR}}` placeholders (mirrors `computeSimpleEnvInfo`)
- `prompts/modifiers/context-pacing.md` — the "take your time, pause gracefully" section
- Unit tests: env detection returns expected shapes, assemble reads fragments and substitutes variables correctly, template variables are all replaced (no `{{` remains in output)

**Test checkpoint:** `bun test` — all unit tests pass. `bun run src/assemble.ts` with a mock config produces a complete prompt file with no unresolved template variables. Diff the output against Claude Code's actual system prompt to verify base sections match.

---

## Phase 2: Axis Fragments + Presets

**Goal:** All 9 axis fragments and 5 presets exist. Assembly can produce a mode-specific prompt by combining base + axis selections.

**Build:**
- `prompts/axis/agency/autonomous.md` — high initiative, free local actions, architectural decisions without asking
- `prompts/axis/agency/collaborative.md` — explains reasoning, checks in, confirms before large changes
- `prompts/axis/agency/surgical.md` — minimal blast radius, precise execution
- `prompts/axis/quality/architect.md` — proper abstractions, error handling, forward-thinking, thorough output
- `prompts/axis/quality/pragmatic.md` — match existing patterns, incremental improvement, balanced output
- `prompts/axis/quality/minimal.md` — smallest correct change, concise output (close to current Claude Code defaults)
- `prompts/axis/scope/unrestricted.md` — free to create files, modules, restructure
- `prompts/axis/scope/adjacent.md` — related changes ok, stay in neighborhood
- `prompts/axis/scope/narrow.md` — only what was asked
- `prompts/modifiers/readonly.md` — do not modify files, focus on explanation
- `src/presets.ts` — preset name → axis mapping (new-project, vibe-extend, safe-small, refactor, explore, none)
- Update `src/assemble.ts` to accept axis config + modifiers and select correct fragments
- Unit tests: each preset resolves to correct axis values, assembly with each preset produces a prompt containing expected axis content and not containing content from other axes, `none` mode produces prompt with no axis content, axis override on a preset works

**Test checkpoint:** `bun test` — all tests pass. For each of the 5 presets + `none`, generate the prompt and verify it contains the expected sections in the correct order.

---

## Phase 3: CLI Argument Parser + Prompt Builder Binary

**Goal:** `bun run src/build-prompt.ts new-project --verbose` outputs a complete `claude` command with the right `--system-prompt-file` and passthrough args.

**Build:**
- `src/build-prompt.ts` — main entry point: parse args with `node:util/parseArgs`, resolve preset + overrides, call assemble, write temp file, print full claude command to stdout
- Argument parsing: preset as positional, `--agency`, `--quality`, `--scope` as named flags, `--readonly` as boolean, `--append-system-prompt` and `--append-system-prompt-file` captured for forwarding, `--system-prompt` and `--system-prompt-file` rejected with error, everything else forwarded
- `--` separator support for explicit passthrough
- Default axis values when no preset and incomplete axis specification
- Error handling: invalid preset name, invalid axis value, conflicting flags
- Unit tests: arg parsing produces correct config for all preset/override/passthrough combinations, conflicting flags produce errors, unknown flags are collected for passthrough, `--system-prompt` rejection works
- Integration tests: run `build-prompt.ts` as subprocess, verify stdout is a valid claude command with correct flags

**Test checkpoint:** `bun test` — all tests pass. `bun run src/build-prompt.ts new-project --verbose --model sonnet` prints something like `claude --system-prompt-file /tmp/claude-mode-12345.md --verbose --model sonnet`. The temp file exists and contains the new-project prompt.

---

## Phase 4: Bash Entry Point + End-to-End Testing

**Goal:** `./claude-mode new-project` launches Claude Code with the correct system prompt. Full test suite green. Ready to use.

**Build:**
- `claude-mode` bash script — calls bun to build prompt, `exec`s the output command, traps EXIT for temp file cleanup
- Make executable, add to PATH instructions
- End-to-end tests: run `claude-mode --help` equivalent (or `claude-mode` with no args shows usage), run `claude-mode new-project --print` (a debug flag that prints the assembled prompt instead of launching claude) for each preset and verify output, test that `--readonly` modifier adds readonly content, test `--append-system-prompt` forwarding
- Verify TUI works: manual test that `./claude-mode new-project` actually launches Claude Code's interactive UI

**Test checkpoint:** `bun test` — full suite passes (unit + integration + e2e). Manual verification: run `./claude-mode new-project`, confirm Claude Code launches, type a message, confirm Claude's behavior reflects the new-project posture (willing to create files, thinks architecturally, doesn't suppress reasoning).
