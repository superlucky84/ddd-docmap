# Contributing to docatlas

docatlas is built with [Doc-Driven Development](METHOD.md). Changes start in the planning
documents, then move to code and tests.

## How we work

1. Read [AGENTS.md](AGENTS.md) and the four planning documents in [docs/](docs/):
   requirements, design, implementation plan, and manual checks. They are written in Korean.
2. Record the request or decision in the affected documents before changing a contract in code.
   Keep confirmed requests, design proposals, and implemented behavior distinct, and leave
   open questions as `TBD`.
3. Work in phases with baseline validation and exit criteria, and keep the dedicated
   Test Hardening and Integration Test steps.
4. Update the current handoff in `IMPLEMENT.md` when you stop: done, next, blockers, and the
   latest commit.

Use synthetic, redistributable fixtures for examples and tests. Write commit messages in English.

## Development setup

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

Which checks to run:

| Change | Checks |
| --- | --- |
| Collector or other modules | `npm run check` and `npm test` |
| Browser UI | `npm run test:browser` as well |
| Package contents | `npm pack --dry-run` as well |
| Agent skills or rules | the steps in [agent-kit/README.md](agent-kit/README.md) |

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

## Installed-package checks

Check the actual tarball in a separate production-only installation, using synthetic
JavaScript and non-JavaScript projects:

~~~sh
DOCMAP_BROWSER_CHANNEL=chrome npm run test:integration
~~~

The integration check installs offline from the npm cache populated during development
setup. Set `DOCMAP_NPM_CACHE` to use another cache. It checks the installed CLI and API,
reading, search, live saves, independent shutdown, and original file hashes.

## Platform checks

The [platform workflow](.github/workflows/platform.yml) targets macOS and Windows with
Node 22 and 24. Run `npm run test:platform` to check native Unicode/space paths, CRLF,
source discovery, references/assets, live policy changes, controlled cleanup, and
production tarball launchers. This does not replace manual OS acceptance.

The platform suite installs its fresh tarball with `--prefer-offline`: cached data
is reused and missing dependency metadata can be downloaded. It needs registry access
on a fresh CI runner. Once installed, all launcher help/version checks run offline.
The Windows workflow runs this platform suite and browser tests. The full `npm test`
and original `test:integration` suite still contain POSIX symlink/signal assumptions;
their Windows portability is not claimed.

## Benchmarks

Measure the synthetic 300-document project separately from other tests:

~~~sh
npm run benchmark
npm run benchmark -- --browser
~~~

The browser benchmark uses installed Chrome by default; `DOCMAP_BROWSER_CHANNEL`
can select another Playwright channel. Timings, idle CPU, and memory are local measurements.
See the [recorded results and regression criteria](docs/IMPLEMENT.md#phase-5-완료-검증--2026-10-28).

## README screenshot

`scripts/screenshot.js` copies [examples/sample-shop](examples/sample-shop/) to a folder, opens
it in docatlas, and saves `.github/assets/document-map.png`. Point `--project` at an empty folder
with a short path, because the sidebar shows the project root:

~~~sh
node scripts/screenshot.js --project ~/projects/sample-shop
~~~

Without `--project`, it uses a temporary folder and removes it afterwards. The browser follows
`DOCMAP_BROWSER_CHANNEL`; `--executable-path` selects a specific browser binary.

## Examples

[examples/sample-shop](examples/sample-shop/) is the user-facing example of a Doc-Driven
Development project. It is written in English and uses made-up content only. The root
[docatlas.config.json](docatlas.config.json) limits this repository's own map to `docs/`, so the
example appears only with `--root examples/sample-shop`. `test/examples.test.js` checks both.
Tests still create their own fixtures in temporary folders.

## Try a source checkout in another project

Create a tarball from this checkout after installing its dependencies:

~~~sh
npm pack --pack-destination /tmp
~~~

Then install the file that `npm pack` printed from your project's root. With pnpm:

~~~sh
cd /path/to/project
pnpm add -D /tmp/docatlas-<version>.tgz
pnpm docatlas
~~~

Or with npm:

~~~sh
cd /path/to/project
npm install --save-dev /tmp/docatlas-<version>.tgz
npx --no-install docatlas
~~~

## Agent kit and method documents

[agent-kit/](agent-kit/) holds the canonical skills and agent rules. Follow
[agent-kit/README.md](agent-kit/README.md) when one changes: raise versions, record hashes, and
run `npm run check`. Then make sure [METHOD.md](METHOD.md), its Korean translation
[METHOD.ko.md](METHOD.ko.md), and the summary at the top of [README.md](README.md) still describe
the rules correctly. Change both method files in the same commit.

Release notes go in [CHANGELOG.md](CHANGELOG.md).
