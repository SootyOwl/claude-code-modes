# Fragment Map

Maps each local file to its upstream counterpart in the extracted system prompt.

## How to use

The **Marker** column contains a unique string that appears in the upstream function
body. Search the extracted file for this marker to find the right section. The
**Function** column is the minified name as of the last validated version — it will
change between releases but the marker should remain stable.

## Prompt fragments

| Local file | Upstream section | Marker | Function (v2.1.92) | Expected diff |
|---|---|---|---|---|
| `prompts/base/intro.md` | Intro | `an interactive agent that helps users` | `UpY` | Verbatim match |
| `prompts/base/system.md` | System Rules | `# System` | `QpY` | Verbatim match |
| `prompts/base/doing-tasks.md` | Doing Tasks | `primarily request you to perform software engineering tasks` | `dpY` | Intentional omissions (see intentional-omissions.md) |
| `prompts/base/actions-cautious.md` | Executing Actions with Care | `Carefully consider the reversibility and blast radius` | `cpY` | Verbatim match |
| `prompts/base/actions-autonomous.md` | — | — | — | Project-original, no upstream equivalent |
| `prompts/base/tools.md` | Using Your Tools | `Do NOT use the ${e7} to run commands` | `lpY` | Verbatim match (after variable substitution) |
| `prompts/base/tone.md` | Tone and Style | `Only use emojis if the user explicitly requests it` | `apY` | Verbatim match |
| `prompts/base/session-guidance.md` | Session Guidance | `Session-specific guidance` | `rpY` | Local version is more detailed (static vs dynamic) |
| `prompts/base/env.md` | Environment Info | `You have been invoked in the following environment` | `glK` | Local additions: gitStatus block, tool-result note |

## Model metadata (env.ts)

| Local location | What | Upstream location | How to find |
|---|---|---|---|
| `src/env.ts:35` MODEL_NAME | Display model name | Near model ID mapping | Search for the human-readable name near opus/sonnet strings |
| `src/env.ts:36` MODEL_ID | Model identifier | `eO7` object or similar | Search for `claude-opus-4` pattern |
| `src/env.ts:37` KNOWLEDGE_CUTOFF | Knowledge cutoff date | `FlK` function or similar | Search for month/year strings near model ID conditionals |

## Notes

- **Marker stability:** Markers are chosen from natural-language prompt text that's
  unlikely to change between versions. If a marker stops matching, the upstream
  section was likely rewritten — investigate manually.
- **Function names change every release.** Don't rely on them. Use the markers.
- **Variable substitution:** Upstream uses minified names like `${e7}` for "Bash",
  `${H9}` for "Grep", etc. When comparing, treat these as equivalent to the
  spelled-out tool names in local files.
