import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { collectProject, ConfigurationError } from 'docatlas';
import { readRegularFile } from '../src/collector/read.js';
import { createProject } from './helpers/projects.js';

async function replaceAfterResolution(t, victim, substitute) {
  const original = fs.realpath;
  let swapped = false;
  t.mock.method(fs, 'realpath', async (...args) => {
    const resolved = await original(...args);
    if (args[0] === victim && !swapped) {
      swapped = true;
      await substitute();
    }
    return resolved;
  });
}

test('collector refuses a document replaced by an outside symbolic link between inspection and read', async t => {
  const { root } = await createProject(t, { 'docs/victim.md': '# Original', 'docs/healthy.md': '# Healthy' });
  const outside = await createProject(t, { 'secret.md': '# Outside secret' });
  const victim = path.join(root, 'docs/victim.md');
  await replaceAfterResolution(t, victim, async () => {
    await fs.unlink(victim);
    await fs.symlink(path.join(outside.root, 'secret.md'), victim);
  });
  const snapshot = await collectProject(root);
  assert.deepEqual(snapshot.documents.map(doc => doc.id), ['docs/healthy.md']);
  assert.equal(snapshot.warnings[0].code, 'DOCUMENT_READ_FAILED');
  assert.ok(!JSON.stringify(snapshot).includes('Outside secret'));
});

test('collector refuses a parent replaced by an outside symbolic link during document open', async t => {
  const { root } = await createProject(t, { 'docs/victim.md': '# Original', 'REQUIREMENTS.md': '# Healthy' });
  const outside = await createProject(t, { 'victim.md': '# Outside secret' });
  const victim = path.join(root, 'docs/victim.md');
  await replaceAfterResolution(t, victim, async () => {
    await fs.rename(path.join(root, 'docs'), path.join(root, 'old-docs'));
    await fs.symlink(outside.root, path.join(root, 'docs'));
  });
  const snapshot = await collectProject(root);
  assert.deepEqual(snapshot.documents.map(doc => doc.id), ['REQUIREMENTS.md']);
  assert.ok(!JSON.stringify(snapshot).includes('Outside secret'));
});

test('configuration replacement with a symbolic link fails instead of reading outside JSON', async t => {
  const name = 'ddd-docmap.config.json';
  const { root } = await createProject(t, { [name]: '{"version":1}' });
  const outside = await createProject(t, { 'config.json': '{"version":1,"groups":{".":{"title":"Outside configuration"}}}' });
  await replaceAfterResolution(t, path.join(root, name), async () => {
    await fs.unlink(path.join(root, name));
    await fs.symlink(path.join(outside.root, 'config.json'), path.join(root, name));
  });
  await assert.rejects(collectProject(root), ConfigurationError);
});

test('a failed descriptor read closes the opened file', async t => {
  const { root } = await createProject(t, { 'docs/DESIGN.md': '# Design' });
  const original = fs.open;
  let opened;
  t.mock.method(fs, 'open', async (...args) => {
    opened = await original(...args);
    t.mock.method(opened, 'readFile', async () => { throw Object.assign(new Error('simulated read failure'), { code: 'EIO' }); });
    return opened;
  });
  await assert.rejects(readRegularFile(root, path.join(root, 'docs/DESIGN.md')), { code: 'EIO' });
  assert.equal(opened.fd, -1);
});
