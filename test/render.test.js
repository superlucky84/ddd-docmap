import test from 'node:test';
import assert from 'node:assert/strict';
import { collectProject } from '../src/collector/index.js';
import { createFileAccess } from '../src/server/files.js';
import { createReferenceResolver } from '../src/server/references.js';
import { renderMarkdown } from '../src/server/render.js';
import { createReadingProject, READING_ID, READING_MARKDOWN } from './helpers/reading.js';

async function resolverFor(t, additions = {}) {
  const project = await createReadingProject(t, additions);
  const snapshot = await collectProject(project.root);
  const documents = new Map(snapshot.documents.map(document => [document.id, document]));
  const registered = [];
  const resolve = createReferenceResolver({
    document: documents.get(READING_ID), documents,
    access: await createFileAccess(project.root),
    registerAsset(relativePath, contentType) {
      registered.push({ relativePath, contentType });
      return '/api/asset?id=allowed-image';
    }
  });
  return { ...project, resolve, registered };
}

test('renders tables, code, task lists, and unique Unicode headings while escaping HTML', async t => {
  const { resolve } = await resolverFor(t);
  const result = await renderMarkdown(READING_MARKDOWN, resolve);
  assert.match(result.html, /<table>/);
  assert.match(result.html, /class="align-right"/);
  assert.doesNotMatch(result.html, /style="/);
  assert.match(result.html, /class="code-language">js/);
  assert.match(result.html, /<pre><code class="language-js">/);
  assert.match(result.html, /type="checkbox" disabled checked/);
  assert.match(result.html, /type="checkbox" disabled>/);
  assert.match(result.html, /&lt;script&gt;/);
  assert.doesNotMatch(result.html, /<script>/);
  assert.ok(result.headings.some(heading => heading.id === '한국어-사용법'));
  assert.ok(result.headings.some(heading => heading.id === '한국어-사용법-1'));
  assert.equal(result.headings[0].text, 'Catalog — Design');
  assert.equal(result.leadTitle, true);
  assert.doesNotMatch(result.html, /Front matter/);
});

test('resolves relative, root-relative, Unicode, directory, and current-document links', async t => {
  const { resolve } = await resolverFor(t);
  for (const href of ['./filters/DESIGN.md#filter-behavior', '/docs/catalog/filters/DESIGN.md#filter-behavior']) {
    const result = await resolve(href);
    assert.equal(result.type, 'document');
    assert.equal(result.targetId, 'docs/catalog/filters/DESIGN.md');
    assert.equal(result.fragment, 'filter-behavior');
  }
  assert.equal((await resolve('../shared/')).targetId, 'docs/shared/README.md');
  assert.equal((await resolve('../guide/%EC%82%AC%EC%9A%A9%20%EB%B0%A9%EB%B2%95.md#%EC%8B%9C%EC%9E%91%ED%95%98%EA%B8%B0')).fragment, '시작하기');
  assert.equal((await resolve('#details')).targetId, READING_ID);
});

test('distinguishes missing, unindexed, code, excluded, and outside paths', async t => {
  const { resolve } = await resolverFor(t, {
    '.gitignore': 'docs/private/\n',
    'docs/private/hidden.md': '# Hidden\n'
  });
  assert.equal((await resolve('./missing.md')).type, 'missing');
  assert.equal((await resolve('../../notes/guide.md')).type, 'unindexed');
  assert.deepEqual(await resolve('../../src/example.js#L2'), {
    type: 'file', relativePath: 'src/example.js#L2',
    message: 'Code and attachments are available as a relative path.'
  });
  assert.equal((await resolve('../private/hidden.md')).type, 'blocked');
  assert.equal((await resolve('../../../outside.md')).type, 'blocked');
  assert.equal((await resolve('%2e%2e/%2e%2e/%2e%2e/outside.md')).type, 'blocked');
  assert.equal((await resolve('../../node_modules/demo/docs/REQUIREMENTS.md')).type, 'blocked');
});

test('registers only allowed local images and does not turn active or external images into sources', async t => {
  const { resolve, registered } = await resolverFor(t);
  assert.equal((await resolve('./assets/overview.png', true)).src, '/api/asset?id=allowed-image');
  assert.deepEqual(registered, [{ relativePath: 'docs/catalog/assets/overview.png', contentType: 'image/png' }]);
  for (const href of ['./assets/vector.svg', 'https://example.com/logo.png', 'data:image/png;base64,AAAA']) {
    const result = await resolve(href, true);
    assert.equal(result.type, 'blocked');
    assert.equal(result.src, undefined);
  }
});

test('external links are restricted and rendered with a separate-tab relationship', async t => {
  const { resolve } = await resolverFor(t);
  const result = await renderMarkdown('[External](https://example.com/guide)\n\n[Mail](mailto:test@example.com)\n\n[Unsafe](javascript:alert(1))', resolve);
  assert.match(result.html, /target="_blank" rel="noopener noreferrer"/);
  assert.doesNotMatch(result.html, /href="(?:javascript|mailto|file|data):/);
  assert.equal((await resolve('file:///etc/passwd')).type, 'blocked');
});

test('punctuation-only heading ids stay unique and code contents are escaped', async t => {
  const { resolve } = await resolverFor(t);
  const result = await renderMarkdown('# !!!\n\n## !!!\n\n~~~html\n<script>alert(1)</script>\n~~~\n', resolve);
  assert.deepEqual(result.headings.map(heading => heading.id), ['section', 'section-1']);
  assert.match(result.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(result.html, /<script>/);
});
