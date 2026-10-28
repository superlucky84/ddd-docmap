# Configuration

[README](../README.md) · [Document map](document-map.md) · [Configuration](configuration.md) · [Windows, Linux, and WSL](platforms.md)

Docatlas works without configuration. Use this guide to add document folders, exclude paths,
rename groups, or keep old links working after you move a document.

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
Generated directories are excluded at any depth. The default exclusions are:

| Category | Excluded directory names |
| --- | --- |
| Output/cache | `dist`, `build`, `coverage`, `.docatlas`, `.ddd-docmap` |
| Python environments | `.venv`, `venv`, `.conda`, `.tox`, `.nox` |
| Python caches/metadata | `__pycache__`, `.pytest_cache`, `.mypy_cache`, `.ruff_cache`, `.eggs`, `*.egg-info` |
| Java build/dependency caches | `target`, `.gradle`, `.m2` |

The Python and Java rows were added in 0.3.0, and `.conda` in 0.3.1
(see the [changelog](../CHANGELOG.md)). They prevent dependency docs,
test environments, and generated copies from appearing in the map or being watched.
Ordinary source folders and names such as `env`, `bin`, `out`, `vendor`,
`target-design`, and `venv-guide` are not excluded.
A conda environment created inside the project under another name, such as `./env`, is not
excluded either; add it to `.gitignore` or `exclude` so its package docs stay out of the map.
These are replaceable defaults, not fixed exclusions: an explicit `exclude` array
replaces the entire list. Projects with an existing custom list must add any desired
new patterns themselves. `.git` and `node_modules` remain fixed exclusions.

All command-line options are listed in the [README](../README.md#document-map) and in `docatlas --help`.

## Configuration file

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
    "**/.conda/**",
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
