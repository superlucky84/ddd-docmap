# Doc-Driven Development

> In this repository, **DDD means Doc-Driven Development**, not Domain-Driven Design.
> 한국어: [METHOD.ko.md](METHOD.ko.md)

Doc-Driven Development is a way to build software with AI coding agents. A small set of
Markdown documents is the single source of truth for context. Agents and chat sessions
come and go, but the documents remember what was asked, what was decided and why, what
was built, and what comes next.

It is a working agreement, not a tool. You can follow it with plain Markdown and any agent.
This repository provides the agent skills that run the workflow and a local map for reading
the documents it produces. The background essay is
[Doc-Driven Development With AI](https://subtleflo.com/2026/2/27/doc-driven-development-with-ai).

## Why documents

- **Context outlasts sessions.** Switching agents or starting a new session loses chat
  context. Files keep it.
- **Write down the why.** Without recorded intent, every later change is a guess.
- **Keep boundaries clear.** Requirements and design stay separate, so implementation
  does not drift from what was asked.
- **Validate continuously.** Phase gates and checklists stop "it kind of works" from
  becoming the norm.
- **Stay the owner.** You make the decisions, verify each phase, and review the code.

## The document set

| Document | Answers | Contains |
| --- | --- | --- |
| `REQUIREMENTS.md` | What are we building? | Scope, success criteria, constraints, assumptions, non-goals |
| `DESIGN.md` | How will we build it? | Architecture, contracts, policies, test strategy, a decision checklist |
| `IMPLEMENT.md` | In what order? | Phases with entry criteria, task checklists, baseline tests, exit criteria, and the current handoff |
| `MANUAL_TEST_CHECKLIST.md` | How do we accept it? | Release-facing manual checks with pass/fail criteria |

Split out extra documents such as `CONTRACTS.md`, `SCHEMA.md`, or `PROTOCOL.md` only when
a contract needs its own specification or a plan grows too large. The handoff is not a
separate file: it is one block in `IMPLEMENT.md`.

## The flow

```text
idea ─► REQUIREMENTS ─► DESIGN ─────────► IMPLEMENT ─────────► code + tests ─► MANUAL_TEST_CHECKLIST
                         DC-1 [x] chosen   Phase 1: entry       evidence per
                         DC-2 [ ] TBD      tasks, tests, exit   phase, docs in sync
           ▲                                                        │
           └──────────── direction changed: update the documents first
```

0. **Requirements.** Talk the idea through with an agent and let it structure the result
   into `REQUIREMENTS.md`. Small projects can start at design.
1. **Design.** Turn requirements into `DESIGN.md`. Every open question becomes a decision
   item such as `DC-1`. It stays `TBD` until you close it with the chosen option and a short
   rationale. Ask the agent for more ambiguities and repeat this two or three times.
2. **Implementation plan.** Split the design into small phases in `IMPLEMENT.md`. Each phase
   has entry criteria, a task checklist, baseline tests, and exit criteria. Near the end,
   add a dedicated **Test Hardening** phase and an **Integration Test** phase.
3. **Extra documents.** Add contract or schema documents only when needed.
4. **Check before coding.** Ask the agent which decisions or documents are still missing.
5. **Implement.** Work one phase at a time. Each phase ends with test evidence, updated
   checklists, and a fresh handoff. You verify the result against the intent, update the
   documents early when the direction changes, and review the code.

### Testing stance

Requirements move during early work, so strict test-first development from day one is
not required. Every phase gets lightweight baseline tests; tests get stronger as the design
settles, and the late hardening and integration phases close the gaps. The more code
agents write, the more those tests are worth, and agents can write them too.

## Writing rules

These are the rules the agent skills follow. Use them when you write by hand too.

- Document before coding non-trivial work. Update the documents before changing a contract
  in code.
- Keep **confirmed requests**, **design proposals**, and **implemented behavior** distinct,
  and make clear which one each statement describes.
- Record each user decision, with its rationale, in every document it affects.
- Leave an unresolved decision as `TBD` until it is explicitly resolved. Never close one
  silently.
- Give requirements, decisions, and manual checks stable IDs such as `RQ-*`, `DC-*`, and
  `M-*`. Follow the existing scheme and never renumber.
- Link every major design decision to at least one validation step.
- Mark a checklist item `[x]` only with evidence. Unfinished items stay open.
- Keep one canonical copy of each contract or plan. Update it rather than writing a new plan.
- Keep the documents resumable: another agent must be able to continue from the documents
  alone.
- Keep one current handoff block: **Done**, **Next**, **Blockers**, and **Latest commit**.
  Replace it when you stop; git keeps the history.
- Ask before destructive data operations, and keep secrets out of git.

## Where documents live

Documents start beside the code they describe:

1. Look for the nearest `docs/` folder or document entry point next to the files being
   changed, then work upward through the module, package, and repository.
2. If nothing suitable exists, create a feature folder near the responsible module and
   record that location in `REQUIREMENTS.md`.
3. When a contract becomes shared, move it to the nearest common parent and link to it
   from the local documents. Leave a reference at the old location.

So a growing project ends up with documents in many places, on purpose:

```text
repo/
  docs/payments/CONTRACTS.md              shared contract
  services/checkout/docs/                 feature documents beside the code
    REQUIREMENTS.md  DESIGN.md  IMPLEMENT.md  MANUAL_TEST_CHECKLIST.md
  web/catalog/docs/
    REQUIREMENTS.md  DESIGN.md
```

Keeping documents close to code makes them easy to find while editing, but hard to see as
a whole. That is why this repository also ships **docatlas**, a local map of every
document in the project.

## Roles

| Role | Does | Skill |
| --- | --- | --- |
| Owner (you) | Supplies intent, makes decisions, verifies each phase, reviews code, unblocks the agent | — |
| Designer | Turns the conversation into the four documents and their decision checklists | `doc-driven-designer-v1` |
| Implementer | Implements one phase at a time with test evidence, synced documents, and a handoff | `doc-driven-implementer-v1` |
| Reviewer | Reviews uncommitted changes read-only against the phase, project rules, or stated intent | `doc-driven-reviewer-v1` |

- The designer runs in the agent that talks to you. As a subagent, it drafts the documents,
  marks open questions `TBD`, and returns the questions instead of waiting.
- The implementer reads sources in this order: your latest instruction, `AGENTS.md` or
  `CLAUDE.md`, then the four documents. When they conflict, it stops and asks.
- At the end of each phase, the implementer asks whether to review the phase or continue.
  It never starts the next phase without your answer, except within a range of phases you
  approved in advance. It does not commit unless you ask.
- The reviewer rates each finding `critical`, `warning`, or `suggestion` and returns
  `APPROVE`, `REQUEST_CHANGES`, or `NEEDS_DISCUSSION`. It never changes files.
- In multi-agent work, the main agent owns the canonical documents and the handoff block.
  Each document has one writer at a time, and parallel subagents get separate file scopes.

The implementer and reviewer run only when you ask for them. The skill files in
[agent-kit/](agent-kit/) are the exact rules.

## Talking to your agent

A few prompts that fit the flow:

- "Use doc-driven-designer-v1. I want to build *X*. Ask me questions, then write
  REQUIREMENTS.md."
- "Which decisions in DESIGN.md are still TBD? Ask me about each one."
- "Before we start coding, check whether any decisions or documents are missing."
- "Use doc-driven-implementer-v1 to implement Phase 1."
- "Review this phase with doc-driven-reviewer-v1."

## Compared with spec-first tools

Spec-first tools such as GitHub Spec Kit and Kiro also put a written specification before
code. Doc-Driven Development puts its weight on a few other things:

- The documents stay after the feature ships and remain the project's memory.
- They live beside the code and move as ownership changes.
- Every statement is marked as confirmed, proposed, or implemented.
- Decisions are a visible checklist, and `TBD` is a normal, tracked state.
- Each phase passes a test gate, and every plan ends with hardening and integration phases.
- The handoff is part of the plan, so any agent or person can resume the work.
- It needs plain Markdown only. The skills install into Claude Code and Codex.

## Tools in this repository

- **Agent kit:** `npx docatlas agents install` installs the designer skill and rule for
  Claude Code and Codex. Add `--all` for the implementer and reviewer.
- **Document map:** `npx docatlas` opens a local map of every document in a project.

Neither is required. The method is Markdown plus the habits above.

## Examples

[examples/sample-shop](examples/sample-shop/) is a small, made-up shop written in English.
Its checkout feature has the complete set of four documents: status labels, a decision
checklist with one `TBD`, phases with Test Hardening and Integration Test, a handoff, and
manual checks with a run log. The other features show partial sets, nested features, and a
shared contract. From the root of a clone, open it with `npx docatlas --root examples/sample-shop`.

docatlas itself is built this way. Its [planning documents](docs/) hold requirements
`RQ-*`, a decision checklist `DC-*`, phases from bootstrap to release with dedicated Test
Hardening and Integration Test phases, and manual checks `M-*`, with the current handoff in
`IMPLEMENT.md`. They are written in Korean. Run `npx docatlas` in a clone of this
repository to explore them.
