# ddd-docmap

Local document maps for **Doc-Driven Development** projects.

Find feature documentation spread across a repository, explore its hierarchy,
and read Markdown without losing your place.

> Phase 4: browse feature cards, read formatted Markdown, search documentation,
> and see local saves reflected without reloading. Explicit previous paths resolve
> to their current documents. There is no npm release yet.

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

## Development

Requires Node.js 22 or newer. Latest validation uses Node.js 22.12.0 on macOS 15.6.1.

```sh
git clone https://github.com/superlucky84/ddd-docmap.git
cd ddd-docmap
npm install --ignore-scripts
npm run check
npm test
node bin/ddd-docmap.js --help
node bin/ddd-docmap.js --version
npm pack --dry-run
```

The local manifest uses the package name
`@superlucky84/ddd-docmap`; registry availability has not been checked.
The package is marked private while the first release and license are decided.

## Run locally

After installing dependencies in this checkout:

~~~sh
node bin/ddd-docmap.js
node bin/ddd-docmap.js --root /path/to/project
node bin/ddd-docmap.js --root /path/to/project --no-open
~~~

The CLI prints a loopback URL and opens your default browser. Keep the terminal
open; Ctrl+C stops this server. Separate invocations use separate servers.
If opening a browser fails, open the printed address manually.

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

## Collector API

After installing dependencies in this checkout, collect a project without a server:

~~~js
import { collectProject } from '@superlucky84/ddd-docmap';

const snapshot = await collectProject('/path/to/project');
console.log(snapshot.documents.length, snapshot.groups.length);
~~~

The snapshot contains project identity, document metadata, hierarchical groups,
warnings, and a content-based revision. It does not contain full document bodies.

The collector reads nested .gitignore rules and optional ddd-docmap.config.json.
See the [implemented collection contract](docs/DESIGN.md#phase-1-구현-계약).
The config supports version, include, exclude, groups, and redirects.
Redirects are explicit project-relative Markdown paths; they are never inferred from prose.

## Planning documents

Planning documents are currently written in Korean.

- [Requirements](docs/REQUIREMENTS.md): scope, agreed behavior, and proposed additions.
- [Design](docs/DESIGN.md): architecture, document model, and open decisions.
- [Implementation plan](docs/IMPLEMENT.md): phases, validation, and handoff.
- [Manual checks](docs/MANUAL_TEST_CHECKLIST.md): acceptance scenarios.

See [AGENTS.md](AGENTS.md) for contributor and coding-agent guidance.

## License

TBD. No open-source license has been selected yet.

