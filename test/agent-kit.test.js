import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkAgentKit, hashText, parseFrontmatter } from '../scripts/agent-kit.js';
import { createProject } from './helpers/projects.js';

const repositoryKit = fileURLToPath(new URL('../agent-kit/', import.meta.url));

const SKILL = '---\nname: sample-skill\ndescription: Use when testing the kit checker.\nmetadata:\n  version: 1.2.0\n---\n\n# Sample skill\n\nBody text.\n';
const AGENT = '---\nname: sample-skill\ndescription: Sample agent rule for tests.\n---\n\n# Sample rule\n\nFollow the sample.\n';

async function createKit(t, { skill = SKILL, agent = AGENT, item = {}, files = {} } = {}) {
  const manifest = {
    schema: 1,
    kitVersion: '1.0.0',
    items: [{
      name: 'sample-skill',
      version: '1.2.0',
      default: true,
      skill: { path: 'skills/sample-skill/SKILL.md', sha256: hashText(skill) },
      agent: { path: 'agents/sample-skill.md', sha256: hashText(agent) },
      previous: [],
      ...item
    }]
  };
  const { root } = await createProject(t, {
    'skills/sample-skill/SKILL.md': skill,
    'agents/sample-skill.md': agent,
    'manifest.json': JSON.stringify(manifest, null, 2),
    ...files
  });
  return root;
}

function hasError(errors, pattern) {
  assert.ok(errors.some(error => pattern.test(error)), 'expected ' + pattern + ' in ' + JSON.stringify(errors));
}

test('the repository kit lists three valid pairs with only the designer installed by default', async () => {
  const { errors, manifest } = await checkAgentKit(repositoryKit);
  assert.deepEqual(errors, []);
  assert.deepEqual(manifest.items.map(item => [item.name, item.default]), [
    ['doc-driven-designer-v1', true],
    ['doc-driven-implementer-v1', false],
    ['doc-driven-reviewer-v1', false]
  ]);
});

test('a valid kit passes and hashes ignore line endings, a BOM and trailing blank lines', async t => {
  const root = await createKit(t);
  assert.deepEqual((await checkAgentKit(root)).errors, []);
  assert.equal(hashText('﻿' + SKILL.replaceAll('\n', '\r\n') + '  \r\n\r\n'), hashText(SKILL));
  assert.notEqual(hashText(SKILL.replace('Body text.', 'Body text!')), hashText(SKILL));
});

test('a rule body hash matches a copy pasted without frontmatter', () => {
  assert.equal(hashText(parseFrontmatter(AGENT).body), hashText('# Sample rule\n\nFollow the sample.\n'));
});

test('agent rules accept only name and description', async t => {
  const agent = AGENT.replace('description:', 'model: fast\ndescription:');
  const { errors } = await checkAgentKit(await createKit(t, { agent }));
  hasError(errors, /^agents\/sample-skill\.md: frontmatter key model is not allowed$/);
});

test('names and versions must match the manifest', async t => {
  const skill = SKILL.replace('name: sample-skill', 'name: other-skill').replace('version: 1.2.0', 'version: 1.1.0');
  const { errors } = await checkAgentKit(await createKit(t, { skill }));
  hasError(errors, /SKILL\.md: frontmatter name must be sample-skill$/);
  hasError(errors, /SKILL\.md: metadata\.version must match manifest version 1\.2\.0$/);
});

test('a stale hash reports the value to record', async t => {
  const stale = '0'.repeat(64);
  const { errors } = await checkAgentKit(await createKit(t, {
    item: { skill: { path: 'skills/sample-skill/SKILL.md', sha256: stale } }
  }));
  assert.ok(errors.includes('skills/sample-skill/SKILL.md: sha256 is ' + hashText(SKILL) + ' but manifest.json lists ' + stale));
});

test('previous entries must be older and differ from the current files', async t => {
  const previous = [
    { version: '1.2.0', kind: 'skill', part: 'file', sha256: 'a'.repeat(64), source: 'test' },
    { version: '1.0.0', kind: 'agent', part: 'body', sha256: hashText(parseFrontmatter(AGENT).body), source: 'test' },
    { version: '1.0.0', kind: 'codex-agent', part: 'body', sha256: 'b'.repeat(64), source: 'test' }
  ];
  const { errors } = await checkAgentKit(await createKit(t, { item: { previous } }));
  hasError(errors, /previous\[0\]\.version must be lower than 1\.2\.0$/);
  hasError(errors, /previous\[1\] matches the current agent body$/);
  hasError(errors, /previous\[2\]\.part must be one of file$/);
});

test('unlisted files, unsafe YAML values and invalid UTF-8 are rejected', async t => {
  const skill = SKILL.replace('Use when testing the kit checker.', 'Use when: testing');
  const agent = Buffer.concat([Buffer.from(AGENT), Buffer.from([0xff])]);
  const { errors } = await checkAgentKit(await createKit(t, { skill, files: { 'notes.md': '# Notes\n' } }));
  hasError(errors, /^notes\.md: file is not listed in manifest\.json$/);
  hasError(errors, /SKILL\.md: frontmatter line 3 needs double quotes to stay valid YAML$/);
  const invalid = await checkAgentKit(await createKit(t, { files: { 'agents/sample-skill.md': agent } }));
  hasError(invalid.errors, /^agents\/sample-skill\.md: .*(encoded|invalid)/i);
});

test('symbolic links inside the kit are rejected', async t => {
  const root = await createKit(t);
  try {
    await fs.symlink(path.join(root, 'skills', 'sample-skill', 'SKILL.md'), path.join(root, 'linked.md'));
  } catch (error) {
    t.skip('symbolic links are unavailable: ' + error.code);
    return;
  }
  hasError((await checkAgentKit(root)).errors, /^linked\.md: only regular files are allowed$/);
});
