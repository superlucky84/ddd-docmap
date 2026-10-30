# Agent kit

The canonical doc-driven agent skills and agent rules for
[Doc-Driven Development](https://github.com/superlucky84/docatlas/blob/main/METHOD.md).
docatlas installs them for Claude Code and Codex.

| Name | Version | Skill | Agent rule | Installed by default |
| --- | --- | --- | --- | --- |
| doc-driven-designer-v1 | 1.2.0 | [SKILL.md](skills/doc-driven-designer-v1/SKILL.md) | [rule](agents/doc-driven-designer-v1.md) | Yes |
| doc-driven-implementer-v1 | 1.1.0 | [SKILL.md](skills/doc-driven-implementer-v1/SKILL.md) | [rule](agents/doc-driven-implementer-v1.md) | Yes |
| doc-driven-reviewer-v1 | 1.4.0 | [SKILL.md](skills/doc-driven-reviewer-v1/SKILL.md) | [rule](agents/doc-driven-reviewer-v1.md) | Yes |

Kit version 1.1.0. [manifest.json](manifest.json) records each item's version and hashes.

## Install

`docatlas agents install`, available since 0.3.0, copies the skills and rules to the folders that
Claude Code and Codex read automatically.

```sh
npx docatlas agents install --dry-run   # preview; writes nothing
npx docatlas agents install             # all three skills and rules
npx docatlas agents install --only doc-driven-designer-v1   # only the designer
```

All three are installed by default because a piece of work usually goes through all of them:
design, then implementation, then review. Add `--only <name>` for each item you want if you need
fewer. `docatlas agents help` tells an AI agent to preview, show you the result, and apply only
after you agree. The same help tells it to report any skipped files and to use `--force` only
when you say so.

The command installs for Claude Code and Codex only. Other agents can still use the kit: the
skills and rules are plain Markdown in this folder, and `docatlas agents help` prints their
location in the installed package. An agent should ask you where its client keeps rules or skills
and adapt the files there. docatlas does not track or update those copies, so repeat this after
updating docatlas.

- The default installs all three items into your home folder: `~/.claude/skills`,
  `~/.claude/agents`, `~/.agents/skills`, and `~/.codex/agents`, for the clients whose folders exist.
  Claude Code is found by `~/.claude`, and Codex by `~/.codex` or `~/.agents`, so if you use only one
  of them you get only its files. Add `--only <name>` to install fewer items, `--target` to choose
  clients, and `--project` to install into the project instead. Claude Code uses a global skill before
  a project skill with the same name, and Codex reads project agents only in trusted projects; the
  command warns about both.
- After updating docatlas, run the same command again. Files you edited, files from a newer docatlas,
  and files managed by ctxbin are skipped; `--force` replaces them after saving a backup in
  `~/.docatlas/backups/`. Install records are kept in `~/.docatlas/agents.json`, or in
  `.docatlas/agents.json` for a project install.
- In docatlas 0.3.1 and earlier, the default was the designer only. Running the default command
  again now adds the implementer and reviewer; the preview shows them as `create` lines. To keep
  only the designer, use `--only doc-driven-designer-v1`.
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
