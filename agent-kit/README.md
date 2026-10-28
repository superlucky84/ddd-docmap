# Agent kit

Canonical copies of the doc-driven agent skills and agent rules used in docatlas projects.
Team wiki pages and personal skill stores are copies made from these files.

| Name | Skill | Agent rule | Installed by default |
| --- | --- | --- | --- |
| doc-driven-designer-v1 | [SKILL.md](skills/doc-driven-designer-v1/SKILL.md) | [rule](agents/doc-driven-designer-v1.md) | Yes |
| doc-driven-implementer-v1 | [SKILL.md](skills/doc-driven-implementer-v1/SKILL.md) | [rule](agents/doc-driven-implementer-v1.md) | No |
| doc-driven-reviewer-v1 | [SKILL.md](skills/doc-driven-reviewer-v1/SKILL.md) | [rule](agents/doc-driven-reviewer-v1.md) | No |

To use them today, copy a skill to `~/.claude/skills/<name>/SKILL.md` or `~/.agents/skills/<name>/SKILL.md`
and a rule to `~/.claude/agents/<name>.md`. An installer command for docatlas is planned but not available yet.

## Changing a skill or rule

1. Edit the file. Keep agent rule frontmatter to `name` and `description`.
2. Raise the item `version` in `manifest.json` and the skill's `metadata.version`, then raise `kitVersion`.
3. Move the old hashes into the item's `previous` list.
4. Record the new hashes printed by `node scripts/agent-kit.js hash <file>`.
5. Run `npm run check`, then update the wiki and skill store copies.
