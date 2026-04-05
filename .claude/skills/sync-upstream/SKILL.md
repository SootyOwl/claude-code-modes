---
name: sync-upstream
description: >
  Compare project base prompts and model metadata against a new Claude Code
  release. Extracts upstream system prompt, diffs each fragment, classifies
  changes as intentional omission or drift, and applies approved updates.
  Use when user says "sync upstream", "check for drift", "new CC version",
  or runs /sync-upstream.
user-invocable: true
allowed-tools: Bash, Read, Edit, Grep, Glob, Write, AskUserQuestion
---

# Sync Upstream

Compare this project's `prompts/base/` fragments and `src/env.ts` model metadata
against the upstream Claude Code system prompt. Detect drift, present a report,
and apply approved updates.

## When to use

- A new Claude Code version has been released
- You want to verify prompts are still aligned with upstream
- User runs `/sync-upstream` or asks about prompt drift

## Prerequisites

- `scripts/extract-upstream-prompt.ts` exists and runs via `bun run scripts/extract-upstream-prompt.ts [version]`
- Output lands in `upstream-prompts/` (gitignored)
- Fragment mapping is in [references/fragment-map.md](references/fragment-map.md)
- Intentional omissions are in [references/intentional-omissions.md](references/intentional-omissions.md)

## Workflow

### Step 1: Extract

1. Ask the user for the target version, or omit to get latest:
   ```
   bun run scripts/extract-upstream-prompt.ts [version]
   ```
2. Read the output file in `upstream-prompts/` to confirm it extracted successfully.
3. Note the resolved version number from the output filename.

**Checkpoint:** Confirm the version with the user before proceeding.

### Step 2: Diff

For each entry in [references/fragment-map.md](references/fragment-map.md):

1. Read the local file (`prompts/base/<name>.md` or `src/env.ts` lines).
2. Read the upstream extracted file and locate the matching function using the
   **marker string** from the fragment map.
3. Compare the textual content. Ignore:
   - Minified variable names (e.g., `${e7}` vs `Bash`)
   - Template variable syntax (`{{MODEL_NAME}}` vs runtime values)
   - Whitespace-only differences
4. Record the diff status: `unchanged`, `modified`, or `new` (upstream added a section we don't have).

For **env.ts metadata** (MODEL_NAME, MODEL_ID, KNOWLEDGE_CUTOFF):
1. In the extracted upstream, search for the model ID mapping (look for `claude-opus-4`, `claude-sonnet-4` patterns) and knowledge cutoff function (look for `knowledge cutoff` or month/year strings near model ID checks).
2. Compare against the hardcoded values in `src/env.ts:35-37`.

### Step 3: Classify

For each `modified` diff:

1. Check [references/intentional-omissions.md](references/intentional-omissions.md) — if the
   difference is a documented intentional omission, classify as `intentional`.
2. If the local file has content the upstream doesn't, classify as `local-addition`
   (project-specific content we added).
3. Everything else is `drift` — upstream changed and we haven't updated.

For `new` upstream sections, classify as `new-upstream`.

### Step 4: Report

Present findings grouped by classification:

```
## Drift Report: v{old} → v{new}

### No changes (N files)
- intro.md, system.md, ...

### Intentional omissions (N items)
- doing-tasks.md: 4 upstream paragraphs excluded (quality axis handles these)

### Local additions (N items)
- env.md: gitStatus block, tool-result note

### Drift detected (N items)
- tone.md: upstream added new bullet about X
- env.ts: MODEL_ID changed from X to Y

### New upstream content (N items)
- New section "foo" not present in any local fragment
```

For each drift item, show the specific text that changed.

**Checkpoint:** Ask the user which drift items to apply. Present as a multi-select list.

### Step 5: Apply

For each approved change:

1. Edit the corresponding local file to match upstream.
2. For env.ts metadata, update the hardcoded constants.
3. If any new upstream sections need a new local fragment, flag this — don't auto-create.

After all edits:

1. Update `CLAUDE.md` — change the "Validated against" version.
2. Update `README.md` — change the version in the "validated against **vX.Y.Z**" text.

**Checkpoint:** Confirm version bump applied. Remind user to review changes and run tests.

## After completion

Suggest the user:
1. Run `bun test` to verify nothing broke
2. Review the diffs with `git diff`
3. Update `references/intentional-omissions.md` if any new intentional omissions were decided
4. Update `references/fragment-map.md` if upstream function names changed

## Maintaining this skill

When the project structure changes:
- **New base fragment added:** Add a row to `references/fragment-map.md`
- **New intentional omission decided:** Add to `references/intentional-omissions.md`
- **Extraction script changes output format:** Update Step 2's instructions
