# docatlas

Local document maps for **Doc-Driven Development** projects.

Find feature documentation spread across a repository, explore its hierarchy,
and read Markdown without losing your place.

> The first npm release is still pending. Until it is published, use the local
> tarball instructions below. The package name and command are both `docatlas`.

## Document map

Run a CLI in a project to open its local document map:

1. Browse thin horizontal cards arranged by area and feature.
2. Read a short description of each feature.
3. Expand a card to choose its requirements, design, implementation, or manual checks.
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

### Without adding a project dependency

After the npm release, change into the project you want to explore and run:

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

### Before the first npm release

Create a tarball from this source checkout after installing its dependencies:

~~~sh
npm pack --pack-destination /tmp
~~~

Then install it from your project's root:

~~~sh
cd /path/to/project
pnpm add -D /tmp/docatlas-0.1.0.tgz
pnpm docatlas
~~~

Or use npm:

~~~sh
cd /path/to/project
npm install --save-dev /tmp/docatlas-0.1.0.tgz
npx --no-install docatlas
~~~

### Options and shutdown

After publication, the same options work for one-off and local runs:

~~~sh
npx docatlas --root /path/to/another-project
npx docatlas --no-open
~~~

The CLI prints a loopback URL and opens your default browser. Keep the terminal
open; Ctrl+C stops this server. Separate invocations use separate servers.
With `--no-open`, or if opening a browser fails, open the printed address manually.
Installed users can also pass options to `pnpm docatlas` or `npx --no-install docatlas`.
Earlier `docmap` and `ddd-docmap` command names remain accepted for compatibility.

The arrow expands child features; the card expands its documents. On narrow
screens, selecting a document switches to its reader, with a button back to the map.

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

The local server watches Markdown, raster images, configuration, and ignore rules.
It uses short polling intervals and batches saves into coherent map/search generations.
The reader preserves its mode and scroll position. Removing the selected document
clears its old body and explains what happened. Invalid configuration retains the
last good index and shows an update notice until fixed. A reconnected tab catches up.
Navigation state stays in each tab's memory.

To register a previous path, add a version 1 config at the project root:

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

The package name is `docatlas`, licensed under MIT. Version `0.1.0` is prepared for
its first npm release. Registry publication is still pending.

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

const snapshot = await collectProject('/path/to/project');
console.log(snapshot.documents.length, snapshot.groups.length);
~~~

The snapshot contains project identity, document metadata, hierarchical groups,
warnings, and a content-based revision. It does not contain full document bodies.

The collector reads nested .gitignore rules and optional ddd-docmap.config.json.
This configuration filename is retained for compatibility.
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

