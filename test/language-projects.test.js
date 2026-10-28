import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { collectProject } from 'docatlas';
import { createProject } from './helpers/projects.js';
import { GENERATED_DOCUMENTS, SOURCE_DOCUMENTS, LANGUAGE_FILES } from './helpers/languages.js';

const ids = snapshot => snapshot.documents.map(document => document.id);

test('Python and Java defaults prune generated subtrees while keeping source and similarly named documentation', async t => {
  const { root } = await createProject(t, LANGUAGE_FILES);
  const visited = [];
  const readdir = fs.readdir;
  t.mock.method(fs, 'readdir', async (directory, ...args) => {
    visited.push(path.relative(root, directory).split(path.sep).join('/'));
    return readdir(directory, ...args);
  });
  const snapshot = await collectProject(root);
  assert.deepEqual(ids(snapshot), Object.keys(SOURCE_DOCUMENTS).sort());
  for (const directory of visited) {
    assert.ok(!/(?:^|\/)(?:\.venv|venv|__pycache__|\.pytest_cache|\.mypy_cache|\.ruff_cache|\.tox|\.nox|\.eggs|[^/]+\.egg-info|target|\.gradle|\.m2|build)(?:\/|$)/i.test(directory), directory);
  }
  assert.deepEqual(snapshot.warnings, []);
  await assert.rejects(fs.access(path.join(root, 'package.json')), { code: 'ENOENT' });
});

test('explicit includes and scope options cannot bypass language defaults, but exclude replacement can restore them', async t => {
  const project = await createProject(t, {
    ...LANGUAGE_FILES,
    'docatlas.config.json': '{"version":1,"include":["**/*.md"]}',
    'node_modules/library/docs/README.md': '# Protected dependency',
    '.git/docs/DESIGN.md': '# Protected metadata',
    '.gitignore': 'private/\n', 'private/docs/DESIGN.md': '# Ignored'
  });
  const expected = Object.keys(SOURCE_DOCUMENTS).sort();
  assert.deepEqual(ids(await collectProject(project.root)), expected);
  const selected = await collectProject(project.root, { allMarkdown: true, docsDirs: ['.', '.venv', 'target'] });
  assert.deepEqual(ids(selected), expected);
  assert.deepEqual(selected.warnings.filter(warning => warning.code === 'DOCS_DIR_SKIPPED').map(warning => warning.path), ['.venv', 'target']);
  await project.write('docatlas.config.json', '{"version":1,"include":["**/*.md"],"exclude":[]}');
  assert.deepEqual(ids(await collectProject(project.root, { allMarkdown: true })),
    [...expected, ...Object.keys(GENERATED_DOCUMENTS)].sort());
});

test('language defaults also apply at every depth and without case sensitivity', async t => {
  const { root } = await createProject(t, {
    'packages/api/.VENV/docs/README.md': '# Dependency',
    'services/api/TARGET/docs/README.md': '# Generated',
    'services/api/.GRADLE/docs/DESIGN.md': '# Cache',
    'packages/api/Example.EGG-INFO/docs/README.md': '# Metadata',
    'services/api/docs/README.md': '# Actual service documentation'
  });
  assert.deepEqual(ids(await collectProject(root, { docsDirs: ['.'] })), ['services/api/docs/README.md']);
});
