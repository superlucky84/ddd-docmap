import { fromMarkdown } from 'mdast-util-from-markdown';

const KINDS = new Map([
  ['requirements.md', 'requirements'],
  ['design.md', 'design'],
  ['implement.md', 'implementation'],
  ['manual_test_checklist.md', 'manual-test'],
  ['readme.md', 'readme'],
  ['research.md', 'research']
]);

export const DOCUMENT_ORDER = [
  'requirements', 'design', 'implementation', 'manual-test', 'readme', 'research', 'other'
];
export const REPRESENTATIVE_ORDER = [
  'readme', 'requirements', 'design', 'implementation', 'manual-test', 'research', 'other'
];

export function documentKind(filename) {
  return KINDS.get(filename.toLowerCase()) || 'other';
}

function inlineText(node, withoutLinks = false) {
  if (withoutLinks && ['link', 'linkReference', 'image', 'imageReference'].includes(node.type)) {
    return '';
  }
  if (node.type === 'html') {
    return '';
  }
  if (typeof node.value === 'string') {
    return node.value;
  }
  return (node.children || []).map(child => inlineText(child, withoutLinks)).join('');
}

function normalize(text) {
  return text.replace(/\s+/g, ' ').trim();
}

export function groupTitle(title) {
  return title.replace(
    /(?:^|\s*[-–—|:·]\s*|\s+)(?:요구사항|설계|구현(?:\s*계획|\s*가이드)?|수동\s*(?:검증|테스트)(?:\s*체크리스트)?|requirements|design|implementation(?:\s*plan)?|manual(?:\s*test)?(?:\s*checklist)?)\s*$/i,
    ''
  ).trim();
}

export function extractMetadata(markdown, filename) {
  const source = markdown
    .replace(/^\uFEFF/, '')
    .replace(/^---\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/, '');
  const tree = fromMarkdown(source);
  const heading = tree.children.find(node => node.type === 'heading' && node.depth === 1);
  const title = (heading && normalize(inlineText(heading))) || filename;
  let summary = '';

  for (const node of tree.children) {
    if (node.type !== 'paragraph') {
      continue;
    }
    const raw = source.slice(node.position.start.offset, node.position.end.offset);
    const text = normalize(inlineText(node));
    const narrative = inlineText(node, true).replace(/[\s·|,:;()[\]{}—–-]/g, '');
    if (!narrative || !text || /^\s*\|/.test(raw) || /^\s*\|?\s*:?-{3,}.*\|/m.test(raw)) {
      continue;
    }
    if (/^(?:문서\s*기준|작성일|갱신일|상태|기준(?:\s*(?:SHA|커밋))?|date|updated|status|version)\s*[:：]/i.test(text)) {
      continue;
    }
    summary = text;
    break;
  }
  return { title, summary, headingTitle: heading ? normalize(inlineText(heading)) : '' };
}
