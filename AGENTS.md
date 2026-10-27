# Project guidance

DDD means **Doc-Driven Development** in this project.

## Read first

1. docs/REQUIREMENTS.md
2. docs/DESIGN.md
3. docs/IMPLEMENT.md
4. docs/MANUAL_TEST_CHECKLIST.md

## Documentation workflow

Use the locally installed doc-driven-designer-v1 skill for requirements and design work.
Keep these four files as the canonical plan and update them before changing a contract.
Each implementation phase needs baseline validation and exit criteria; retain dedicated
Test Hardening and Integration Test phases. Keep confirmed requests, design proposals,
and implemented behavior distinct. Record user decisions in all affected documents.

Keep requirements, decisions, implementation phases, and acceptance checks aligned.
Track unresolved decisions explicitly as TBD. Distinguish proposed behavior from
implemented behavior, and preserve a clear handoff with completed work, next steps,
blockers, and the latest known commit.

## Source and checks

- bin/ contains the executable entry point; src/ contains implementation modules.
- Use JavaScript ES modules with two-space indentation and semicolons.
- Run npm run check and npm test for collector changes, and npm pack --dry-run when package contents change.
- src/collector/ is independent of the CLI, server, and browser UI.
- src/server/ serves only indexed documents and fixed src/web/ assets on loopback.
- Preserve foreground ownership and clean SIGINT/SIGTERM shutdown.
- Run npm run test:browser for UI changes; DOCMAP_BROWSER_CHANNEL=chrome uses installed Chrome.
- Markdown source view is Phase 2; formatted rendering and link navigation belong to Phase 3.
- Introduce behavior tests with the document scanner and other functional modules.
- Use synthetic, redistributable fixtures for examples and tests.
- Preserve the target project's original documents and resolve links relative to them.
- Prefer locally installed skills. Use ctxbin only when the user explicitly requests it.

