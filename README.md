# docatlas

Local document maps for **Doc-Driven Development** projects.

Find feature documentation spread across a repository, explore its hierarchy,
and read Markdown without losing your place.

> Docatlas is published on npm. This checkout adds Python/Java generated-directory
> exclusions and the `docatlas agents` command for the next release. Neither is published yet;
> use the tarball instructions below to try this checkout.

## Document map

Run a CLI in a project to open its local document map:

1. Browse thin horizontal cards arranged by area and feature.
2. Read a short description of each feature.
3. Click a card title to choose its requirements, design, implementation, or manual checks.
4. Read the selected Markdown document beside the map.

The default keeps the server running in the terminal. Press Ctrl+C to stop it.

Projects can have partial document sets, shared contracts, nested features, and
additional documents such as README or research notes. Defaults should work
without rewriting existing documentation; optional configuration can refine
labels, summaries, and discovery.

## Run from a project root

Docatlas uses **the directory where you run the command** as its default project root.
For example, running it in `/path/to/project` reads that project's documents.
Use `--root` to select a different directory.

The target can be a JavaScript, Python, Java/Spring, or other Markdown project.
Your computer needs Node.js 22+ and npm; the target needs no `package.json`,
Python package installation, Maven/Gradle plugin, or application build.

### Without adding a project dependency

Change into the project you want to explore and run:

~~~sh
cd /path/to/project
npx docatlas
~~~

When Docatlas is not installed in the project, npx can download it to the npm cache
and run it without adding a dependency to the project's package.json. If a matching
local installation exists, npx uses that version.

### With a project-local installation

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

### Try the next version from source

Create a tarball from this source checkout after installing its dependencies:

~~~sh
npm pack --pack-destination /tmp
~~~

Then install it from your project's root:

~~~sh
cd /path/to/project
pnpm add -D /tmp/docatlas-0.2.1.tgz
pnpm docatlas
~~~

Or use npm:

~~~sh
cd /path/to/project
npm install --save-dev /tmp/docatlas-0.2.1.tgz
npx --no-install docatlas
~~~

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

An arrow appears only when a group has child groups. Click it to expand those
children. Click the title to show documents directly in that group. A group with
its own Markdown and child directories supports both actions; a group with only
Markdown has no arrow. Counts describe the group's own documents. Empty directories
are omitted, so an on-disk subdirectory alone does not guarantee an arrow.
On narrow screens, selecting a document switches to its reader, with a button back to the map.

## Choose document locations

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
Generated directories are excluded at any depth. The next release's defaults are:

| Category | Excluded directory names |
| --- | --- |
| Existing output/cache defaults | `dist`, `build`, `coverage`, `.docatlas`, `.ddd-docmap` |
| Python environments | `.venv`, `venv`, `.tox`, `.nox` |
| Python caches/metadata | `__pycache__`, `.pytest_cache`, `.mypy_cache`, `.ruff_cache`, `.eggs`, `*.egg-info` |
| Java build/dependency caches | `target`, `.gradle`, `.m2` |

The Python/Java rows are additions in this checkout. They prevent dependency docs,
test environments, and generated copies from appearing in the map or being watched.
Ordinary source folders and names such as `env`, `bin`, `out`, `vendor`,
`target-design`, and `venv-guide` retain their previous behavior.
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

## Configuration

Create optional **`docatlas.config.json`** at the project root.
If it is absent, Docatlas reads the legacy `ddd-docmap.config.json` instead.
When both exist, only the new file is used; fields are not merged. An invalid new
file reports its own error and does not fall back. Older releases recognized only
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

The lists above show this checkout's defaults, with `documentation/**/*.md` and
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

## Reading and links

The reader renders tables, fenced code, and read-only task checks, with an outline
and an optional source view. Document links use the original file location.
Browser back/forward restores the reader, source mode, and map positions in the current tab.

Local PNG, JPEG, GIF, WebP, and AVIF images are served after path and exclusion checks.
Raw HTML is displayed as text. SVG and external images show an explanation.
Code, unindexed Markdown, and missing references keep the current document open;
code and attachment paths can be copied. External http/https links open in a separate tab.

## Search and live updates

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

