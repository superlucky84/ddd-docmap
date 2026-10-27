const normalize = text => text.normalize('NFC').toLowerCase();
export const queryTerms = query => [...new Set(normalize(query).trim().split(/\s+/).filter(Boolean))];

export function createSearchIndex({ snapshot, searchTexts }) {
  const groups = new Map(snapshot.groups.map(group => [group.id, group]));
  return snapshot.documents.filter(document => !document.canonicalId).map(document => {
    const groupTitle = groups.get(document.groupId).title;
    const fields = [
      ['title', document.title, 100], ['feature', groupTitle, 80],
      ['path', document.relativePath, 60],
      ['previous path', snapshot.redirects.filter(entry => entry.targetId === document.id).map(entry => entry.source).join(' '), 50],
      ['summary', document.summary, 20], ['body', searchTexts.get(document.id) || '', 1]
    ].map(([name, text, weight]) => ({ name, text: text.normalize('NFC'), value: normalize(text), weight }));
    return { document, groupTitle, fields };
  });
}

export function searchDocuments(index, query) {
  const terms = queryTerms(query);
  if (!terms.length) return { query, total: 0, results: [] };
  const matches = [];
  for (const { document, groupTitle, fields } of index) {
    if (!terms.every(term => fields.some(field => field.value.includes(term)))) continue;
    const score = terms.reduce((sum, term) => sum + Math.max(...fields.map(field => field.value.includes(term) ? field.weight : 0)), 0);
    const context = [...fields].reverse().find(field => terms.some(term => field.value.includes(term)));
    const offset = Math.min(...terms.map(term => context.value.indexOf(term)).filter(value => value >= 0));
    const start = Math.max(0, offset - 45);
    const snippet = (start ? '…' : '') + context.text.slice(start, start + 160) + (start + 160 < context.text.length ? '…' : '');
    matches.push({ id: document.id, title: document.title, relativePath: document.relativePath,
      groupTitle, matchedField: context.name, snippet, score });
  }
  matches.sort((left, right) => right.score - left.score || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
  return { query, total: matches.length, results: matches.slice(0, 50).map(({ score, ...result }) => result) };
}
