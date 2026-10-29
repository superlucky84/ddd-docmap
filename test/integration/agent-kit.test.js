import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { startCli } from '../helpers/cli.js';

const execute = promisify(execFile);
const repository = fileURLToPath(new URL('../../', import.meta.url));
const DESIGNER = 'doc-driven-designer-v1';

async function npm(args, cwd, extraEnv = {}) {
  const cli = process.env.npm_execpath;
  const command = cli ? process.execPath : 'npm';
  const env = { ...process.env, ...extraEnv };
  if (env.DOCMAP_NPM_CACHE) env.npm_config_cache = env.DOCMAP_NPM_CACHE;
  return execute(command, cli ? [cli, ...args] : args, { cwd, env, timeout: 60000, maxBuffer: 2 ** 20 });
}

// Content hashes below a folder, skipping installed packages.
async function filesIn(root, directory = root, result = {}) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const filename = path.join(directory, entry.name);
    const relative = path.relative(root, filename).split(path.sep).join('/');
    if (entry.isDirectory()) await filesIn(root, filename, result);
    else result[relative] = createHash('sha256').update(await fs.readFile(filename)).digest('hex');
  }
  return result;
}

const lines = output => output.trimEnd().split('\n').map(line => line.split('\t'));

async function waitFor(check, timeout = 5000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (check()) return true;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  return check();
}

