---
name: doc-driven-implementer-v1
description: Use only when the user explicitly asks to use doc-driven-implementer. Implements an existing IMPLEMENT.md plan phase by phase with completion gates, test evidence, and doc/handoff synchronization.
metadata:
  short-description: phase-driven implementer
  version: 1.1.0
---

# Doc-Driven Implementer Playbook

## Primary Goal
Implement according to existing design artifacts with predictable phase gates and resumable handoff.

## Source-of-Truth Order
1. User's latest instruction (the caller's brief when running as a subagent)
2. Project agent instructions (`AGENTS.md`, `CLAUDE.md`)
3. `REQUIREMENTS*.md`
4. `DESIGN*.md`
5. `IMPLEMENT*.md`
6. `MANUAL_TEST_CHECKLIST*.md`

If sources conflict, stop and resolve the conflict explicitly with the user.

## Roles in Multi-Agent Work
- **Main agent**: talks to the user, chooses the phase, assigns scopes, asks whether to review at each phase end, writes the handoff block, saves context when requested, and reports to the user.
- **Implementer subagent**: implements the assigned phase or scope, runs its tests, and updates only the documents in its scope. It returns questions and conflicts instead of guessing, never waits for user approval, never starts another phase, and ends by returning the completion report with handoff content.
- **Reviewer subagent**: reviews read-only and returns its report (`doc-driven-reviewer-v1`).
- Give parallel subagents non-overlapping file scopes. Shared documents have one writer at a time.

## Phase Execution Loop (Mandatory)

### 1) Phase Kickoff
- Find the target phase (or named work section) in `IMPLEMENT*.md`.
- Confirm entry criteria and dependencies are satisfied.
- List concrete implementation tasks and baseline tests for the phase.

### 2) Implement
- Make minimal, coherent code changes aligned to that phase only.
- Avoid scope creep into later phases unless needed to unblock this phase.
- If implementation deviates from the design, record the deviation and rationale in the design docs immediately. Ask before a breaking directional change.

### 3) Validate
- Run phase-required tests first, then broader regression tests as needed.
- Capture exact commands and outcomes.

### 4) Sync Documents
- Update `IMPLEMENT*.md` phase checklist status (`[ ]` -> `[x]`) for completed items only.
- Record unresolved items clearly (do not silently skip).
- If behavior changed materially, sync corresponding `DESIGN*.md` and `README.md` sections.

### 5) Handoff Update
- Replace the current handoff block instead of appending a new one:
  - `Done`
  - `Next`
  - `Blockers`
  - `Latest commit` (`not committed yet` allowed)

### 6) Context Save (Optional)
- Save branch context with `ctxbin ctx save` only when the user or project instructions ask for it, using sections `summary`, `decisions`, `open`, `next`, and `risks`.

### 7) Report and Ask
- Report phase completion with changed files, tests, and doc-sync summary.
- Ask the user whether to review this phase with `doc-driven-reviewer-v1` or continue to the next phase. Skip the question when the user already decided, for example by asking for a review of every phase or by approving a range of phases without review.
- Never start a review or the next phase without the user's answer, except within a range the user approved in advance. Stop at the end of that range or at the first blocker.

### 8) Review (When Chosen)
- Run `doc-driven-reviewer-v1` as a separate agent on the phase's uncommitted changes. Pass it the phase, intended changes, and test evidence.
- Fix `critical` findings, re-validate, and review once more. If criticals remain, report them as blockers.
- Update the docs and handoff for the fixes, and carry unresolved `warning` findings into the handoff as follow-ups or `TBD`.
- Report the review result, then pause for approval before the next phase.

## Non-Negotiable Rules
- Never mark a phase done without test evidence.
- Never move to the next phase without user acknowledgment (an approved range counts).
- Never start a review without the user's answer.
- Never leave code/docs out of sync at a phase boundary.
- Never create git commits unless the user explicitly asks.
- Never perform destructive actions without explicit confirmation.

## Recommended Completion Report Template
- `Phase`: <name>
- `Code`: <what changed>
- `Tests`: <commands + results>
- `Review`: <verdict + open findings, or `not run`>
- `Docs`: <files updated>
- `Handoff`: <done/next/blockers/commit>
- `Status`: `waiting for user: review this phase or continue`
