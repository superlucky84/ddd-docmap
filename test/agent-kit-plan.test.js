import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  AgentKitError, detectClients, hashText, loadKit, normalizeText, planInstall, selectItems, toCodexAgentToml
} from '../src/agent-kit/index.js';
import { OLD_RULE_BODY, OLD_SKILL, createWorkspace, snapshot, writeKit } from './helpers/agent-kit.js';

async function sampleKit(t, options) {
  const workspace = await createWorkspace(t);
  await writeKit(workspace.kitDir, options);
  return { ...workspace, kit: await loadKit(workspace.kitDir) };
}

function byKey(plan) {
  return Object.fromEntries(plan.actions.map(action => [action.key, action]));
}

function brief(action) {
  return [action.action, action.reason, action.backup];
}

async function trySymlink(t, target, link) {
  try {
    await fs.symlink(target, link);
    return true;
  } catch (error) {
    t.skip('symbolic links are unavailable: ' + error.code);
    return false;
  }
}

test('the packaged kit loads verified sources and renders Codex agents', async t => {
  const kit = await loadKit();
  assert.equal(kit.kitVersion, '1.0.0');
  assert.deepEqual(selectItems(kit).map(item => item.name),
    ['doc-driven-designer-v1', 'doc-driven-implementer-v1', 'doc-driven-reviewer-v1']);
  const toml = kit.items[0].files.codexAgent.text;
  assert.ok(toml.startsWith('name = "doc-driven-designer-v1"\ndescription = "Documentation-first design partner.'));
  assert.match(toml, /\ndeveloper_instructions = '''\n# Doc-Driven Designer \(Agent Rule\)\n/);
  assert.ok(toml.endsWith("without verbal context.\n'''\n"));

  const { kitDir } = await sampleKit(t);
  await fs.appendFile(path.join(kitDir, 'skills', 'sample-designer', 'SKILL.md'), 'Tampered.\n');
  await assert.rejects(loadKit(kitDir), error => error instanceof AgentKitError && /does not match/.test(error.message));
});

test('selection uses default items unless all or named items are requested', async t => {
  const { kit } = await sampleKit(t);
  assert.deepEqual(selectItems(kit).map(item => item.name), ['sample-designer']);
  assert.deepEqual(selectItems(kit, { all: true }).map(item => item.name), ['sample-designer', 'sample-reviewer']);
  assert.deepEqual(selectItems(kit, { only: ['sample-reviewer'] }).map(item => item.name), ['sample-reviewer']);
  assert.throws(() => selectItems(kit, { only: ['missing'] }), /Unknown agent kit item: missing\. Available: sample-designer, sample-reviewer/);
  assert.throws(() => selectItems(kit, { all: true, only: ['sample-reviewer'] }), AgentKitError);
});

test('client detection follows the home folders that exist', async t => {
  const { home } = await createWorkspace(t);
  assert.deepEqual(await detectClients(home), []);
  await fs.mkdir(path.join(home, '.agents'));
  assert.deepEqual(await detectClients(home), ['codex']);
  await fs.mkdir(path.join(home, '.claude'));
  assert.deepEqual(await detectClients(home), ['claude', 'codex']);
});

test('an empty home plans a create for each client file and writes nothing', async t => {
  const { root, home, project, kit } = await sampleKit(t);
  const before = await snapshot(root);
  const plan = await planInstall({ kit, items: selectItems(kit), scope: 'global', home, root: project, clients: ['claude', 'codex'] });
  assert.deepEqual(await snapshot(root), before);
  assert.equal(plan.base, home);
  assert.deepEqual(plan.actions.map(action => [action.relative, action.action]), [
    ['.claude/skills/sample-designer/SKILL.md', 'create'],
    ['.claude/agents/sample-designer.md', 'create'],
    ['.agents/skills/sample-designer/SKILL.md', 'create'],
    ['.codex/agents/sample-designer.toml', 'create']
  ]);
  const codex = plan.actions[3];
  assert.equal(codex.path, path.join(home, '.codex', 'agents', 'sample-designer.toml'));
  assert.equal(codex.content, toCodexAgentToml({
    name: 'sample-designer', description: 'Sample rule for installer tests.', body: '# Sample rule\n\nCurrent rule.\n'
  }));
  assert.equal(codex.sha256, hashText(codex.content));
  assert.deepEqual(plan.warnings, []);
  await assert.rejects(planInstall({ kit, items: [], scope: 'global', home, clients: [] }), AgentKitError);
  await assert.rejects(planInstall({ kit, items: [], scope: 'shared', home, clients: ['claude'] }), /Unknown install scope/);
});

test('same, recorded and previously published copies are kept or replaced without a backup', async t => {
  const { home, kit, write } = await sampleKit(t);
  const [item] = selectItems(kit);
  await write(home, '.claude/skills/sample-designer/SKILL.md', item.files.skill.text.replaceAll('\n', '\r\n') + '\r\n\r\n');
  await write(home, '.claude/agents/sample-designer.md', '---\nname: sample-designer\ndescription: Pasted by hand\n---\n\n' + OLD_RULE_BODY);
  await write(home, '.agents/skills/sample-designer/SKILL.md', OLD_SKILL);
  const installed = 'name = "sample-designer"\n# installed by an earlier docatlas\n';
  await write(home, '.codex/agents/sample-designer.toml', installed);
  await write(home, '.docatlas/agents.json', JSON.stringify({
    schema: 1,
    files: {
      'codex/agent/sample-designer': {
        path: '.codex/agents/sample-designer.toml', kitVersion: '0.9.0', version: '1.0.0', sha256: hashText(installed)
      }
    }
  }));
  const actions = byKey(await planInstall({ kit, items: [item], scope: 'global', home, clients: ['claude', 'codex'] }));
  assert.deepEqual(brief(actions['claude/skill/sample-designer']), ['unchanged', 'same', false]);
  assert.deepEqual(brief(actions['claude/agent/sample-designer']), ['replace', 'previous-body', false]);
  assert.deepEqual(brief(actions['codex/skill/sample-designer']), ['replace', 'previous-file', false]);
  assert.deepEqual(brief(actions['codex/agent/sample-designer']), ['replace', 'recorded', false]);
});

test('edited copies, newer installs and ctxbin copies are skipped unless forced', async t => {
  const { home, kit, write } = await sampleKit(t);
  const [item] = selectItems(kit);
  await write(home, '.claude/skills/sample-designer/SKILL.md', '# My own designer\n');
  const newer = '---\nname: sample-designer\ndescription: From a newer kit.\n---\n\nNewer rule.\n';
  await write(home, '.claude/agents/sample-designer.md', newer);
  await write(home, '.docatlas/agents.json', JSON.stringify({
    schema: 1,
    files: {
      'claude/agent/sample-designer': {
        path: '.claude/agents/sample-designer.md', kitVersion: '2.0.0', version: '1.2.0', sha256: hashText(newer)
      }
    }
  }));
  await write(home, '.agents/skills/sample-designer/SKILL.md', OLD_SKILL);
  await write(home, '.agents/skills/.ctxbin-sync.json', JSON.stringify({ version: 1, items: { 'sample-designer': 'digest' } }));
  await write(home, '.codex/agents/sample-designer.toml', item.files.codexAgent.text);
  await write(home, '.codex/agents/.ctxbin-sync.json', JSON.stringify({ version: 1, items: { 'sample-designer': 'digest' } }));
  const options = { kit, items: [item], scope: 'global', home, clients: ['claude', 'codex'] };

  const skipped = byKey(await planInstall(options));
  assert.deepEqual(brief(skipped['claude/skill/sample-designer']), ['skip-modified', 'modified', false]);
  assert.deepEqual(brief(skipped['claude/agent/sample-designer']), ['skip-downgrade', 'downgrade', false]);
  assert.deepEqual(brief(skipped['codex/skill/sample-designer']), ['skip-managed', 'ctxbin', false]);
  assert.deepEqual(brief(skipped['codex/agent/sample-designer']), ['unchanged', 'same', false]);

  const forced = byKey(await planInstall({ ...options, force: true }));
  assert.deepEqual(brief(forced['claude/skill/sample-designer']), ['replace', 'modified', true]);
  assert.deepEqual(brief(forced['claude/agent/sample-designer']), ['replace', 'downgrade', true]);
  assert.deepEqual(brief(forced['codex/skill/sample-designer']), ['replace', 'ctxbin', true]);
  assert.deepEqual(brief(forced['codex/agent/sample-designer']), ['unchanged', 'same', false]);
});

test('symbolic links block planned writes except a linked client folder in the home', async t => {
  const { root, home, project, kit, write } = await sampleKit(t);
  const [item] = selectItems(kit);
  await fs.mkdir(path.join(root, 'dotfiles', 'claude', 'agents', 'sample-designer.md'), { recursive: true });
  await fs.mkdir(path.join(root, 'elsewhere'));
  if (!await trySymlink(t, path.join(root, 'dotfiles', 'claude'), path.join(home, '.claude'))) {
    return;
  }
  await fs.mkdir(path.join(home, '.agents'));
  await trySymlink(t, path.join(root, 'elsewhere'), path.join(home, '.agents', 'skills'));
  const target = await write(root, 'elsewhere/real.toml', 'name = "x"\n');
  await fs.mkdir(path.join(home, '.codex', 'agents'), { recursive: true });
  await trySymlink(t, target, path.join(home, '.codex', 'agents', 'sample-designer.toml'));
  const global = byKey(await planInstall({ kit, items: [item], scope: 'global', home, clients: ['claude', 'codex'] }));
  assert.deepEqual(brief(global['claude/skill/sample-designer']), ['create', 'new', false]);
  assert.deepEqual(brief(global['claude/agent/sample-designer']), ['blocked', 'not-file', false]);
  assert.deepEqual(brief(global['codex/skill/sample-designer']), ['blocked', 'symlink', false]);
  assert.deepEqual(brief(global['codex/agent/sample-designer']), ['blocked', 'symlink', false]);

  await trySymlink(t, path.join(root, 'dotfiles', 'claude'), path.join(project, '.claude'));
  const local = byKey(await planInstall({ kit, items: [item], scope: 'project', home, root: project, clients: ['claude'] }));
  assert.deepEqual(brief(local['claude/skill/sample-designer']), ['blocked', 'symlink', false]);
  assert.deepEqual(brief(local['claude/agent/sample-designer']), ['blocked', 'symlink', false]);
});

test('same-name warnings explain which copy each client uses', async t => {
  const { home, project, kit, write } = await sampleKit(t);
  const [item] = selectItems(kit);
  await write(home, '.claude/skills/sample-designer/SKILL.md', item.files.skill.text);
  await write(project, '.codex/agents/sample-designer.toml', item.files.codexAgent.text);
  const local = await planInstall({ kit, items: [item], scope: 'project', home, root: project, clients: ['claude', 'codex'] });
  assert.deepEqual(local.warnings.map(warning => [warning.code, warning.client, warning.kind, warning.path]), [
    ['same-name', 'claude', 'skill', path.join(home, '.claude', 'skills', 'sample-designer', 'SKILL.md')],
    ['codex-trust', 'codex', 'agent', undefined]
  ]);
  assert.match(local.warnings[0].message, /uses the global skill instead of the project skill/);
  assert.match(local.warnings[1].message, /only after the project is trusted/);
  const global = await planInstall({ kit, items: [item], scope: 'global', home, root: project, clients: ['codex'] });
  assert.equal(global.warnings.length, 1);
  assert.match(global.warnings[0].message, /Codex uses the project agent instead of the global agent in a trusted project/);
  const claudeOnly = await planInstall({ kit, items: [item], scope: 'project', home, root: project, clients: ['claude'] });
  assert.ok(!claudeOnly.warnings.some(warning => warning.code === 'codex-trust'));
  const same = await planInstall({ kit, items: [item], scope: 'global', home, root: home, clients: ['claude'] });
  assert.deepEqual(same.warnings, []);
});

test('an unreadable install record is ignored with a warning', async t => {
  const { home, kit, write } = await sampleKit(t);
  await write(home, '.docatlas/agents.json', '{oops');
  const plan = await planInstall({ kit, items: selectItems(kit), scope: 'global', home, clients: ['claude'] });
  assert.deepEqual(plan.warnings.map(warning => warning.code), ['record']);
  assert.deepEqual(plan.actions.map(action => action.action), ['create', 'create']);
});

test('Codex TOML uses a literal block and falls back to an escaped string when needed', () => {
  const literal = toCodexAgentToml({ name: 'a', description: 'Say "hi"', body: '# Rule\r\n\r\nKeep it.\r\n' });
  assert.equal(literal, 'name = "a"\ndescription = "Say \\"hi\\""\ndeveloper_instructions = \'\'\'\n# Rule\n\nKeep it.\n\'\'\'\n');
  const body = "Quote ''' and \u007f here.\n";
  const escaped = toCodexAgentToml({ name: 'a', description: 'd', body });
  const value = escaped.split('\n').find(line => line.startsWith('developer_instructions = ')).slice('developer_instructions = '.length);
  assert.ok(value.includes('\\u007F'));
  assert.equal(JSON.parse(value.replace('\\u007F', '\\u007f')), normalizeText(body));
});
