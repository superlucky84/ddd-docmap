# Changelog

Published versions of the `docatlas` npm package. Dates are npm publish dates (UTC).
Agent skill and rule versions are tracked separately in
[agent-kit/manifest.json](agent-kit/manifest.json).

## 0.3.0 — 2026-10-28

- Add `docatlas agents install` and `docatlas agents help`, which install the doc-driven
  designer, implementer, and reviewer skills and rules for Claude Code and Codex. Installs are
  previewable, protect edited and newer files, and can be re-run to update.
- Show a one-line notice when the document map starts and installed skills are older than the
  packaged agent kit. The notice never writes files.
- Ship the agent kit (`agent-kit/`) in the package.
- Exclude Python environments, caches, and package metadata (`.venv`, `venv`, `.tox`, `.nox`,
  `__pycache__`, `.pytest_cache`, `.mypy_cache`, `.ruff_cache`, `.eggs`, `*.egg-info`) and Java
  build and dependency caches (`target`, `.gradle`, `.m2`) by default at any depth.
- Check macOS and Windows on Node 22 and 24 in CI.

## 0.2.0 — 2026-10-28

- Add `--docs-dir` to collect more directories and `--all-md` to collect all Markdown.
- Use `docatlas.config.json` as the configuration file, falling back to the legacy
  `ddd-docmap.config.json`.
- Show each search result's full path as a **Show in tree** button that reveals the document in
  the map without leaving the current reader.

## 0.1.0 — 2026-10-28

First release under the `docatlas` name, with the `docmap` and `ddd-docmap` commands kept as
aliases.

- Local document map of cards grouped by area and feature, with each feature's requirements,
  design, implementation, and manual-check documents.
- Markdown reader with server-side rendering, raw HTML disabled, an outline, source view,
  relative links and anchors, and local raster images.
- Search across titles, paths, descriptions, and document text.
- Live updates when documents, images, configuration, or ignore rules change.
- Optional configuration for include/exclude rules, group labels, and redirects.
- A foreground loopback server that stops cleanly with Ctrl+C.
