# Feature: Single-Install Distribution

## Summary

Bundle claude-code-modes into a self-contained package distributable via npm (`bunx claude-code-modes create`) and compiled Bun binaries (GitHub Releases), eliminating the need to clone the repo. Built-in prompt fragments are embedded at build time. The bash wrapper is replaced by TypeScript-native TTY handoff using `Bun.spawn` with inherited stdio, verified to preserve Claude Code's full TUI.

## Requirements

- **Embed built-in prompts**: All 20 built-in `.md` prompt fragments (base/, axis/, modifiers/) are embedded into the binary at build time. Custom prompts from user config still read from disk. Acceptance: `bun build --compile` produces a working binary with no external prompt files needed.
- **Replace bash wrapper with TypeScript**: The `claude-mode` bash script is replaced by a TypeScript entry point that spawns `claude` via `Bun.spawn({stdio: ["inherit", "inherit", "inherit"]})` and forwards signals. Acceptance: Claude Code's TUI works identically — input, cursor, colors, Ctrl+C, `/exit`.
- **Compiled binaries for 4 targets**: `bun build --compile` produces platform-specific binaries: `claude-mode-linux-x64`, `claude-mode-linux-arm64`, `claude-mode-darwin-x64`, `claude-mode-darwin-arm64`. Acceptance: each binary runs on its target platform without Bun installed.
- **npm publishable package**: `package.json` updated with `files`, `description`, `repository`, `keywords`, `bin` pointing to the TypeScript entry point. Acceptance: `bunx claude-code-modes create` launches Claude with the correct system prompt.
- **GitHub Actions release workflow**: Triggered by `v*` tag push. Builds 4 binaries, creates GitHub Release with binaries + checksums, publishes to npm with `--provenance --access public`. Acceptance: pushing a version tag produces a complete release with all artifacts.
- **Version bump script**: A script that bumps version in `package.json`, commits, tags, and pushes — triggering the release workflow. Acceptance: `bun scripts/bump-version.ts patch` bumps 0.1.0 → 0.1.1, commits, tags `v0.1.1`, pushes.
- **curl-pipe-bash install script**: An `install.sh` that detects OS/arch, downloads the correct binary from GitHub Releases, installs to `~/.local/bin/claude-mode`, and updates PATH in shell profiles. Acceptance: `curl -fsSL <url>/install.sh | sh` installs a working `claude-mode` command.

## Scope

**In scope:**
- Prompt embedding (built-in fragments only)
- TypeScript TTY handoff replacing bash wrapper
- `bun build --compile` for 4 platform targets
- `package.json` preparation for npm publishing
- GitHub Actions release workflow (build → release → publish)
- Version bump script
- curl-pipe-bash install script

**Out of scope:**
- Homebrew tap (straightforward addition later)
- Auto-update checker in the CLI
- Monorepo restructuring (single package, no split)
- Windows support
- Removing the bash wrapper from the repo (can coexist for dev convenience)

## Technical Context

- **Existing code**: `assemble.ts` reads fragments from disk via `readFileSync` with paths resolved from `import.meta.dir`. This must be refactored to check an embedded map first, falling back to disk for custom fragments. `build-prompt.ts` is the main entry point; the bash wrapper `claude-mode` orchestrates it and does `exec`.
- **Dependencies**: Zero runtime npm dependencies. Only `@types/bun` as dev dep. CI needs `oven-sh/setup-bun` action. npm publishing needs `NPM_TOKEN` secret.
- **Constraints**: `import.meta.dir` behaves differently in compiled binaries vs source — prompt resolution must not depend on filesystem layout for built-in fragments. The compiled binary must be fully self-contained. npm path requires consumer has Bun installed (acceptable for Claude Code users).

## Open Questions

- **Prompt embedding strategy**: Should built-in prompts be imported via `import with {type: "text"}` (Bun-native, simple) or generated into a TypeScript map at build time (more portable)? Design should evaluate both.
- **npm package name**: Keep `claude-code-modes` or use something shorter? This affects the `bunx` command UX.
- **Bash wrapper fate**: Remove entirely, keep as dev-only convenience, or keep as fallback? The TypeScript entry point replaces its function but the script has been the primary interface.