To register a previous path, add `redirects` to the project-root configuration:

~~~json
{
  "version": 1,
  "redirects": {
    "docs/old/DESIGN.md": "docs/current/DESIGN.md"
  }
}
~~~

An explicit previous path works in search, document URLs, and relative Markdown links,
even when the old file no longer exists. Valid chains resolve to one current document;
cycles, missing targets, and excluded sources produce collection notices.

## Agent skills

The package includes the doc-driven agent skills and rules used to write these documents
(designer, implementer, and reviewer) in [agent-kit/](agent-kit/). `docatlas agents install`
copies them to the folders that Claude Code and Codex read automatically. This command is new in
this checkout and is not published yet.

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

## Windows and other operating systems

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

The [platform workflow](https://github.com/superlucky84/docatlas/blob/main/.github/workflows/platform.yml)
targets macOS and Windows with Node 22 and 24. Run `npm run test:platform` to check
native Unicode/space paths, CRLF, source discovery, references/assets, live policy changes,
controlled cleanup, and production tarball launchers. This does not replace manual OS acceptance.
The platform suite installs its fresh tarball with `--prefer-offline`: cached data
is reused and missing dependency metadata can be downloaded. It needs registry access
on a fresh CI runner. Once installed, all launcher help/version checks run offline.
The Windows workflow runs this platform suite and browser tests. The full `npm test`
and original `test:integration` suite still contain POSIX symlink/signal assumptions;
their Windows portability is not claimed by this work.

## Development

The declared minimum is Node.js 22. Packaged integration checks pass on Node.js
22.12.0 and 24.22.1 on macOS 15.6.1. Node.js 22.0 and other OSes remain unverified.

```sh
git clone https://github.com/superlucky84/docatlas.git
cd docatlas
npm install --ignore-scripts
npm run check
npm test
node bin/docatlas.js --help
node bin/docatlas.js --version
npm pack --dry-run
```

The package name is `docatlas`, licensed under MIT. This checkout prepares `0.2.1`;
the next version has not been published by this change.

## Browser checks

The development-only Playwright tests need a browser:

~~~sh
npx playwright install chromium
npm run test:browser
~~~

An existing Chrome installation can be used instead:

~~~sh
DOCMAP_BROWSER_CHANNEL=chrome npm run test:browser
~~~

Check the actual tarball in a separate production-only installation, using synthetic
JavaScript and non-JavaScript projects:

~~~sh
DOCMAP_BROWSER_CHANNEL=chrome npm run test:integration
~~~

The integration check installs offline from the npm cache populated during development
setup. Set `DOCMAP_NPM_CACHE` to use another cache. It checks the installed CLI and API,
reading, search, live saves, independent shutdown, and original file hashes.

Measure the synthetic 300-document project separately from other tests:

~~~sh
npm run benchmark
npm run benchmark -- --browser
~~~

The browser benchmark uses installed Chrome by default; `DOCMAP_BROWSER_CHANNEL`
can select another Playwright channel. Timings, idle CPU, and memory are local measurements.
See the [recorded results and regression criteria](https://github.com/superlucky84/docatlas/blob/main/docs/IMPLEMENT.md#phase-5-완료-검증--2026-10-28).

## Collector API

After installing dependencies in this checkout, collect a project without a server:

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

## Planning documents

Planning documents are currently written in Korean.

- [Requirements](https://github.com/superlucky84/docatlas/blob/main/docs/REQUIREMENTS.md): scope, agreed behavior, and proposed additions.
- [Design](https://github.com/superlucky84/docatlas/blob/main/docs/DESIGN.md): architecture, document model, and open decisions.
- [Implementation plan](https://github.com/superlucky84/docatlas/blob/main/docs/IMPLEMENT.md): phases, validation, and handoff.
- [Manual checks](https://github.com/superlucky84/docatlas/blob/main/docs/MANUAL_TEST_CHECKLIST.md): acceptance scenarios.

See [AGENTS.md](https://github.com/superlucky84/docatlas/blob/main/AGENTS.md) for contributor and coding-agent guidance.

## License

[MIT](LICENSE). Copyright (c) 2026 superlucky84.

