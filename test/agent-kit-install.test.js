import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  INSTALL_OPTIONS, KIT_DIRECTORY, agentsHelp, applyPlan, loadKit, planInstall, runAgents, selectItems
} from '../src/agent-kit/index.js';
import { OLD_SKILL, createWorkspace, ruleText, snapshot, writeKit } from './helpers/agent-kit.js';
import { cliPath } from './helpers/cli.js';

const NOW = new Date('2026-10-28T01:02:03.456Z');

async function setup(t) {
  const workspace = await createWorkspace(t);
  await writeKit(workspace.kitDir);
  return workspace;
}

async function agents(workspace, args) {
  let stdout = '';
  let stderr = '';
  const code = await runAgents(args, {
    stdout: { write: chunk => { stdout += chunk; } },
    stderr: { write: chunk => { stderr += chunk; } },
    home: workspace.home, cwd: workspace.project, kitDir: workspace.kitDir, now: NOW
  });
  return { code, stdout, stderr, lines: stdout.trimEnd().split('\n').map(line => line.split('\t')) };
}

const read = filename => fs.readFile(filename, 'utf8');

test('the agents help covers every install option, action and exit code', async () => {
  const kit = await loadKit();
  const help = agentsHelp(kit);
  for (const option of Object.keys(INSTALL_OPTIONS)) {
    assert.ok(help.includes('--' + option), option);
  }
  const documented = new Set([...help.split('Options:')[1].split('Output lines')[0].matchAll(/--([a-z-]+)/g)].map(match => match[1]));
  assert.deepEqual([...documented].sort(), Object.keys(INSTALL_OPTIONS).sort());
  for (const text of ['--dry-run [options]', 'ask for approval', 'skip-modified', 'skip-downgrade', 'skip-managed', 'blocked',
    '  0  Done', '  1  Failed', '  2  Invalid', '  3  Done, but',
    'installs the kit items marked default below', 'add --only <name> for each', 'including items not marked default',
    'tell the user which files were skipped or blocked', 'Never add --force on your own',
    'If you are an agent other than Claude Code or Codex', 'https://github.com/superlucky84/docatlas/tree/main/agent-kit',
    path.join(KIT_DIRECTORY, 'skills', '<name>', 'SKILL.md'), path.join(KIT_DIRECTORY, 'agents', '<name>.md')]) {
    assert.ok(help.includes(text), text);
  }
  for (const name of ['doc-driven-designer-v1', 'doc-driven-implementer-v1', 'doc-driven-reviewer-v1']) {
    assert.match(help, new RegExp('^  ' + name + ' +\\d+\\.\\d+\\.\\d+ +default$', 'm'), name);
  }
  assert.ok(!help.includes('ask whether to add'), 'the default already installs every item, so agents do not ask first');
  const main = spawnSync(process.execPath, [cliPath, '--help'], { encoding: 'utf8' });
  assert.match(main.stdout, /docatlas agents help {2,}Steps for people and AI agents/);
});

test('the help shows the kit sources that this run actually uses', async t => {
  const workspace = await setup(t);
  const result = await agents(workspace, ['help']);
  assert.equal(result.code, 0);
  assert.ok(result.stdout.includes(path.join(workspace.kitDir, 'skills', '<name>', 'SKILL.md')), result.stdout);
});

test('a dry run prints the plan and writes nothing', async t => {
  const workspace = await setup(t);
  const before = await snapshot(workspace.root);
  const result = await agents(workspace, ['install', '--dry-run', '--target', 'all']);
  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(await snapshot(workspace.root), before);
  assert.deepEqual(result.lines.map(line => line.slice(0, 5)), [
    ['dry-run', 'create', 'new', 'claude', 'skill'],
    ['dry-run', 'create', 'new', 'claude', 'agent'],
    ['dry-run', 'create', 'new', 'codex', 'skill'],
    ['dry-run', 'create', 'new', 'codex', 'agent'],
    ['dry-run', 'summary', 'create=4', 'replace=0', 'unchanged=0']
  ]);
  assert.equal(result.lines[0][6], path.join(workspace.home, '.claude', 'skills', 'sample-designer', 'SKILL.md'));
});

