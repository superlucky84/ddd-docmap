# docatlas

**The home of Doc-Driven Development:** a documentation-first workflow for building software
with AI coding agents, the agent skills that run it, and a local map of the documents it produces.

> **DDD here means Doc-Driven Development**, not Domain-Driven Design.

![docatlas showing a project's document map beside a design document](https://raw.githubusercontent.com/superlucky84/docatlas/main/.github/assets/document-map.png)

## What is Doc-Driven Development?

Agents and chat sessions forget; files do not. In Doc-Driven Development, four Markdown
documents are the single source of truth for context, so any agent or person can continue
the work from the documents alone.

| Document | Holds |
| --- | --- |
| `REQUIREMENTS.md` | What to build: scope, success criteria, constraints, non-goals |
| `DESIGN.md` | How to build it: architecture, contracts, and a decision checklist (`DC-1`, `DC-2`, …) |
| `IMPLEMENT.md` | In what order: phases with entry criteria, baseline tests, exit criteria, and the current handoff |
| `MANUAL_TEST_CHECKLIST.md` | How to accept it: release-facing checks with pass/fail criteria |

- Write the documents first, and update them before changing a contract in code.
- Close each decision with a written rationale; anything undecided stays visibly `TBD`.
- Build in phases with test evidence, and keep one current handoff so another agent can resume.

Use as much of it as a project needs; small fixes can skip the documents. See
[Apply it to a project](https://github.com/superlucky84/docatlas/blob/main/METHOD.md#apply-it-to-a-project).

**Isn't this spec-driven development?** It includes spec-driven work, but the center is
different: the whole document set and how it is managed over time, not the spec alone.
See [how they differ](https://github.com/superlucky84/docatlas/blob/main/METHOD.md#is-this-spec-driven-development).

Read the full method in [METHOD.md](https://github.com/superlucky84/docatlas/blob/main/METHOD.md)
(한국어: [METHOD.ko.md](https://github.com/superlucky84/docatlas/blob/main/METHOD.ko.md)).

## What's in this repository

| Part | What it is | Start with |
| --- | --- | --- |
| The method | The workflow and its writing rules | [METHOD.md](https://github.com/superlucky84/docatlas/blob/main/METHOD.md) |
| Agent kit | Designer, implementer, and reviewer skills and rules for Claude Code and Codex | `npx docatlas agents install` |
| Document map | A local browser view of every document in a project | `npx docatlas` |
| Example | A made-up shop with a complete document set, shown in the screenshot above | [examples/sample-shop](https://github.com/superlucky84/docatlas/tree/main/examples/sample-shop) |

## Quick start

You need Node.js 22+ and npm.

1. Install the designer skill and rule for Claude Code and Codex:

   ```sh
   npx docatlas agents install --dry-run   # preview; writes nothing
   npx docatlas agents install
   ```

2. In a new agent session, start with the designer:

   > Use doc-driven-designer-v1. I want to build … Ask me questions, then write REQUIREMENTS.md.

3. Open the map of your project's documents:

   ```sh
   cd /path/to/project
   npx docatlas
   ```

## Agent roles

| Skill and rule | Role | Installed by default |
| --- | --- | --- |
| `doc-driven-designer-v1` | Co-writes the four documents with you and turns open questions into decisions | Yes |
| `doc-driven-implementer-v1` | Implements one phase at a time with test evidence, synced documents, and a handoff | With `--all` or `--only` |
| `doc-driven-reviewer-v1` | Reviews uncommitted changes read-only and returns a severity-ranked report | With `--all` or `--only` |

Install options, update behavior, and the exact rules are in [agent-kit/](agent-kit/).

## Document map

Documents live beside the code they describe and keep growing. Agents can write and tidy them,
but to tell an agent what to keep, merge, or remove, you need to know where the documents are and
what they say. The document map shows them all on one local page, for people.

Run it from a project root. The project needs no build or package installation:

~~~sh
cd /path/to/project
npx docatlas
~~~

| Option | Effect |
| --- | --- |
| `--root <directory>` | Select the project root; default is the current directory. |
| `--docs-dir <directory>` | Add a document directory; repeatable. |
| `--all-md` | Select all `.md` candidates. |
| `--no-open` | Print the local address without opening a browser. |
| `--help`, `-h` | Show options and configuration guidance. |
| `--version`, `-v` | Show the version actually running. |

Keep the terminal open; Ctrl+C stops the server. It runs on macOS, Windows, and Linux; see
[Windows, Linux, and WSL](https://github.com/superlucky84/docatlas/blob/main/guide/platforms.md)
for commands and verification status. Local installs, reading, search, live updates, and the
collector API are in the
[document map guide](https://github.com/superlucky84/docatlas/blob/main/guide/document-map.md).

## Configuration

Docatlas works without configuration. To add document folders, exclude paths, rename groups, or
keep old links working after moving a document, see the
[configuration guide](https://github.com/superlucky84/docatlas/blob/main/guide/configuration.md).

## Learn more

| Topic | Where |
| --- | --- |
| The method, in English and Korean | [METHOD.md](https://github.com/superlucky84/docatlas/blob/main/METHOD.md) · [METHOD.ko.md](https://github.com/superlucky84/docatlas/blob/main/METHOD.ko.md) |
| The background essay | [Doc-Driven Development With AI](https://subtleflo.com/2026/2/27/doc-driven-development-with-ai) |
| Using the document map | [guide/document-map.md](https://github.com/superlucky84/docatlas/blob/main/guide/document-map.md) |
| Configuration and document locations | [guide/configuration.md](https://github.com/superlucky84/docatlas/blob/main/guide/configuration.md) |
| Windows, Linux, and WSL | [guide/platforms.md](https://github.com/superlucky84/docatlas/blob/main/guide/platforms.md) |
| Agent skills and install options | [agent-kit/README.md](agent-kit/README.md) |
| A complete example project | [examples/sample-shop](https://github.com/superlucky84/docatlas/tree/main/examples/sample-shop) |
| This project's own planning documents (Korean) | [docs/](https://github.com/superlucky84/docatlas/tree/main/docs) · [AGENTS.md](https://github.com/superlucky84/docatlas/blob/main/AGENTS.md) |
| Development and tests | [CONTRIBUTING.md](https://github.com/superlucky84/docatlas/blob/main/CONTRIBUTING.md) |
| Release notes | [CHANGELOG.md](https://github.com/superlucky84/docatlas/blob/main/CHANGELOG.md) |

docatlas is developed with its own method: clone this repository and run `npx docatlas` in it
to explore its planning documents, or `npx docatlas --root examples/sample-shop` for the example.

## License

[MIT](LICENSE). Copyright (c) 2026 superlucky84.
