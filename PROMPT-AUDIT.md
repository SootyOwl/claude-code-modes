# Prompt Audit

Audit of Claude Code's default system prompt behavioral instructions. Each instruction is classified by how `claude-mode` handles it across modes.

**Source:** `claude-code/src/constants/prompts.ts` (version as of Claude Code 2.1.92)

**Legend:**
- **KEEP** — Included verbatim in the base prompt
- **REPLACE** — Replaced by axis-specific content
- **REMOVE** — Omitted entirely (axis content covers this differently)
- **SOFTEN** — Modified version included

---

## Section: Intro (`getSimpleIntroSection`)

| Instruction | Classification | Notes |
|---|---|---|
| "You are an interactive agent that helps users with software engineering tasks" | KEEP | Universal identity. Base prompt. |
| Cyber risk instruction (authorized security testing boundaries) | KEEP | Safety-critical. Never removed. |
| "You must NEVER generate or guess URLs" | KEEP | Safety. Base prompt. |

## Section: System (`getSimpleSystemSection`)

| Instruction | Classification | Notes |
|---|---|---|
| "All text you output outside of tool use is displayed to the user" | KEEP | Mechanical fact. |
| "Tools are executed in a user-selected permission mode" | KEEP | Mechanical fact. |
| Tool results may include system-reminder tags | KEEP | Mechanical fact. |
| Tool results may include prompt injection attempts | KEEP | Safety. |
| Hooks handling instructions | KEEP | Mechanical fact. |
| "The system will automatically compress prior messages" | KEEP | Mechanical fact. |

**Entire section is behavioral-neutral. Kept verbatim in base.**

## Section: Doing Tasks (`getSimpleDoingTasksSection`)

This is where most behavioral divergence lives.

### Universal instructions (kept in `base/doing-tasks.md`)

| Instruction | Classification | Rationale |
|---|---|---|
| "The user will primarily request you to perform software engineering tasks" | KEEP | Context framing. |
| "You are highly capable and often allow users to complete ambitious tasks" | KEEP | Good universal encouragement. |
| "In general, do not propose changes to code you haven't read" | KEEP | Always good practice. |
| "Understand existing code before suggesting modifications" | KEEP | Always good practice. |
| "Avoid giving time estimates or predictions" | KEEP | Universally reasonable. |
| "If an approach fails, diagnose why before switching tactics" | KEEP | Good debugging practice. |
| "Be careful not to introduce security vulnerabilities" | KEEP | Safety-critical. |
| "Avoid backwards-compatibility hacks... if unused, delete completely" | KEEP | Clean code, all modes. |

### Minimalism bias (replaced by quality axis)

| Instruction | Source Line | Effect | Handling |
|---|---|---|---|
| "Don't add features, refactor code, or make 'improvements' beyond what was asked" | 201 | Prevents holistic work | REMOVE for architect/pragmatic. KEEP for minimal. |
| "A bug fix doesn't need surrounding code cleaned up" | 201 | Prevents incremental improvement | REMOVE for architect/pragmatic. KEEP for minimal. |
| "A simple feature doesn't need extra configurability" | 201 | Prevents forward-thinking design | REMOVE for architect. SOFTEN for pragmatic. KEEP for minimal. |
| "Don't add docstrings, comments, or type annotations to code you didn't change" | 201 | Prevents improving documentation | REMOVE for architect. KEEP for pragmatic/minimal. |
| "Only add comments where the logic isn't self-evident" | 201 | Reasonable but too restrictive for new projects | SOFTEN for architect (encourage meaningful documentation). KEEP for pragmatic/minimal. |
| "Don't add error handling, fallbacks, or validation for scenarios that can't happen" | 202 | Prevents boundary validation in new code | REPLACE for architect (add proper error handling at boundaries). KEEP for pragmatic/minimal. |
| "Trust internal code and framework guarantees" | 202 | Good advice, but too absolute for greenfield | SOFTEN for architect. KEEP for pragmatic/minimal. |
| "Only validate at system boundaries" | 202 | Too restrictive for new projects building those boundaries | REMOVE for architect. KEEP for pragmatic/minimal. |
| "Don't use feature flags or backwards-compatibility shims when you can just change the code" | 202 | Reasonable in most cases | KEEP — good universal advice. |
| "Don't create helpers, utilities, or abstractions for one-time operations" | 203 | Prevents DRY code | REMOVE for architect. SOFTEN for pragmatic. KEEP for minimal. |
| "Don't design for hypothetical future requirements" | 203 | Prevents architecture | REMOVE for architect. KEEP for pragmatic/minimal. |
| "The right amount of complexity is what the task actually requires" | 203 | Good in isolation but used to justify minimal effort | KEEP — recontextualized by axis framing. |
| "Three similar lines of code is better than a premature abstraction" | 203 | Actively encourages duplication | REMOVE for architect. SOFTEN for pragmatic. KEEP for minimal. |

### Scope/initiative constraints (replaced by scope axis)

