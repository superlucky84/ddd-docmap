import { BASIC_FILES, createProject } from './projects.js';

export const READING_ID = 'docs/catalog/DESIGN.md';
export const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4u8AAAAASUVORK5CYII=', 'base64');
export const READING_MARKDOWN = [
  '---', 'title: Front matter is not the document title', '---',
  '# Catalog — Design', '',
  'A readable contract for the content catalogue.', '',
  '## Overview', '',
  'Use **feature documentation** to keep implementation decisions close to the code.', '',
  '| Area | Responsibility |', '| :--- | ---: |', '| Reader | Display Markdown |', '| Map | Find a feature |', '',
  '## Usage examples', '',
  '~~~js', 'const document = await loadDocument();', 'console.log(document.title);', '~~~', '',
  '- [x] Document the contract', '- [ ] Complete release checks', '',
  '[Read the filter design](./filters/DESIGN.md#filter-behavior)', '',
  '[한글 문서](<../guide/사용 방법.md#시작하기>)', '',
  '[Jump to details](#details)', '',
  '[Source module](../../src/example.js#L2)', '',
  '[Loose notes](../../notes/guide.md)', '',
  '[Missing document](./missing.md)', '',
  '[External reference](https://example.com/guide)', '',
  '![Build overview](./assets/overview.png)', '',
  '![Blocked vector](./assets/vector.svg)', '',
  '![Remote image](https://example.com/logo.png)', '',
  '<script>window.untrustedDocumentRan = true;</script>', '',
  '## 한국어 사용법', '', '첫 번째 제목입니다.', '',
  '## 한국어 사용법', '', '같은 제목도 고유한 앵커를 가집니다.', '',
  ...Array.from({ length: 28 }, (_, index) =>
    'Paragraph ' + (index + 1) + '. ' + 'Keep the original document location and preserve the reading position. '.repeat(4) + '\n'),
  '## Details', '', 'The final section of the document.', ''
].join('\n');

export function createReadingProject(t, additions = {}) {
  return createProject(t, {
    ...BASIC_FILES,
    [READING_ID]: READING_MARKDOWN,
    'docs/catalog/filters/DESIGN.md': '# Filters — Design\n\nFilter the catalog.\n\n## Filter behavior\n\nChoose matching content.\n',
    'docs/guide/사용 방법.md': '# 사용 방법\n\n한글과 공백 경로를 지원합니다.\n\n## 시작하기\n\n원본 디렉터리를 기준으로 이동합니다.\n',
    'docs/catalog/assets/overview.png': PNG,
    'docs/catalog/assets/vector.svg': '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
    'src/example.js': 'export const example = true;\n',
    'notes/guide.md': '# Loose notes\n\nOutside default discovery.\n',
    ...additions
  });
}