test('an install writes every file and its record, and a second run changes nothing', async t => {
  const workspace = await setup(t);
  const kit = await loadKit(workspace.kitDir);
  const [item] = selectItems(kit);
  const first = await agents(workspace, ['install', '--target', 'all']);
  assert.equal(first.code, 0, first.stderr);
  assert.equal(await read(path.join(workspace.home, '.claude', 'skills', 'sample-designer', 'SKILL.md')), item.files.skill.text);
  assert.equal(await read(path.join(workspace.home, '.claude', 'agents', 'sample-designer.md')), item.files.agent.text);
  assert.equal(await read(path.join(workspace.home, '.agents', 'skills', 'sample-designer', 'SKILL.md')), item.files.skill.text);
  assert.equal(await read(path.join(workspace.home, '.codex', 'agents', 'sample-designer.toml')), item.files.codexAgent.text);
  const recordPath = path.join(workspace.home, '.docatlas', 'agents.json');
  assert.deepEqual(first.lines.at(-2), ['record', recordPath]);
  const record = JSON.parse(await read(recordPath));
  assert.deepEqual(Object.keys(record.files), [
    'claude/agent/sample-designer', 'claude/skill/sample-designer', 'codex/agent/sample-designer', 'codex/skill/sample-designer'
  ]);
  assert.deepEqual(record.files['codex/agent/sample-designer'], {
    path: '.codex/agents/sample-designer.toml', kitVersion: '1.0.0', version: '1.1.0', sha256: item.files.codexAgent.sha256
  });
  assert.equal((await fs.readdir(path.join(workspace.home, '.codex', 'agents'))).length, 1, 'no temporary files remain');

  const before = await snapshot(workspace.root);
  const second = await agents(workspace, ['install', '--target', 'all']);
  assert.equal(second.code, 0);
  assert.deepEqual(await snapshot(workspace.root), before);
  assert.deepEqual(second.lines.map(line => line[0]), ['unchanged', 'unchanged', 'unchanged', 'unchanged', 'summary']);
});

test('without --target, a home with one client folder gets files for that client only', async t => {
  for (const [folder, client, absent] of [['.claude', 'claude', ['.codex', '.agents']], ['.codex', 'codex', ['.claude']]]) {
    const workspace = await setup(t);
    await fs.mkdir(path.join(workspace.home, folder));
    const result = await agents(workspace, ['install']);
    assert.equal(result.code, 0, result.stderr);
    const files = result.lines.filter(line => line[0] === 'create');
    assert.deepEqual(files.map(line => line.slice(2, 5)), [[client, 'skill', 'sample-designer'], [client, 'agent', 'sample-designer']]);
    for (const other of absent) {
      await assert.rejects(fs.access(path.join(workspace.home, other)), { code: 'ENOENT' }, other);
    }
  }
});

test('earlier copies are replaced and edited copies wait for --force with a backup', async t => {
  const workspace = await setup(t);
  const skill = await workspace.write(workspace.home, '.claude/skills/sample-designer/SKILL.md', OLD_SKILL);
  const edited = ruleText('sample-designer', '# My rule\n\nEdited locally.\n');
  const agent = await workspace.write(workspace.home, '.claude/agents/sample-designer.md', edited);

  const first = await agents(workspace, ['install', '--target', 'claude']);
  assert.equal(first.code, 3);
  assert.match(first.stderr, /Show these lines to the user before using --force/);
  assert.deepEqual(first.lines.slice(0, 2).map(line => line.slice(0, 2)), [['replace', 'previous-file'], ['skip-modified', 'modified']]);
  assert.notEqual(await read(skill), OLD_SKILL);
  assert.equal(await read(agent), edited);

  const forced = await agents(workspace, ['install', '--target', 'claude', '--force']);
  assert.equal(forced.code, 0, forced.stderr);
  const backup = path.join(workspace.home, '.docatlas', 'backups', '2026-10-28T01-02-03-456Z', 'global', '.claude', 'agents', 'sample-designer.md');
  assert.deepEqual(forced.lines.find(line => line[0] === 'backup'), ['backup', agent, backup]);
  assert.equal(await read(backup), edited);
  assert.equal(await read(agent), ruleText('sample-designer'));
});