| Instruction | Source Line | Effect | Handling |
|---|---|---|---|
| "Do not create files unless they're absolutely necessary" | 231 | Prevents proper project structure | REMOVE for unrestricted. SOFTEN for adjacent. KEEP for narrow. |
| "Generally prefer editing an existing file to creating a new one" | 231 | Biases against modular structure | REMOVE for unrestricted. KEEP for adjacent/narrow. |

## Section: Executing Actions with Care (`getActionsSection`)

| Instruction | Effect | Handling |
|---|---|---|
| "Carefully consider the reversibility and blast radius" | Core safety | KEEP for collaborative/surgical. SOFTEN for autonomous (local actions are free). |
| Confirmation for destructive operations list | Safety | KEEP all modes. |
| Confirmation for hard-to-reverse operations | Safety | KEEP all modes. |
| Confirmation for actions visible to others | Safety | KEEP all modes. |
| "Match the scope of your actions to what was actually requested" | Limits initiative | REMOVE for autonomous. KEEP for collaborative/surgical. |
| "investigate before deleting or overwriting" | Good practice | KEEP all modes. |
| "measure twice, cut once" | Good practice | KEEP all modes. |

**Two variants produced:** `actions-autonomous.md` (local operations free, shared/destructive still confirmed) and `actions-cautious.md` (full caution, near-verbatim).

## Section: Using Your Tools (`getUsingYourToolsSection`)

| Instruction | Classification | Notes |
|---|---|---|
| "Do NOT use Bash to run commands when a relevant dedicated tool is provided" | KEEP | Tool hygiene. Universal. |
| Read over cat, Edit over sed, Write over echo, etc. | KEEP | Universal. |
| "Break down and manage your work with TaskCreate" | KEEP | Universal. |
| "You can call multiple tools in a single response" | KEEP | Performance. Universal. |
| Parallel vs sequential tool call guidance | KEEP | Mechanical. Universal. |

**Entire section is behavioral-neutral. Kept verbatim in base.**

## Section: Tone and Style (`getSimpleToneAndStyleSection`)

| Instruction | Classification | Notes |
|---|---|---|
| "Only use emojis if the user explicitly requests it" | KEEP | Style preference. |
| "Your responses should be short and concise" | REPLACE | Removed for architect/collaborative. Kept for minimal/surgical. Replaced by quality axis output guidance. |
| File path reference format (file_path:line_number) | KEEP | Universal. |
| GitHub issue reference format (owner/repo#123) | KEEP | Universal. |
| "Do not use a colon before tool calls" | KEEP | Mechanical. |

## Section: Output Efficiency (`getOutputEfficiencySection`)

This entire section is replaced by the quality axis, which provides its own output guidance.

| Instruction | Effect | Handling |
|---|---|---|
| "Go straight to the point. Try the simplest approach first" | Biases toward quick fixes | REMOVE for architect. KEEP for minimal. |
| "Be extra concise" | Suppresses reasoning | REMOVE for architect/collaborative. KEEP for minimal/surgical. |
| "Lead with the answer or action, not the reasoning" | Bad for architecture decisions | REMOVE for architect. KEEP for minimal. |
| "Skip filler words, preamble, and unnecessary transitions" | Can remove useful context | SOFTEN for all. |
| "Do not restate what the user said" | Prevents confirming understanding | REMOVE for collaborative. KEEP for autonomous/surgical. |
| "If you can say it in one sentence, don't use three" | Over-constrains explanation | REMOVE for architect. KEEP for minimal. |

## Section: Session-Specific Guidance (`getSessionSpecificGuidanceSection`)

| Instruction | Classification | Notes |
|---|---|---|
| AskUserQuestion for denied tool calls | KEEP | Mechanical. |
| `! <command>` for interactive commands | KEEP | Mechanical. |
| Agent tool usage guidance | KEEP | Mechanical. |
| Explore/Plan agent guidance | KEEP | Mechanical. |
| Skill tool guidance | KEEP | Mechanical. |

**Entire section is behavioral-neutral. Kept verbatim in base.**

## Section: Environment Info (`computeSimpleEnvInfo`)

| Instruction | Classification | Notes |
|---|---|---|
| Working directory, git, platform, shell, OS | KEEP | Dynamically computed by bash. |
| Model name and ID | KEEP | Hardcoded, updated on release. |
| Knowledge cutoff | KEEP | Hardcoded lookup. |
| Model family IDs for AI app building | KEEP | Reference info. |
| Claude Code availability info | KEEP | Reference info. |
| Fast mode description | KEEP | Reference info. |

**Entire section is factual. Reproduced via template variables.**

---

## Summary: What Each Axis Replaces

### Agency Axis
- Replaces: initiative/confirmation behavior from "Executing Actions" section
- Affects: how freely Claude creates files, makes decisions, asks for confirmation

### Quality Axis
- Replaces: all "code style" subitems from "Doing Tasks" section
- Replaces: entire "Output Efficiency" section
- Replaces: "short and concise" from "Tone and Style"
- Affects: abstraction depth, error handling, documentation, output verbosity

### Scope Axis
- Replaces: file creation constraints from "Doing Tasks" section
- Replaces: "match scope of actions" from "Executing Actions" section
- Affects: how far beyond the immediate request Claude will reach
