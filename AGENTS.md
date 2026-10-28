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
- Render Markdown on the server with raw HTML disabled; keep reference resolution and file policy aligned.
- Preserve source view, heading ids, navigation history, and independent map/reader scroll.
- Serve only registered raster assets and recheck exclusions and symbolic links on every read.
- Keep map/search/content generations coherent; retain the last good index on configuration errors.
- Preserve user navigation, search input, and scroll during automatic refresh; close SSE and watchers on shutdown.
- Introduce behavior tests with the document scanner and other functional modules.
- Use synthetic, redistributable fixtures for examples and tests.
- Preserve the target project's original documents and resolve links relative to them.
- Prefer locally installed skills. Use ctxbin only when the user explicitly requests it.

## Agent kit

- agent-kit/ holds the canonical doc-driven skills and agent rules. Wiki pages and ctxbin entries are copies.
- Agent rule frontmatter has only name and description. A skill's metadata.version equals its manifest item version.
- Keep docatlas-specific markers out of skill and rule files so copied and installed files stay identical.
- When a skill or rule changes, follow agent-kit/README.md: raise versions, move old hashes to previous,
  record new hashes with node scripts/agent-kit.js hash, and run npm run check.
- Update the wiki and ctxbin copies only after the repository change passes checks.
- src/agent-kit/ is independent of the collector, server, and browser UI. Planning never writes files;
  installs never touch documents, AGENTS.md, or CLAUDE.md and never follow symbolic links below a client folder.