test('F-09: a packaged install manages agent skills globally and per project without touching documents', { timeout: 120000 }, async t => {
  const cleanups = [];
  const scope = { after: fn => cleanups.push(fn) };
  t.after(async () => { for (const cleanup of cleanups.reverse()) await cleanup(); });
  const temporary = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'docatlas-agent-kit-install-')));
  cleanups.push(() => fs.rm(temporary, { recursive: true, force: true }));

  const { stdout } = await npm(['pack', '--json', '--pack-destination', temporary], repository);
  const [pack] = JSON.parse(stdout);
  const packed = new Set(pack.files.map(file => file.path));
  for (const filename of ['agent-kit/manifest.json', 'agent-kit/README.md', 'agent-kit/skills/' + DESIGNER + '/SKILL.md',
    'agent-kit/agents/' + DESIGNER + '.md', 'agent-kit/agents/doc-driven-reviewer-v1.md',
    'src/agent-kit/command.js', 'src/agent-kit/install.js', 'src/agent-kit/notice.js']) {
    assert.ok(packed.has(filename), 'Missing packaged file: ' + filename);
  }
  assert.ok(!pack.files.some(file => /^(?:scripts|test|docs)\//.test(file.path)));

  const home = path.join(temporary, '팀원 홈');
  const project = path.join(temporary, 'team project');
  await fs.mkdir(path.join(home, '.claude'), { recursive: true });
  await fs.mkdir(path.join(home, '.agents'), { recursive: true });
  await fs.mkdir(path.join(project, 'docs'), { recursive: true });
  await fs.writeFile(path.join(project, 'package.json'), '{"private":true}\n');
  await fs.writeFile(path.join(project, 'docs', 'DESIGN.md'), '# Team design\n\nTeamDesignToken.\n');
  await fs.writeFile(path.join(project, 'AGENTS.md'), '# Team rules\n');
  await fs.writeFile(path.join(project, 'CLAUDE.md'), '# Claude rules\n');
  await npm(['install', '--save-dev', '--offline', '--ignore-scripts', '--no-audit', '--no-fund',
    path.join(temporary, pack.filename)], project);
  const installed = path.join(project, 'node_modules', 'docatlas');
  const kitSkill = await fs.readFile(path.join(installed, 'agent-kit', 'skills', DESIGNER, 'SKILL.md'), 'utf8');
  const env = { HOME: home, USERPROFILE: home };
  const agents = args => npm(['exec', '--offline', '--', 'docatlas', 'agents', ...args], project, env);
  const documentsBefore = await filesIn(project);

  // An agent reads the help, previews, then applies.
  assert.match((await agents(['help'])).stdout, new RegExp(DESIGNER + ' +\\d+\\.\\d+\\.\\d+ +default'));
  const homeBefore = await filesIn(home);
  const preview = await agents(['install', '--dry-run']);
  const items = [DESIGNER, 'doc-driven-implementer-v1', 'doc-driven-reviewer-v1'];
  assert.deepEqual(lines(preview.stdout).map(line => line.slice(0, 6)), [
    ...items.flatMap(name => [
      ['dry-run', 'create', 'new', 'claude', 'skill', name], ['dry-run', 'create', 'new', 'claude', 'agent', name],
      ['dry-run', 'create', 'new', 'codex', 'skill', name], ['dry-run', 'create', 'new', 'codex', 'agent', name]
    ]),
    ['dry-run', 'summary', 'create=12', 'replace=0', 'unchanged=0', 'skipped=0']
  ]);
  assert.deepEqual(await filesIn(home), homeBefore);
  await agents(['install']);
  const globalSkill = path.join(home, '.claude', 'skills', DESIGNER, 'SKILL.md');
  assert.equal(await fs.readFile(globalSkill, 'utf8'), kitSkill);
  assert.match(await fs.readFile(path.join(home, '.codex', 'agents', DESIGNER + '.toml'), 'utf8'), /^name = "doc-driven-designer-v1"\n/);
  assert.deepEqual(lines((await agents(['install'])).stdout).slice(0, 12).map(line => line[0]), Array(12).fill('unchanged'));

  // A project install adds every item next to the documents and explains client rules.
  const local = await agents(['install', '--project', '--all']);
  const localLines = lines(local.stdout);
  assert.equal(localLines.filter(line => line[0] === 'create').length, 12);
  assert.deepEqual(localLines.filter(line => line[0] === 'warning').map(line => line[1]),
    [...Array(12).fill('same-name'), 'codex-trust']);
  await fs.access(path.join(project, '.claude', 'skills', 'doc-driven-reviewer-v1', 'SKILL.md'));
  await fs.access(path.join(project, '.docatlas', 'agents.json'));
  const documentsAfter = await filesIn(project);
  for (const name of Object.keys(documentsBefore)) {
    if (name !== 'package.json' && name !== 'package-lock.json') assert.equal(documentsAfter[name], documentsBefore[name], name);
  }

  // An older record makes the document map hint at the update; updating clears it.
  const recordPath = path.join(home, '.docatlas', 'agents.json');
  const record = JSON.parse(await fs.readFile(recordPath, 'utf8'));
  for (const entry of Object.values(record.files)) entry.kitVersion = '0.0.1';
  await fs.writeFile(recordPath, JSON.stringify(record));
  const executable = path.join(installed, 'bin', 'docatlas.js');
  const processEnv = { ...process.env, ...env };
  const map = await startCli(scope, { cwd: project, args: ['--no-open'], env: processEnv, executable });
  assert.ok(await waitFor(() => map.output().stdout.includes('Agent skills:')), map.output().stdout);
  assert.match(map.output().stdout, /installed 0\.0\.1\)\. Preview the update with: docatlas agents install --dry-run\n/);
  const snapshot = await (await fetch(map.url + 'api/map')).json();
  assert.deepEqual(snapshot.documents.map(document => document.id), ['docs/DESIGN.md']);
  map.child.kill('SIGINT');
  assert.deepEqual(await map.exited, { code: 0, signal: null });
  const update = lines((await agents(['install'])).stdout);
  assert.deepEqual(update.find(line => line[0] === 'record'), ['record', recordPath]);
  const again = await startCli(scope, { cwd: project, args: ['--no-open'], env: processEnv, executable });
  await new Promise(resolve => setTimeout(resolve, 300));
  again.child.kill('SIGINT');
  assert.deepEqual(await again.exited, { code: 0, signal: null });
  assert.ok(!again.output().stdout.includes('Agent skills:'), again.output().stdout);

  // A copy the user edited is kept until they approve --force, which keeps a backup.
  await fs.writeFile(globalSkill, '# My designer notes\n');
  await assert.rejects(agents(['install']), error => {
    assert.equal(error.code, 3);
    assert.deepEqual(lines(error.stdout)[0].slice(0, 2), ['skip-modified', 'modified']);
    assert.match(error.stderr, /Show these lines to the user before using --force/);
    return true;
  });
  assert.equal(await fs.readFile(globalSkill, 'utf8'), '# My designer notes\n');
  const forced = lines((await agents(['install', '--force'])).stdout);
  const backup = forced.find(line => line[0] === 'backup');
  assert.equal(backup[1], globalSkill);
  assert.equal(await fs.readFile(backup[2], 'utf8'), '# My designer notes\n');
  assert.equal(await fs.readFile(globalSkill, 'utf8'), kitSkill);
});
