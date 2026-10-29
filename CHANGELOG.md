# Changelog

Changes to the `docatlas` npm package. Dates are npm publish dates (UTC); Unreleased lists
changes on main that are not published yet.
Agent skill and rule versions are tracked separately in
[agent-kit/manifest.json](agent-kit/manifest.json).

## 0.4.0 — 2026-10-29

- `docatlas agents install` now installs the designer, implementer, and reviewer by default.
  Add `--only <name>` to install fewer. After an earlier designer-only install, running the default
  command again adds the implementer and reviewer. Clients are still chosen from the folders in the
  home folder, so a Claude Code-only or Codex-only setup gets only its own files.
- `docatlas agents help` no longer tells AI agents to ask whether to add the implementer and
  reviewer, since the default already includes them.

## 0.3.1 — 2026-10-28

- Exclude `.conda` by default at any depth, so a conda environment created inside a project
  (the folder name VS Code uses) keeps its package docs off the map. Other names, such as `env`,
  are still included; add them to `.gitignore` or `exclude`.
- `docatlas --help` links to the configuration guide instead of a README section.
- `docatlas agents help` tells AI agents to ask whether to add the implementer and reviewer
  when the user did not say what to install, to report skipped or blocked files after an
  install, and never to add `--force` without the user's permission.
- For agents other than Claude Code and Codex, `docatlas agents help` prints where the skill and
  rule sources are, and the "no client folder" and unknown `--target` errors point to it.

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
