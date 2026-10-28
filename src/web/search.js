const $ = id => document.getElementById(id);
const termsFor = value => [...new Set(value.normalize('NFC').toLowerCase().trim().split(/\s+/).filter(Boolean))];

function highlighted(tag, className, value, terms) {
  const element = document.createElement(tag);
  element.className = className;
  const text = value.normalize('NFC');
  const lower = text.toLowerCase();
  let cursor = 0;
  while (cursor < text.length) {
    const matches = terms.map(term => ({ start: lower.indexOf(term, cursor), length: term.length }))
      .filter(match => match.start >= 0).sort((a, b) => a.start - b.start || b.length - a.length);
    const match = matches[0];
    if (!match) { element.append(document.createTextNode(text.slice(cursor))); break; }
    element.append(document.createTextNode(text.slice(cursor, match.start)));
    const mark = document.createElement('mark');
    mark.textContent = text.slice(match.start, match.start + match.length);
    element.append(mark);
    cursor = match.start + match.length;
  }
  return element;
}

export function createSearch({ open, reveal, showMap, getSequence, getSelected }) {
  let request;
  let timer;
  let composing = false;
  let treeScroll = 0;
  let searching = false;
  let restoreScroll = null;
  let version = 0;
  const input = $('doc-search');

  function selected() {
    for (const button of $('search-results').querySelectorAll('.search-result')) {
      if (button.dataset.documentId === getSelected()) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
  }

  async function run() {
    clearTimeout(timer);
    request?.abort();
    const currentVersion = ++version;
    const query = input.value.normalize('NFC').trim();
    const active = Boolean(query);
    if (active && !searching) treeScroll = $('map-scroll').scrollTop;
    searching = active;
    $('map-tree').hidden = active;
    $('search-view').hidden = !active;
    $('clear-search').hidden = !input.value;
    if (!active) {
      $('search-results').replaceChildren();
      $('search-results').removeAttribute('aria-busy');
      $('search-status').textContent = '';
      $('map-scroll').scrollTop = restoreScroll ?? treeScroll;
      restoreScroll = null;
      return;
    }
    $('search-status').textContent = 'Searching…';
    $('search-results').setAttribute('aria-busy', 'true');
    request = new AbortController();
    try {
      const response = await fetch('/api/search?q=' + encodeURIComponent(query), { signal: request.signal });
      const data = await response.json();
      if (currentVersion !== version) return;
      if (!response.ok) throw new Error(data.error);
      if (data.sequence < getSequence()) { timer = setTimeout(run, 100); return; }
      const focusId = document.activeElement?.dataset.documentId;
      const focusAction = document.activeElement?.dataset.action;
      const terms = termsFor(query);
      const scroll = restoreScroll ?? $('map-scroll').scrollTop;
      $('search-results').replaceChildren(...data.results.map(result => {
        const item = document.createElement('li');
        item.className = 'search-item';
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'search-result';
        button.dataset.documentId = result.id;
        button.dataset.action = 'open';
        button.append(highlighted('span', 'result-title', result.title, terms),
          highlighted('span', 'result-group', result.groupTitle, terms),
          highlighted('span', 'result-snippet', result.snippet, terms));
        button.title = 'Matched ' + result.matchedField;
        button.onclick = () => { void open(result.id); };
        const path = document.createElement('button');
        path.type = 'button';
        path.className = 'result-path';
        path.dataset.documentId = result.id;
        path.dataset.action = 'reveal';
        path.setAttribute('aria-label', 'Show ' + result.relativePath + ' in document tree');
        path.title = 'Show this document in the tree';
        const action = document.createElement('span');
        action.className = 'result-path-action';
        action.textContent = 'Show in tree';
        path.append(highlighted('span', 'result-path-text', result.relativePath, terms), action);
        path.onclick = () => {
          input.value = '';
          void run();
          reveal(result.id);
        };
        item.append(button, path);
        return item;
      }));
      selected();
      $('search-status').textContent = data.total
        ? data.total + (data.total === 1 ? ' document' : ' documents') + (data.total > 50 ? ' · showing first 50' : '')
        : 'No matching documents.';
      if (focusId) ($('search-results').querySelector('[data-document-id="' + CSS.escape(focusId) +
        '"][data-action="' + CSS.escape(focusAction || 'open') + '"]') || input).focus({ preventScroll: true });
      $('map-scroll').scrollTop = scroll;
      restoreScroll = null;
    } catch (error) {
      if (error.name !== 'AbortError' && currentVersion === version) {
        $('search-status').textContent = error.message;
        $('search-results').replaceChildren();
      }
    } finally {
      if (currentVersion === version) $('search-results').removeAttribute('aria-busy');
    }
  }
  const schedule = () => {
    request?.abort();
    version++;
    clearTimeout(timer);
    if (!composing) timer = setTimeout(run, 180);
  };
  input.addEventListener('input', schedule);
  input.addEventListener('compositionstart', () => { composing = true; schedule(); });
  input.addEventListener('compositionend', () => { composing = false; schedule(); });
  input.addEventListener('keydown', event => {
    if (event.isComposing) return;
    if (event.key === 'Escape') { input.value = ''; void run(); }
    if (event.key === 'ArrowDown') { $('search-results').querySelector('button')?.focus(); event.preventDefault(); }
  });
  $('search-form').onsubmit = event => { event.preventDefault(); if (!composing) void run(); };
  $('clear-search').onclick = () => { input.value = ''; void run(); input.focus(); };
  window.addEventListener('keydown', event => {
    if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey || event.isComposing ||
        /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName) || event.target.isContentEditable) return;
    event.preventDefault();
    showMap();
    input.focus();
  });
  return {
    refresh() { if (input.value.trim()) void run(); }, selected,
    capture: () => ({ query: input.value, treeScroll }),
    restore(saved, scroll) {
      input.value = saved?.query || '';
      treeScroll = saved?.treeScroll || 0;
      restoreScroll = scroll;
      void run();
    }
  };
}
