import { createProject } from './projects.js';

const names = ['REQUIREMENTS.md', 'DESIGN.md', 'IMPLEMENT.md', 'MANUAL_TEST_CHECKLIST.md'];
const labels = ['Requirements', 'Design', 'Implementation', 'Manual Test Checklist'];
const paragraph = '문서 지도에서 기능과 계약을 찾습니다. Preserve selection, render Markdown, and search documentation without changing original files.\n\n';
const table = '| Key | Description |\n| --- | --- |\n' + Array.from({ length: 120 }, (_, i) => '| row-' + i + ' | ' + '넓은 표의 긴 내용 '.repeat(10) + '|').join('\n');
let body = '## Behavior\n\n';
while (Buffer.byteLength(body) < 16 * 1024) body += paragraph;

/** Deterministic, synthetic F-08; setup is deliberately outside measured operations. */
export async function createScaleProject(t) {
  const files = {};
  const documentIds = [];
  let documentBytes = 0;
  for (let feature = 0; feature < 75; feature++) {
    const number = String(feature).padStart(2, '0');
    const directory = 'docs/영역 ' + (feature % 3) + '/feature-' + number + (feature % 5 === 0 ? '/하위 기능' : '');
    const title = feature < 2 ? '공통 기능' : '기능 ' + number;
    for (let kind = 0; kind < names.length; kind++) {
      const id = directory + '/' + names[kind];
      const markdown = '# ' + title + ' — ' + labels[kind] + '\n\nFeature ' + number + ' contract.\n\n' + body +
        (feature === 0 && kind === 1 ? '\n\n' + table : '') +
        '\n\n~~~js\nconst uniqueToken' + number + ' = "검색바늘";\n~~~\n';
      files[id] = markdown;
      documentIds.push(id);
      documentBytes += Buffer.byteLength(markdown);
    }
  }
  for (let i = 0; i < 1000; i++) files['src/module-' + (i % 50) + '/file-' + i + '.js'] = 'export const value = ' + i + ';\n';
  for (const directory of ['node_modules/dependency', '.git', 'dist']) files[directory + '/docs/DESIGN.md'] = '# Excluded\n';
  const project = await createProject(t, files);
  return { ...project, documentIds, documentBytes, noiseFiles: 1003 };
}
