---
name: doc-driven-designer-v1
description: Use when a user wants help capturing requirements and co-producing design and implementation documentation before or during development. Build and maintain REQUIREMENTS.md, DESIGN.md, IMPLEMENT.md, and MANUAL_TEST_CHECKLIST.md with explicit decision checklists, phased plans, and test gates that support multi-agent handoff.
metadata:
  short-description: documentation-first designer
  version: 1.1.0
---

# Doc-Driven Designer Playbook

## Primary Goal
Translate user requirements into a maintainable document set that guides implementation and survives agent handoff.

## Working With the User
- Capture intent, constraints, and priorities before proposing solutions. Ask instead of guessing when the answer changes scope or a contract.
- Document before coding for non-trivial work, and keep the plan visible and reviewable.
- Design is a conversation with the user, so run this playbook in the agent that talks to the user (normally the main agent). If invoked as a subagent, draft the documents, mark open questions as `TBD`, and return the questions to the caller instead of waiting for answers.

## Documentation Discovery and Placement

- Respect the user's chosen location and repository conventions. Otherwise, start beside the files being changed: inspect the nearest relevant `docs/` or document entrypoint, then work upward through the module, section, package, and repository. Follow existing references to find the canonical documents before creating a new set.
- If no suitable documents exist, create a feature-specific directory near the module or section responsible for the change. Record the chosen document location and related code scope in `REQUIREMENTS.md` so another agent can find them.
- Let placement evolve with the work. When content becomes shared across groups or sections, move the shared contract to the nearest suitable common parent documentation location. Keep module-specific requirements and policies near their code and link to the shared contract; sharing an API alone does not require moving every document.
- Consider consolidating the complete document set when the work needs unified documentation or the user requests it. Choose the location from its actual ownership and scope; package-level `docs/<feature>/` and layouts such as `core/`, `article/`, or `home/` are options, not mandatory starting structures.
- Maintain one canonical copy of each contract or plan. When moving documents upward, leave references at their former locations and link shared and local documents so code-adjacent discovery still works.
- On relocation, update and verify local links, commands, samples, scripts, and test input paths that depend on the old location. Preserve paths referring to files inside historical commits and retain recorded validation results as history.

## Standard Artifact Flow
1. Update `REQUIREMENTS.md`.
   - Capture scope, constraints, assumptions, and non-goals.
   - Record migration/data concerns when relevant.
2. Update `DESIGN.md`.
   - Define architecture, contracts, integration boundaries, and operational policies.
   - Manage open decisions as checkboxes (e.g., `DC-*`, `IC-*`) and close each one with the chosen option and its rationale.
3. Update `IMPLEMENT.md`.
   - Split work into phases with entry criteria, implementation checklist, baseline tests, and exit criteria.
   - Include late-stage **Test Hardening** and **Integration Test** phases.
4. Update `MANUAL_TEST_CHECKLIST.md`.
   - Define release-facing manual checks and pass/fail criteria.

## Working Rules
- Keep language direct and measurable.
- Prefer updating existing canonical docs over creating duplicate plans.
- Update the documents before changing a contract in code.
- Keep confirmed requests, design proposals, and implemented behavior distinct, and make clear which one each statement describes.
- Record each user decision, with its rationale, in every document it affects.
- Treat unresolved decisions as `TBD` until explicitly resolved.
- Use stable IDs (e.g., `RQ-*`, `DC-*`, `M-*`) for new requirements, decisions, and manual checks, following any existing scheme; do not renumber existing items.
- Link major design decisions to at least one validation step.
- Require explicit confirmation for destructive data operations, and keep secrets out of git.

## Multi-Agent Rules
- Each document has one writer at a time. In multi-agent work, the main agent owns the canonical documents and the handoff block; subagents edit documents only within the scope they are given and return proposed changes for anything else.

## Handoff Rules
- Keep docs resumable at all times; another agent must be able to continue from the docs alone.
- Keep one current handoff block (in `IMPLEMENT.md` unless the project chose another place) and replace it when stopping work: completed items, next step, blockers, and latest commit SHA. Git keeps the earlier versions.
- Do not reorganize existing handoff history unless the user asks. When asked, move superseded notes and old verification logs into a history file (e.g., `docs/handoff/`).

## Phase Completion
- When an implementation phase from these documents is finished and a reviewer such as `doc-driven-reviewer-v1` is available, ask the user whether to review the phase's changes or continue to the next phase. Skip the question when the user already decided, and never start a review without the user's answer.

## Completion Criteria
Consider planning complete only when:
- All four artifacts are aligned and non-contradictory.
- Decision checklists are resolved or clearly tracked.
- Each implementation phase has entry criteria, baseline tests, and exit criteria.
- Hardening and integration test phases are present.
