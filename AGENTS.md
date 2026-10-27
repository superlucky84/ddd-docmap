# Project guidance

DDD means **Doc-Driven Development** in this project.

## Read first

1. docs/REQUIREMENTS.md
2. docs/DESIGN.md
3. docs/IMPLEMENT.md
4. docs/MANUAL_TEST_CHECKLIST.md

Keep requirements, decisions, implementation phases, and acceptance checks aligned.
Track unresolved decisions explicitly as TBD. Distinguish proposed behavior from
implemented behavior, and preserve a clear handoff with completed work, next steps,
blockers, and the latest known commit.

## Source and checks

- bin/ contains the executable entry point; src/ contains implementation modules.
- Use JavaScript ES modules with two-space indentation and semicolons.
- Run npm run check for the scaffold and npm pack --dry-run when package contents change.
- Introduce behavior tests with the document scanner and other functional modules.
- Use synthetic, redistributable fixtures for examples and tests.
- Preserve the target project's original documents and resolve links relative to them.
- Prefer locally installed skills. Use ctxbin only when the user explicitly requests it.

