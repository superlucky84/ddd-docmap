# Using the document map

[README](../README.md) · [Document map](document-map.md) · [Configuration](configuration.md) · [Windows, Linux, and WSL](platforms.md)

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

To try unreleased changes from a source checkout, see
[Try a source checkout](../CONTRIBUTING.md#try-a-source-checkout-in-another-project).

## Options and shutdown

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

## Navigate the map

An arrow appears only when a group has child groups. Click it to expand those
children. Click the title to show documents directly in that group. A group with
its own Markdown and child directories supports both actions; a group with only
Markdown has no arrow. Counts describe the group's own documents. Empty directories
are omitted, so an on-disk subdirectory alone does not guarantee an arrow.
On narrow screens, selecting a document switches to its reader, with a button back to the map.

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

To keep an old path working after moving a document, register it in
[`redirects`](configuration.md#configuration-file) in the project-root configuration.

## Collector API

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
described in the [configuration guide](configuration.md), including the legacy filename fallback.
See the [implemented collection contract](../docs/DESIGN.md#phase-1-구현-계약).
The config supports version, include, exclude, groups, and redirects.
Redirects are explicit project-relative Markdown paths; they are never inferred from prose.
