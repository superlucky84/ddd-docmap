# Agent kit

The canonical doc-driven agent skills and agent rules for
[Doc-Driven Development](https://github.com/superlucky84/docatlas/blob/main/METHOD.md).
docatlas installs them for Claude Code and Codex.

| Name | Version | Skill | Agent rule | Installed by default |
| --- | --- | --- | --- | --- |
| doc-driven-designer-v1 | 1.1.0 | [SKILL.md](skills/doc-driven-designer-v1/SKILL.md) | [rule](agents/doc-driven-designer-v1.md) | Yes |
| doc-driven-implementer-v1 | 1.1.0 | [SKILL.md](skills/doc-driven-implementer-v1/SKILL.md) | [rule](agents/doc-driven-implementer-v1.md) | No |
| doc-driven-reviewer-v1 | 1.4.0 | [SKILL.md](skills/doc-driven-reviewer-v1/SKILL.md) | [rule](agents/doc-driven-reviewer-v1.md) | No |

Kit version 1.0.0. [manifest.json](manifest.json) records each item's version and hashes.

## Install

`docatlas agents install`, available since 0.3.0, copies the skills and rules to the folders that
Claude Code and Codex read automatically.

```sh
npx docatlas agents install --dry-run   # preview; writes nothing
npx docatlas agents install             # designer skill and rule
npx docatlas agents install --all       # all three
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

## Changing a skill or rule

1. Edit the file. Keep agent rule frontmatter to `name` and `description`.
2. Raise the item `version` in `manifest.json` and the skill's `metadata.version`, then raise `kitVersion`.
3. Move the old hashes into the item's `previous` list.
4. Record the new hashes printed by `node scripts/agent-kit.js hash <file>`.
5. Update the versions in the table above.
6. Check that METHOD.md, METHOD.ko.md, and the summary at the top of the repository README still match the rules.
7. Run `npm run check`.
