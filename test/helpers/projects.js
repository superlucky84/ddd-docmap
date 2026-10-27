import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export async function createProject(t, files = {}) {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'ddd-docmap-test-'));
  const root = await fs.realpath(temporary);
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  async function write(relative, content) {
    const filename = path.join(root, relative);
    await fs.mkdir(path.dirname(filename), { recursive: true });
    await fs.writeFile(filename, content);
  }
  for (const [relative, content] of Object.entries(files)) {
    await write(relative, content);
  }
  return { root, write };
}

export const BASIC_FILES = {
  'README.md': '# Sample project\n\nProject introduction.\n',
  'docs/catalog/REQUIREMENTS.md': '# Catalog — Requirements\n\nBrowse available content.\n',
  'docs/catalog/DESIGN.md': '# Catalog — Design\n\nCatalog architecture.\n',
  'docs/catalog/IMPLEMENT.md': '# Catalog — Implementation\n\nImplementation steps.\n',
  'docs/catalog/MANUAL_TEST_CHECKLIST.md': '# Catalog — Manual Test Checklist\n\nAcceptance checks.\n',
  'docs/catalog/filters/DESIGN.md': '# Filters — Design\n\nFilter the catalog.\n',
  'docs/shared/README.md': '# Shared contracts\n\nContracts used by several features.\n',
  'docs/notes/RESEARCH.md': '# Research notes\n\nPrior investigation.\n',
  'src/helper/REQUIREMENTS.md': '# Helper — Requirements\n\nShared helper behavior.\n',
  'node_modules/demo/docs/REQUIREMENTS.md': '# Dependency\n',
  'dist/docs/DESIGN.md': '# Generated output\n',
  '.git/docs/REQUIREMENTS.md': '# Git internals\n'
};

export const BASIC_DOCUMENTS = [
  'docs/catalog/DESIGN.md',
  'docs/catalog/IMPLEMENT.md',
  'docs/catalog/MANUAL_TEST_CHECKLIST.md',
  'docs/catalog/REQUIREMENTS.md',
  'docs/catalog/filters/DESIGN.md',
  'docs/notes/RESEARCH.md',
  'docs/shared/README.md',
  'src/helper/REQUIREMENTS.md'
];

export const createBasicProject = t => createProject(t, BASIC_FILES);
