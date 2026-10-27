# ddd-docmap

Local document maps for **Doc-Driven Development** projects.

Find feature documentation spread across a repository, explore its hierarchy,
and read Markdown without losing your place.

> Initial scaffold: the repository contains the product plan and a CLI supporting
> help and version output. The document scanner, browser UI, and local server
> are planned. There is no npm release yet.

## Planned experience

Run a CLI in a project to open its local document map:

1. Browse thin horizontal cards arranged by area and feature.
2. Read a short description of each feature.
3. Expand a card to choose its requirements, design, implementation, or manual checks.
4. Read the selected Markdown document beside the map.

Projects can have partial document sets, shared contracts, nested features, and
additional documents such as README or research notes. Defaults should work
without rewriting existing documentation; optional configuration can refine
labels, summaries, and discovery.

## Development

Requires Node.js 22 or newer. The scaffold currently has no third-party dependencies.

```sh
git clone https://github.com/superlucky84/ddd-docmap.git
cd ddd-docmap
npm install --ignore-scripts
npm run check
node bin/ddd-docmap.js --help
node bin/ddd-docmap.js --version
npm pack --dry-run
```

The local manifest uses the package name
`@superlucky84/ddd-docmap`; registry availability has not been checked.
The package is marked private while the first release and license are decided.

## Planning documents

Planning documents are currently written in Korean.

- [Requirements](docs/REQUIREMENTS.md): scope, agreed behavior, and proposed additions.
- [Design](docs/DESIGN.md): architecture, document model, and open decisions.
- [Implementation plan](docs/IMPLEMENT.md): phases, validation, and handoff.
- [Manual checks](docs/MANUAL_TEST_CHECKLIST.md): acceptance scenarios.

See [AGENTS.md](AGENTS.md) for contributor and coding-agent guidance.

## License

TBD. No open-source license has been selected yet.