test('a project install writes under the root and warns about global copies', async t => {
  const workspace = await setup(t);
  await workspace.write(workspace.home, '.claude/skills/sample-designer/SKILL.md', OLD_SKILL);
  const result = await agents(workspace, ['install', '--project', '--root', '.', '--target', 'claude']);
  assert.equal(result.code, 0, result.stderr);
  assert.ok(await read(path.join(workspace.project, '.claude', 'skills', 'sample-designer', 'SKILL.md')));
  assert.ok(await read(path.join(workspace.project, '.docatlas', 'agents.json')));
  assert.equal(await read(path.join(workspace.home, '.claude', 'skills', 'sample-designer', 'SKILL.md')), OLD_SKILL);
  const warning = result.lines.find(line => line[0] === 'warning');
  assert.deepEqual(warning.slice(0, 3), ['warning', 'same-name', path.join(workspace.home, '.claude', 'skills', 'sample-designer', 'SKILL.md')]);
  assert.match(warning[3], /uses the global skill instead of the project skill/);
});

test('invalid arguments exit 2 and an empty home asks for --target', async t => {
  const workspace = await setup(t);
  for (const [args, expected] of [
    [[], /Missing agents command/],
    [['remove'], /Unknown agents command: remove/],
    [['install', 'extra'], /positional/i],
    [['install', '--target', 'cursor'], /--target must be one of: claude, codex, all[\s\S]*other than Claude Code or Codex/],
    [['install', '--all', '--only', 'sample-reviewer'], /either all items or named items/],
    [['install', '--only', 'missing', '--target', 'claude'], /Unknown agent kit item: missing/],
    [['install', '--root', 'missing'], /Project root not found/],
    [['install'], /Choose clients with --target claude, codex or all[\s\S]*other than Claude Code or Codex/]
  ]) {
    const result = await agents(workspace, args);
    assert.equal(result.code, 2, JSON.stringify(args));
    assert.match(result.stderr, expected);
  }
  assert.deepEqual(await fs.readdir(workspace.home), []);
});

test('a failed write restores the files and folders this run created', async t => {
  if (process.platform === 'win32' || process.getuid?.() === 0) {
    t.skip('needs POSIX permissions without root');
    return;
  }
  const workspace = await setup(t);
  const locked = path.join(workspace.home, '.codex', 'agents');
  await fs.mkdir(locked, { recursive: true });
  await fs.chmod(locked, 0o555);
  try {
    const before = await snapshot(workspace.home);
    const result = await agents(workspace, ['install', '--target', 'all']);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /Install failed: .*Files written by this run were restored\./);
    assert.deepEqual(await snapshot(workspace.home), before);
  } finally {
    await fs.chmod(locked, 0o755);
  }
});

test('a target that changes after planning stops the install before any write', async t => {
  const workspace = await setup(t);
  const kit = await loadKit(workspace.kitDir);
  const plan = await planInstall({
    kit, items: selectItems(kit), scope: 'global', home: workspace.home, clients: ['claude', 'codex']
  });
  await workspace.write(workspace.home, '.codex/agents/sample-designer.toml', 'name = "edited meanwhile"\n');
  const before = await snapshot(workspace.home);
  await assert.rejects(applyPlan(plan, { home: workspace.home, now: NOW }), /changed after planning\. Nothing was changed/);
  assert.deepEqual(await snapshot(workspace.home), before);
});

test('the docatlas command runs agents commands against the packaged kit', async t => {
  const workspace = await createWorkspace(t);
  await fs.mkdir(path.join(workspace.home, '.claude'));
  const env = { ...process.env, HOME: workspace.home, USERPROFILE: workspace.home };
  const help = spawnSync(process.execPath, [cliPath, 'agents', 'help'], { cwd: workspace.project, env, encoding: 'utf8' });
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /doc-driven-designer-v1 +1\.2\.0 +default/);
  const before = await snapshot(workspace.root);
  const dry = spawnSync(process.execPath, [cliPath, 'agents', 'install', '--dry-run'], { cwd: workspace.project, env, encoding: 'utf8' });
  assert.equal(dry.status, 0, dry.stderr);
  assert.deepEqual(await snapshot(workspace.root), before);
  // Only ~/.claude exists, so every default item is planned for Claude Code alone.
  const names = ['doc-driven-designer-v1', 'doc-driven-implementer-v1', 'doc-driven-reviewer-v1'];
  assert.deepEqual(dry.stdout.trimEnd().split('\n').map(line => line.split('\t').slice(0, 6)), [
    ...names.flatMap(name => [
      ['dry-run', 'create', 'new', 'claude', 'skill', name],
      ['dry-run', 'create', 'new', 'claude', 'agent', name]
    ]),
    ['dry-run', 'summary', 'create=6', 'replace=0', 'unchanged=0', 'skipped=0']
  ]);
});
