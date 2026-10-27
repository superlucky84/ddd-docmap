import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { collectProject, ConfigurationError } from '@superlucky84/ddd-docmap';
import { createBasicProject, createProject } from './helpers/projects.js';

const CONFIG = 'ddd-docmap.config.json';

test('include and exclude replace their defaults but cannot bypass protected directories', async t => {
  const { root, write } = await createBasicProject(t);
  await write(CONFIG, JSON.stringify({ version: 1, include: ['**/*.md'], exclude: [] }));
  const snapshot = await collectProject(root);
  assert.equal(snapshot.documents.length, 10);
  assert.ok(snapshot.documents.some(document => document.id === 'README.md'));
  assert.ok(snapshot.documents.some(document => document.id.startsWith('dist/')));
  assert.ok(snapshot.documents.every(document => !/^(node_modules|\.git)\//.test(document.id)));
});

test('an explicit include cannot override gitignore or exclude rules', async t => {
  const { root } = await createProject(t, {
    [CONFIG]: JSON.stringify({ version: 1, include: ['**/*.md'], exclude: ['docs/excluded.md'] }),
    '.gitignore': 'docs/ignored.md\n',
    'docs/ignored.md': '# Ignored\n',
    'docs/excluded.md': '# Excluded\n',
    'docs/visible.md': '# Visible\n'
  });
  assert.deepEqual((await collectProject(root)).documents.map(document => document.id), ['docs/visible.md']);
});

test('group overrides apply to document and structural groups and unmatched entries warn', async t => {
  const { root, write } = await createBasicProject(t);
  await write(CONFIG, JSON.stringify({
    version: 1,
    groups: {
      'docs/catalog': { title: '콘텐트 목록', summary: '보정한 설명' },
      'src': { title: '소스 모듈', summary: '' },
      'missing': { title: 'Not discovered' }
    }
  }));
  const snapshot = await collectProject(root);
  const catalog = snapshot.groups.find(group => group.id === 'docs/catalog');
  assert.equal(catalog.title, '콘텐트 목록');
  assert.equal(catalog.summary, '보정한 설명');
  assert.equal(snapshot.groups.find(group => group.id === 'src').title, '소스 모듈');
  assert.equal(snapshot.warnings[0].code, 'UNMATCHED_GROUP');
});

const invalid = [
  ['non-object', null, 'expected a JSON object'],
  ['missing version', {}, 'version'],
  ['unknown version', { version: 2 }, 'version'],
  ['unknown field', { version: 1, surprise: true }, 'surprise'],
  ['redirects type', { version: 1, redirects: [] }, 'redirects'],
  ['include type', { version: 1, include: 'docs/*.md' }, 'include'],
  ['bad pattern item', { version: 1, include: [42] }, 'include[0]'],
  ['outside root', { version: 1, include: ['../**/*.md'] }, 'include[0]'],
  ['absolute root', { version: 1, include: ['/docs/*.md'] }, 'include[0]'],
  ['negated glob', { version: 1, include: ['!docs/*.md'] }, 'positive globs'],
  ['broken glob', { version: 1, include: ['docs/[abc.md'] }, 'invalid glob'],
  ['groups type', { version: 1, groups: [] }, 'groups'],
  ['outside group', { version: 1, groups: { '../outside': {} } }, 'groups'],
  ['title type', { version: 1, groups: { docs: { title: 42 } } }, 'title'],
  ['empty title', { version: 1, groups: { docs: { title: ' ' } } }, 'title'],
  ['summary type', { version: 1, groups: { docs: { summary: false } } }, 'summary'],
  ['unknown group field', { version: 1, groups: { docs: { parentId: '.' } } }, 'parentId']
];

for (const [name, value, message] of invalid) {
  test('F-03 config: ' + name, async t => {
    const { root } = await createProject(t, { [CONFIG]: JSON.stringify(value) });
    await assert.rejects(collectProject(root), error => {
      assert.ok(error instanceof ConfigurationError);
      assert.ok(error.message.includes(CONFIG));
      assert.ok(error.message.includes(message), error.message);
      return true;
    });
  });
}

test('invalid JSON is a configuration error with the config filename', async t => {
  const { root } = await createProject(t, { [CONFIG]: '{ invalid json' });
  await assert.rejects(collectProject(root), ConfigurationError);
});

test('a symbolic configuration file is not followed', async t => {
  const { root } = await createProject(t);
  const outside = await createProject(t, { 'config.json': '{"version":1}' });
  await fs.symlink(path.join(outside.root, 'config.json'), path.join(root, CONFIG));
  await assert.rejects(collectProject(root), ConfigurationError);
});
