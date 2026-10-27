import MarkdownIt from 'markdown-it';
import GithubSlugger, { slug } from 'github-slugger';

const md = new MarkdownIt({ html: false, linkify: false, typographer: false });
const escape = value => md.utils.escapeHtml(String(value));

function textOf(tokens = []) {
  return tokens.map(token => {
    if (token.type === 'softbreak' || token.type === 'hardbreak') return ' ';
    if (token.type === 'image') return textOf(token.children || []) || token.content;
    if (token.children) return textOf(token.children);
    return ['text', 'code_inline'].includes(token.type) ? token.content : '';
  }).join('').trim();
}

md.core.ruler.after('inline', 'docmap_tasks', state => {
  for (let index = 2; index < state.tokens.length; index++) {
    const inline = state.tokens[index];
    if (inline.type !== 'inline' || state.tokens[index - 1].type !== 'paragraph_open' ||
        state.tokens[index - 2].type !== 'list_item_open') continue;
    const first = inline.children?.[0];
    const match = first?.type === 'text' && first.content.match(/^\[([ xX])\](?:\s+|$)/);
    if (!match) continue;
    first.content = first.content.slice(match[0].length);
    const checkbox = new first.constructor('html_inline', '', 0);
    checkbox.content = '<input class="task-checkbox" type="checkbox" disabled' +
      (match[1].toLowerCase() === 'x' ? ' checked' : '') + '> ';
    inline.children.unshift(checkbox);
    state.tokens[index - 2].attrJoin('class', 'task-list-item');
  }
});

const fence = md.renderer.rules.fence;
md.renderer.rules.fence = (tokens, index, options, env, self) => {
  const language = tokens[index].info.trim().split(/\s+/)[0] || 'text';
  return '<div class="code-block"><div class="code-language">' + escape(language) +
    '</div>' + fence(tokens, index, options, env, self) + '</div>';
};
md.renderer.rules.table_open = () => '<div class="table-scroll"><table>\n';
md.renderer.rules.table_close = () => '</table></div>\n';
for (const tag of ['th', 'td']) {
  md.renderer.rules[tag + '_open'] = (tokens, index) => {
    const alignment = tokens[index].attrGet('style')?.match(/text-align:\s*(left|right|center)/)?.[1];
    return '<' + tag + (alignment ? ' class="align-' + alignment + '"' : '') + '>';
  };
}
md.renderer.rules.link_open = (tokens, index, options, env, self) => {
  const reference = env.references[tokens[index].meta.reference];
  tokens[index].attrSet('href', reference.href || '#');
  tokens[index].attrSet('data-reference', String(tokens[index].meta.reference));
  if (reference.type === 'external') {
    tokens[index].attrSet('target', '_blank');
    tokens[index].attrSet('rel', 'noopener noreferrer');
  } else if (reference.type !== 'document') {
    tokens[index].attrJoin('class', 'reference-unavailable');
  }
  return self.renderToken(tokens, index, options);
};
md.renderer.rules.image = (tokens, index, options, env) => {
  const token = tokens[index];
  const reference = env.references[token.meta.reference];
  const alt = textOf(token.children || []) || token.content || 'Image';
  if (reference.type !== 'image') {
    return '<span class="image-unavailable" role="img" aria-label="' + escape(alt) + '">' +
      '<strong>' + escape(alt) + '</strong><span>' + escape(reference.message) + '</span></span>';
  }
  return '<img src="' + escape(reference.src) + '" alt="' + escape(alt) + '" loading="lazy" decoding="async"' +
    (token.attrGet('title') ? ' title="' + escape(token.attrGet('title')) + '"' : '') + '>';
};

export async function renderMarkdown(markdown, resolveReference) {
  const source = markdown.replace(/^\uFEFF/, '')
    .replace(/^---\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/, '');
  const env = { references: [] };
  const tokens = md.parse(source, env);
  const slugger = new GithubSlugger();
  const headings = [];
  let leadTitle = false;
  for (const [index, token] of tokens.entries()) {
    if (token.type !== 'heading_open') continue;
    const text = textOf(tokens[index + 1].children);
    const id = slugger.slug(slug(text) ? text : 'Section');
    token.attrSet('id', 'heading-' + id);
    token.attrSet('tabindex', '-1');
    headings.push({ id, text, level: Number(token.tag.slice(1)) });
    if (index === 0 && token.tag === 'h1') leadTitle = true;
  }
  async function prepare(items) {
    for (const token of items) {
      if (token.type === 'link_open' || token.type === 'image') {
        const reference = await resolveReference(token.attrGet(token.type === 'image' ? 'src' : 'href'), token.type === 'image');
        token.meta = { ...token.meta, reference: env.references.length };
        env.references.push(reference);
      }
      if (token.children) await prepare(token.children);
    }
  }
  await prepare(tokens);
  return { html: md.renderer.render(tokens, md.options, env), headings, references: env.references, leadTitle };
}
