# Intentional Omissions

Content deliberately excluded from `prompts/base/` because it conflicts with the
axis system's quality/scope tuning. These should NOT be flagged as drift.

## doing-tasks.md

The following upstream `dpY` paragraphs are omitted. They impose a single quality
philosophy (minimal/pragmatic) that the quality axis needs to override per-mode.

### 1. File creation restraint
> "Do not create files unless they're absolutely necessary for achieving your goal.
> Generally prefer editing an existing file to creating a new one, as this prevents
> file bloat and builds on existing work more effectively."

**Reason:** The `architect` quality axis encourages creating well-structured files.
The `minimal` axis discourages it. This is axis-controlled.

### 2. No unprompted improvements
> "Don't add features, refactor code, or make 'improvements' beyond what was asked.
> A bug fix doesn't need surrounding code cleaned up. A simple feature doesn't need
> extra configurability. Don't add docstrings, comments, or type annotations to code
> you didn't change. Only add comments where the logic isn't self-evident."

**Reason:** The `architect` quality axis and `unrestricted` scope axis explicitly
encourage broader improvements. The `minimal`/`narrow` axes restrict them.

### 3. No speculative error handling
> "Don't add error handling, fallbacks, or validation for scenarios that can't happen.
> Trust internal code and framework guarantees. Only validate at system boundaries
> (user input, external APIs). Don't use feature flags or backwards-compatibility
> shims when you can just change the code."

**Reason:** The `architect` quality axis values defensive coding. The `pragmatic`
and `minimal` axes align more closely with this upstream guidance.

### 4. No premature abstraction
> "Don't create helpers, utilities, or abstractions for one-time operations. Don't
> design for hypothetical future requirements. The right amount of complexity is what
> the task actually requires — no speculative abstractions, but no half-finished
> implementations either. Three similar lines of code is better than a premature
> abstraction."

**Reason:** Same as above — the quality axis controls this tradeoff.

## How to maintain this file

When a new intentional omission is decided during a sync:
1. Add a numbered entry under the relevant fragment heading.
2. Include the exact upstream text (quoted) so future diffs can match against it.
3. Include a one-line reason explaining why it's excluded.
