# claude-mode

A CLI wrapper that launches [Claude Code](https://docs.anthropic.com/en/docs/claude-code) with behaviorally-tuned system prompts. Instead of one-size-fits-all defaults, choose how Claude approaches your task.

## The Problem

Claude Code's default system prompt is a compromise. Instructions that make Claude careful and minimal during a surgical bug fix actively prevent it from building proper abstractions in a new project. Instructions that suppress verbose output hurt exploration sessions.

`claude-mode` replaces the behavioral layer of the system prompt while preserving everything else — tool instructions, security guidelines, environment info — intact.

## Quick Start

```bash
# Clone and install
git clone https://github.com/nklisch/claude-mode.git
cd claude-mode
bun install

# Use a preset
./claude-mode new-project      # Build from scratch with proper architecture
./claude-mode vibe-extend      # Extend a fast-built project, improve incrementally
./claude-mode safe-small       # Surgical precision, minimal risk
./claude-mode refactor         # Restructure freely across the codebase
./claude-mode explore          # Read-only — understand code without changing it
./claude-mode none             # No behavioral opinions — bring your own via CLAUDE.md

# Symlink into PATH for global access
ln -s "$(pwd)/claude-mode" ~/.local/bin/claude-mode
```

## Presets

| Preset | Agency | Quality | Scope | Use when... |
|---|---|---|---|---|
| `new-project` | autonomous | architect | unrestricted | Building from scratch — proper structure and abstractions |
| `vibe-extend` | autonomous | pragmatic | adjacent | Extending agent-coded projects — improve quality as you go |
| `safe-small` | collaborative | minimal | narrow | Surgical changes to production code |
| `refactor` | autonomous | pragmatic | unrestricted | Move files, consolidate modules, improve patterns |
| `explore` | collaborative | architect | narrow | Read, explain, suggest — no file modifications |
| `none` | — | — | — | Strip all behavioral instructions, use your own |

## The Axis Model

Presets are shortcuts. Underneath, behavior is composed from three independent axes:

**Agency** — How much initiative?
- `autonomous` — Makes decisions, creates files, restructures without asking
- `collaborative` — Explains reasoning, checks in at decision points
- `surgical` — Executes exactly what was asked, nothing more

**Quality** — What code standard?
- `architect` — Proper abstractions, error handling, forward-thinking structure
- `pragmatic` — Match existing patterns, improve incrementally
- `minimal` — Smallest correct change, no speculative improvements

**Scope** — How far beyond the request?
- `unrestricted` — Free to create, reorganize, restructure
- `adjacent` — Fix related issues in the neighborhood
- `narrow` — Only what was explicitly asked

### Custom Compositions

Override any axis from a preset:

```bash
claude-mode new-project --quality pragmatic     # Architect structure, pragmatic code quality
claude-mode safe-small --scope adjacent         # Cautious, but fix nearby issues
```

Or compose from scratch:

```bash
claude-mode --agency autonomous --quality architect --scope narrow
```

Defaults when no preset and incomplete axes: `collaborative / pragmatic / adjacent`.

## Modifiers

```bash
claude-mode new-project --readonly          # Prevent file modifications
claude-mode explore --print                 # Print the assembled prompt (debug)
claude-mode new-project --append-system-prompt "Use Rust, not TypeScript"
```

## Passing Flags to Claude

Everything after `--` goes straight to Claude Code:

```bash
claude-mode new-project -- --verbose --model sonnet
```

## Context Pacing

All modes include instructions that tell Claude it's okay to pause at a natural boundary rather than rushing to finish as context fills up. This addresses a common failure pattern where Claude cuts corners and leaves broken code when approaching context limits.

## How It Works

`claude-mode` is a thin two-layer launcher:

1. **Bash script** (`claude-mode`) — pre-screens for `--help`/`--print`, then `exec`s the resulting claude command for clean TTY ownership
2. **TypeScript binary** (`src/build-prompt.ts`) — parses args, resolves presets + overrides, assembles prompt fragments, detects environment, writes a temp file, outputs the `claude --system-prompt-file` command

The assembled prompt faithfully reproduces Claude Code's non-behavioral system prompt (tool usage, security, environment info, hooks) while replacing behavioral instructions with mode-specific content.

## Requirements

- [Bun](https://bun.sh/) runtime
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) installed and available as `claude`

## Development

```bash
bun test                                          # 106 tests across 8 files
bun run src/build-prompt.ts new-project --print   # Inspect assembled prompt
./claude-mode explore --print | head -20          # Test full e2e pipeline
```

## License

MIT
