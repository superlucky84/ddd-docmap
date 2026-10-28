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

The core rules:

- Write the documents first, and update them before changing a contract in code.
- Keep confirmed requests, design proposals, and implemented behavior apart.
- Close each decision with a written rationale; anything undecided stays visibly `TBD`.
- Build in phases, each with test evidence. End the plan with Test Hardening and Integration Test phases.
- Keep one current handoff (done, next, blockers, latest commit) so another agent can resume.

Use as much of it as a project needs. Small fixes can skip the documents, and project rules in
`AGENTS.md` or `CLAUDE.md` are optional; see
[Apply it to a project](https://github.com/superlucky84/docatlas/blob/main/METHOD.md#apply-it-to-a-project).

Documents live beside the code they describe and keep growing. Agents write most of them, but
people still need to read, review, and prune them, which is hard across many folders. That is
why this repository also ships a document map for people.

Read the full method in [METHOD.md](https://github.com/superlucky84/docatlas/blob/main/METHOD.md)
(한국어: [METHOD.ko.md](https://github.com/superlucky84/docatlas/blob/main/METHOD.ko.md)) and the background essay
[Doc-Driven Development With AI](https://subtleflo.com/2026/2/27/doc-driven-development-with-ai).

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

The implementer asks after each phase whether to review it or continue, and the reviewer
never changes files. See [Agent skills](#agent-skills) for install details and
[agent-kit/](agent-kit/) for the exact rules.

## Built with its own method

docatlas is developed with Doc-Driven Development, and its planning documents are a working
example. They are currently written in Korean.

- [Requirements](https://github.com/superlucky84/docatlas/blob/main/docs/REQUIREMENTS.md): scope, agreed behavior, and proposed additions.
- [Design](https://github.com/superlucky84/docatlas/blob/main/docs/DESIGN.md): architecture, document model, and open decisions.
- [Implementation plan](https://github.com/superlucky84/docatlas/blob/main/docs/IMPLEMENT.md): phases, validation, and handoff.
- [Manual checks](https://github.com/superlucky84/docatlas/blob/main/docs/MANUAL_TEST_CHECKLIST.md): acceptance scenarios.

Clone this repository and run `npx docatlas` in it to explore them on the map.
For a smaller example in English, open [examples/sample-shop](https://github.com/superlucky84/docatlas/tree/main/examples/sample-shop)
with `npx docatlas --root examples/sample-shop` from the clone. Its checkout feature has the
complete set of four documents.
[AGENTS.md](https://github.com/superlucky84/docatlas/blob/main/AGENTS.md) holds the guidance
coding agents follow here.

## Document map

Find feature documentation spread across a repository, explore its hierarchy,
and read Markdown without losing your place. Run a CLI in a project to open its
local document map:

1. Browse thin horizontal cards arranged by area and feature.
2. Read a short description of each feature.
3. Click a card title to choose its requirements, design, implementation, or manual checks.
4. Read the selected Markdown document beside the map.

The default keeps the server running in the terminal. Press Ctrl+C to stop it.

Projects can have partial document sets, shared contracts, nested features, and
additional documents such as README or research notes. Defaults should work
without rewriting existing documentation; optional configuration can refine
labels, summaries, and discovery.

### Run from a project root

Docatlas uses **the directory where you run the command** as its default project root.
For example, running it in `/path/to/project` reads that project's documents.
Use `--root` to select a different directory.

The target can be a JavaScript, Python, Java/Spring, or other Markdown project.
Your computer needs Node.js 22+ and npm; the target needs no `package.json`,
Python package installation, Maven/Gradle plugin, or application build.

#### Without adding a project dependency

Change into the project you want to explore and run:

~~~sh
cd /path/to/project
npx docatlas
~~~

When Docatlas is not installed in the project, npx can download it to the npm cache
and run it without adding a dependency to the project's package.json. If a matching
local installation exists, npx uses that version.

#### With a project-local installation

For npm projects, install it as a development dependency, then run the local version:

~~~sh
cd /path/to/project
npm install --save-dev docatlas
npx --no-install docatlas
~~~

For pnpm projects:

~~~sh
cd /path/to/project
pnpm add -D docatlas
pnpm docatlas
~~~

These commands keep the package version in the project's manifest and lockfile.
Package managers expose the local `node_modules/.bin/docatlas` command. An ordinary
shell needs that directory on PATH to run a bare `docatlas`.

An optional package script also provides `npm run docatlas` or `pnpm run docatlas`:

~~~json
{
  "scripts": {
    "docatlas": "docatlas"
  }
}
~~~

To try unreleased changes from a source checkout, see
[Try a source checkout](https://github.com/superlucky84/docatlas/blob/main/CONTRIBUTING.md#try-a-source-checkout-in-another-project).

### Options and shutdown

The same options work for one-off and local runs:

~~~sh
npx docatlas --root /path/to/another-project
npx docatlas --no-open
~~~

The CLI prints a loopback URL and opens your default browser. Keep the terminal
open; Ctrl+C stops this server. Separate invocations use separate servers.
With `--no-open`, or if opening a browser fails, open the printed address manually.
Installed users can also pass options to `pnpm docatlas` or `npx --no-install docatlas`.
Earlier `docmap` and `ddd-docmap` command names remain accepted for compatibility.

### Navigate the map

An arrow appears only when a group has child groups. Click it to expand those
children. Click the title to show documents directly in that group. A group with
its own Markdown and child directories supports both actions; a group with only
Markdown has no arrow. Counts describe the group's own documents. Empty directories
are omitted, so an on-disk subdirectory alone does not guarantee an arrow.
On narrow screens, selecting a document switches to its reader, with a button back to the map.

## Reference

### Choose document locations

By default, Docatlas collects `.md` files under every `docs/` directory, including
`docs/DESIGN.md` directly inside it. It also finds `REQUIREMENTS.md`, `DESIGN.md`,
`IMPLEMENT.md`, and `MANUAL_TEST_CHECKLIST.md` elsewhere in the project.
An arbitrary `README.md` outside `docs/` needs an additional location or include rule.

Add project-relative directories without replacing those defaults:

~~~sh
npx docatlas --docs-dir documentation
npx docatlas --docs-dir notes --docs-dir "팀 문서"
npx docatlas --root /path/to/project --docs-dir documentation
~~~

`--docs-dir` is repeatable and adds to the configured `include` rules, or to the
default rules when `include` is absent. Paths are relative to the selected project
root, even with `--root`; they are literal directory names, not glob patterns.
Use `/` separators. Absolute paths and `..` are rejected. A missing, excluded, or
symbolic directory produces a collection notice and does not stop healthy documents.
Creating or deleting an additional directory is reflected while the server runs.

To collect all Markdown in the project:

~~~sh
npx docatlas --all-md
~~~

`--all-md` overrides `include`. Configuration is still validated, and its labels,
redirects, and exclusions still apply. Combining it with `--docs-dir` adds no wider
scope. `--docs-dir .` also selects the project root.

Neither option bypasses exclusions: **`node_modules/` and `.git/` at any depth are
always skipped**, as are symbolic links and paths outside the project. `.gitignore`
rules and configuration `exclude` apply before any include or CLI selection.
Generated directories are excluded at any depth. The default exclusions are:

| Category | Excluded directory names |
| --- | --- |
| Output/cache | `dist`, `build`, `coverage`, `.docatlas`, `.ddd-docmap` |
| Python environments | `.venv`, `venv`, `.tox`, `.nox` |
| Python caches/metadata | `__pycache__`, `.pytest_cache`, `.mypy_cache`, `.ruff_cache`, `.eggs`, `*.egg-info` |
| Java build/dependency caches | `target`, `.gradle`, `.m2` |

The Python and Java rows were added in 0.3.0. They prevent dependency docs,
test environments, and generated copies from appearing in the map or being watched.
Ordinary source folders and names such as `env`, `bin`, `out`, `vendor`,
`target-design`, and `venv-guide` are not excluded.
These are replaceable defaults, not fixed exclusions: an explicit `exclude` array
replaces the entire list. Projects with an existing custom list must add any desired
new patterns themselves. `.git` and `node_modules` remain fixed exclusions.

| Option | Effect |
| --- | --- |
| `--root <directory>` | Select the project root; default is the current directory. |
| `--docs-dir <directory>` | Add a document directory; repeatable. |
| `--all-md` | Select all `.md` candidates. |
| `--no-open` | Print the local address without opening a browser. |
| `--help`, `-h` | Show options and configuration guidance. |
| `--version`, `-v` | Show the version actually running. |

### Configuration

Create optional **`docatlas.config.json`** at the project root.
If it is absent, Docatlas reads the legacy `ddd-docmap.config.json` instead.
When both exist, only the new file is used; fields are not merged. An invalid new
file reports its own error and does not fall back. Releases before 0.2.0 recognized only
the legacy filename. The JSON schema stays version 1.

All paths use `/` and are relative to the project root. Configuration is data-only
JSON; JavaScript configuration and symbolic configuration files are not executed or followed.

| Field | Type and default | Meaning |
| --- | --- | --- |
| `version` | Required number: `1` | Configuration schema version, separate from the npm package version. |
| `include` | Array of glob strings; defaults below | Replaces default inclusion patterns. `[]` selects nothing unless a CLI selection adds it. |
| `exclude` | Array of glob strings; defaults below | Replaces default output exclusions. Fixed exclusions and `.gitignore` still apply. |
| `groups` | Object; `{}` | Keys are directory paths (`.` for root). Values may set a nonempty `title` and a string `summary`. |
| `redirects` | Object; `{}` | Map old `.md` paths to indexed current `.md` paths. |

For example, include `documentation/` alongside the original discovery rules and
give one group a clearer label:

~~~json
{
  "version": 1,
  "include": [
    "**/docs/**/*.md",
    "**/REQUIREMENTS.md",
    "**/DESIGN.md",
    "**/IMPLEMENT.md",
    "**/MANUAL_TEST_CHECKLIST.md",
    "documentation/**/*.md"
  ],
  "exclude": [
    "**/dist/**",
    "**/build/**",
    "**/coverage/**",
    "**/.docatlas/**",
    "**/.ddd-docmap/**",
    "**/.venv/**",
    "**/venv/**",
    "**/__pycache__/**",
    "**/.pytest_cache/**",
    "**/.mypy_cache/**",
    "**/.ruff_cache/**",
    "**/.tox/**",
    "**/.nox/**",
    "**/.eggs/**",
    "**/*.egg-info/**",
    "**/target/**",
    "**/.gradle/**",
    "**/.m2/**",
    "documentation/private/**"
  ],
  "groups": {
    "documentation": {
      "title": "Team documentation",
      "summary": "Shared project contracts and guides."
    }
  },
  "redirects": {
    "docs/old/DESIGN.md": "docs/current/DESIGN.md"
  }
}
~~~

The lists above show the defaults, with `documentation/**/*.md` and
`documentation/private/**` appended as project-specific examples.
Omit either field to retain its defaults. For example,
`{"version":1,"include":["documentation/**/*.md"]}` selects only that directory
unless CLI selections add more. `{"version":1,"include":["**/*.md"]}` selects all
Markdown candidates. To add one excluded directory, repeat
the default exclusions and append yours; `exclude: []` deliberately removes the
default output exclusions, while `node_modules`, `.git`, and ignore rules remain enforced.

Globs match without case sensitivity and support dot-prefixed names. Use positive
patterns without a leading `./` or `!`; absolute paths and `..` are invalid.
The precedence is: fixed exclusions → `.gitignore` → `exclude` →
`--all-md`, or the union of `include` and `--docs-dir`.
No include rule can restore an excluded path.

`groups` changes display labels, not discovery or directory hierarchy. A key with
no collected group produces a notice. `redirects` works in search, document URLs,
and relative Markdown links, including when an old file no longer exists. Valid
chains resolve to one current document; cycles, self references, missing targets,
and excluded paths produce notices. Redirects never expose unindexed documents.

Both configuration filenames are watched. Saving, creating, or deleting one updates
the active configuration while preserving CLI selections. Invalid configuration at
startup exits with an error. During an existing session, it retains the last good
index and displays an update notice until corrected.

### Reading and links

The reader renders tables, fenced code, and read-only task checks, with an outline
and an optional source view. Document links use the original file location.
Browser back/forward restores the reader, source mode, and map positions in the current tab.

Local PNG, JPEG, GIF, WebP, and AVIF images are served after path and exclusion checks.
Raw HTML is displayed as text. SVG and external images show an explanation.
Code, unindexed Markdown, and missing references keep the current document open;
code and attachment paths can be copied. External http/https links open in a separate tab.

### Search and live updates

Search titles, feature names, paths, descriptions, and document text, including code.
Space-separated terms use AND matching; English is case-insensitive and Korean text
is Unicode-normalized. Results include context and highlight matches. Press / to
focus search and Escape to clear it. Search shows at most 50 results with the total count.

Each result shows its full project-relative path as a separate **Show in tree**
button. Click the document title to read it, or click the path to clear the search,
expand its ancestor groups and document list, and scroll/focus that document in the map.
Locating a path preserves the current reader, source mode, reading position, and URL.
On narrow screens it returns to the map. Both actions support keyboard navigation.

The local server watches Markdown, raster images, configuration, and ignore rules.
It uses short polling intervals and batches saves into coherent map/search generations.
The reader preserves its mode and scroll position. Removing the selected document
clears its old body and explains what happened. Invalid configuration retains the
last good index and shows an update notice until fixed. A reconnected tab catches up.
Navigation state stays in each tab's memory.

To keep an old path working after moving a document, register it in
[`redirects`](#configuration) in the project-root configuration.

### Agent skills

The package includes the doc-driven agent skills and rules (designer, implementer, and
reviewer) in [agent-kit/](agent-kit/). `docatlas agents install`, available since 0.3.0,
copies them to the folders that Claude Code and Codex read automatically.

```sh
npx docatlas agents install --dry-run   # preview; writes nothing
npx docatlas agents install             # install the designer skill and rule
```

- The default installs `doc-driven-designer-v1` into your home folder: `~/.claude/skills`,
  `~/.claude/agents`, `~/.agents/skills`, and `~/.codex/agents`, for the clients whose folders exist.
  Add `--all` or `--only <name>` for the implementer and reviewer, `--target` to choose clients, and
  `--project` to install into the project instead. Claude Code uses a global skill before a project
  skill with the same name, and Codex reads project agents only in trusted projects; the command warns
  about both.
- After updating docatlas, run the same command again. Files you edited, files from a newer docatlas,
  and files managed by ctxbin are skipped; `--force` replaces them after saving a backup in
  `~/.docatlas/backups/`. Install records are kept in `~/.docatlas/agents.json`, or in
  `.docatlas/agents.json` for a project install.
- The command never asks questions, so an AI agent can run it for you. It prints one tab-separated
  line per file and exits with 3 when something was skipped. `docatlas agents help` lists every option,
  action, and exit code with the steps an agent should follow.
- It never edits your documents, `AGENTS.md`, or `CLAUDE.md`.

### Windows and other operating systems

Use the same command from a native Windows PowerShell or Command Prompt:

~~~powershell
Set-Location 'C:\work\Spring 프로젝트'
npx docatlas
~~~

If PowerShell blocks the `npx.ps1` launcher, use `npx.cmd docatlas`.
`--root` accepts a native Windows path, including a drive letter and spaces:

~~~powershell
npx docatlas --root 'C:\work\다른 프로젝트' --docs-dir documentation
~~~

Use `/` for `--docs-dir`, JSON paths/globs, and Markdown links on every OS.
The reader and search display project-relative paths with `/`.
If the browser does not open, run `npx docatlas --no-open` and open the printed
loopback address yourself. Keep the terminal open and use Ctrl+C to stop it.

Windows path handling and the browser opener are designed for native Windows.
[Node supports terminal Ctrl+C on Windows](https://nodejs.org/api/process.html#signal-events),
but sending a test subprocess `SIGINT`/`SIGTERM` on Windows forcefully terminates it.
Our injected-signal tests check application cleanup without claiming native console validation.

| Environment | Verification status |
| --- | --- |
| macOS | Local CLI, collector, live updates, browser and installed-package checks pass; exact runs are recorded in the planning documents. |
| Windows | The platform workflow checks native paths, npm launchers and the browser; consult the latest CI run and verification notes. PowerShell/CMD, default-browser opening and physical Ctrl+C also need manual validation. |
| UNC/network drives, WSL, Linux | No support claim from this work; validate separately. |

The declared minimum is Node.js 22. Packaged integration checks pass on Node.js
22.12.0 and 24.22.1 on macOS 15.6.1. Node.js 22.0 and other OSes remain unverified.
The [platform checks](https://github.com/superlucky84/docatlas/blob/main/CONTRIBUTING.md#platform-checks)
describe the macOS and Windows CI.

### Collector API

Collect a project from Node.js without starting a server:

~~~js
import { collectProject } from 'docatlas';

const snapshot = await collectProject('/path/to/project', {
  docsDirs: ['documentation'],
  allMarkdown: false
});
console.log(snapshot.documents.length, snapshot.groups.length);
~~~

The snapshot contains project identity, document metadata, hierarchical groups,
warnings, and a content-based revision. It does not contain full document bodies.

The optional second argument follows the CLI discovery
rules. Invalid options reject with `CollectionOptionsError` (`INVALID_COLLECTION_OPTIONS`).
The collector reads nested `.gitignore` rules and the optional configuration
described [above](#configuration), including the legacy filename fallback.
See the [implemented collection contract](https://github.com/superlucky84/docatlas/blob/main/docs/DESIGN.md#phase-1-구현-계약).
The config supports version, include, exclude, groups, and redirects.
Redirects are explicit project-relative Markdown paths; they are never inferred from prose.

## Contributing

[CONTRIBUTING.md](https://github.com/superlucky84/docatlas/blob/main/CONTRIBUTING.md) covers
development setup, tests, browser and installed-package checks, platform CI, and benchmarks.
Release notes are in [CHANGELOG.md](https://github.com/superlucky84/docatlas/blob/main/CHANGELOG.md).
To change a skill or rule, follow [agent-kit/README.md](agent-kit/README.md).

## License

[MIT](LICENSE). Copyright (c) 2026 superlucky84.
