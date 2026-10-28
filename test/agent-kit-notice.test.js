import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { agentKitNotice } from '../src/agent-kit/index.js';
import { createWorkspace, snapshot, writeKit } from './helpers/agent-kit.js';
import { startCli } from './helpers/cli.js';

function record(entries) {
  const files = {};
  for (const [key, kitVersion] of Object.entries(entries)) {
    const name = key.split('/')[2];
    files[key] = { path: '.claude/skills/' + name + '/SKILL.md', kitVersion, version: '1.0.0', sha256: '0'.repeat(64) };
  }
  return JSON.stringify({ schema: 1, files });
}

async function setup(t, kitVersion = '1.1.0') {
  const workspace = await createWorkspace(t);
  await writeKit(workspace.kitDir, { kitVersion });
  const notice = () => agentKitNotice({ home: workspace.home, root: workspace.project, kitDir: workspace.kitDir });
  return { ...workspace, notice };
}

async function waitFor(check, timeout = 3000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (check()) return true;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  return check();
}

test('no install record means no notice, even for hand-copied skills', async t => {
  const workspace = await setup(t);
  await workspace.write(workspace.home, '.claude/skills/sample-designer/SKILL.md', '# Copied from the wiki\n');
  assert.equal(await workspace.notice(), null);
});

test('an older global record suggests a preview of the default install', async t => {
  const workspace = await setup(t);
  await workspace.write(workspace.home, '.docatlas/agents.json', record({
    'claude/skill/sample-designer': '1.0.0', 'codex/skill/sample-designer': '1.1.0'
  }));
  const before = await snapshot(workspace.root);
  assert.equal(await workspace.notice(),
    'Agent skills: kit 1.1.0 is available (installed 1.0.0). Preview the update with: docatlas agents install --dry-run');
  assert.deepEqual(await snapshot(workspace.root), before);
});

test('older project items are named so the same items are updated', async t => {
  const workspace = await setup(t);
  await workspace.write(workspace.home, '.docatlas/agents.json', record({ 'claude/skill/sample-designer': '1.1.0' }));
  await workspace.write(workspace.project, '.docatlas/agents.json', record({
    'claude/skill/sample-designer': '0.9.0', 'claude/skill/sample-reviewer': '1.0.0', 'claude/skill/retired-skill': '0.1.0'
  }));
  assert.equal(await workspace.notice(), 'Agent skills: kit 1.1.0 is available (installed 0.9.0). Preview the update with: ' +
    'docatlas agents install --project --only sample-designer --only sample-reviewer --dry-run');
});

test('current, newer, unreadable or missing data gives no notice', async t => {
  const workspace = await setup(t);
  await workspace.write(workspace.home, '.docatlas/agents.json', record({ 'claude/skill/sample-designer': '1.1.0' }));
  await workspace.write(workspace.project, '.docatlas/agents.json', record({ 'claude/skill/sample-designer': '2.0.0' }));
  assert.equal(await workspace.notice(), null);
  await workspace.write(workspace.home, '.docatlas/agents.json', '{oops');
  assert.equal(await workspace.notice(), null);
  assert.equal(await agentKitNotice({ home: workspace.home, root: workspace.project, kitDir: path.join(workspace.root, 'missing') }), null);
  await workspace.write(workspace.home, '.docatlas/agents.json', record({ 'claude/skill/sample-designer': '1.0.0' }));
  const same = await agentKitNotice({ home: workspace.home, root: workspace.home, kitDir: workspace.kitDir });
  assert.match(same, /with: docatlas agents install --dry-run$/);
});

test('the document map prints the notice after it starts and keeps its shutdown', async t => {
  const workspace = await createWorkspace(t);
  await workspace.write(workspace.project, 'docs/DESIGN.md', '# Design\n');
  await workspace.write(workspace.home, '.docatlas/agents.json', record({ 'claude/skill/doc-driven-designer-v1': '0.9.0' }));
  const before = await snapshot(workspace.home);
  const env = { ...process.env, HOME: workspace.home, USERPROFILE: workspace.home };
  const cli = await startCli(t, { cwd: workspace.project, args: ['--no-open'], env });
  assert.ok(await waitFor(() => cli.output().stdout.includes('Agent skills:')), cli.output().stdout);
  const lines = cli.output().stdout.split('\n');
  assert.ok(lines.findIndex(line => line.startsWith('Agent skills:')) > lines.findIndex(line => line.startsWith('Document map:')));
  assert.match(cli.output().stdout, /Agent skills: kit \d+\.\d+\.\d+ is available \(installed 0\.9\.0\)\. Preview the update with: docatlas agents install --dry-run\n/);
  cli.child.kill('SIGINT');
  assert.deepEqual(await cli.exited, { code: 0, signal: null });
  assert.match(cli.output().stdout, /Document map stopped\./);
  assert.deepEqual(await snapshot(workspace.home), before);
});

test('the document map stays quiet without an install record', async t => {
  const workspace = await createWorkspace(t);
  await workspace.write(workspace.project, 'docs/DESIGN.md', '# Design\n');
  const env = { ...process.env, HOME: workspace.home, USERPROFILE: workspace.home };
  const cli = await startCli(t, { cwd: workspace.project, args: ['--no-open'], env });
  await new Promise(resolve => setTimeout(resolve, 300));
  cli.child.kill('SIGINT');
  assert.deepEqual(await cli.exited, { code: 0, signal: null });
  assert.ok(!cli.output().stdout.includes('Agent skills'), cli.output().stdout);
});
