const $ = id => document.getElementById(id);
const labels = {
  requirements: 'Requirements', design: 'Design', implementation: 'Implementation',
  'manual-test': 'Checks', readme: 'Overview', research: 'Research', other: 'Document'
};
const state = {
  map: null, groups: new Map(), documents: new Map(), expanded: new Set(['.']),
  openDocuments: null, selectedId: null, request: null
};

function element(tag, className, text) {
  const value = document.createElement(tag);
  if (className) value.className = className;
  if (text !== undefined) value.textContent = text;
  return value;
}

function childrenOf(group) {
  return group.childIds.flatMap(id => {
    const child = state.groups.get(id);
    if (child.isStructural && child.sourceDirectory.split('/').at(-1).toLowerCase() === 'docs') {
      return childrenOf(child);
    }
    return [child];
  });
}

function renderTree() {
  const scroll = $('map-scroll').scrollTop;
  const focusKey = document.activeElement?.dataset.focusKey;
  const root = state.groups.get('.');
  const roots = root.documentIds.length ? [root] : childrenOf(root);
  $('map-tree').replaceChildren(...roots.map(renderGroup));
  $('map-scroll').scrollTop = scroll;
  if (focusKey) {
    document.querySelector('[data-focus-key="' + CSS.escape(focusKey) + '"]')?.focus({ preventScroll: true });
  }
}

function renderGroup(group) {
  const item = element('li', 'tree-item');
  item.dataset.groupId = group.id;
  const row = element('div', 'tree-row');
  if (state.openDocuments === group.id) row.classList.add('is-open-docs');
  if (state.documents.get(state.selectedId)?.groupId === group.id) row.classList.add('is-selected');
  const children = childrenOf(group);
  const index = state.map.groups.indexOf(group);
  if (children.length) {
    const toggle = element('button', 'chevron', '›');
    toggle.type = 'button';
    const expanded = state.expanded.has(group.id);
    if (expanded) toggle.classList.add('is-open');
    toggle.setAttribute('aria-label', (expanded ? 'Collapse ' : 'Expand ') + group.title);
    toggle.setAttribute('aria-expanded', String(expanded));
    toggle.setAttribute('aria-controls', 'children-' + index);
    toggle.dataset.focusKey = 'toggle:' + group.id;
    toggle.onclick = () => {
      if (expanded) state.expanded.delete(group.id);
      else state.expanded.add(group.id);
      renderTree();
    };
    row.append(toggle);
  } else {
    const spacer = element('span', 'chevron-spacer');
    spacer.setAttribute('aria-hidden', 'true');
    row.append(spacer);
  }

  if (group.documentIds.length) {
    const main = element('button', 'card-main');
    main.type = 'button';
    main.title = group.title + '\n' + group.sourceDirectory;
    main.dataset.focusKey = 'group:' + group.id;
    main.setAttribute('aria-label', 'Show documents for ' + group.title);
    main.setAttribute('aria-expanded', String(state.openDocuments === group.id));
    main.setAttribute('aria-controls', 'documents-' + index);
    main.append(element('span', 'card-title', group.title));
    if (group.summary) main.append(element('span', 'card-summary', group.summary));
    main.onclick = () => {
      state.openDocuments = state.openDocuments === group.id ? null : group.id;
      renderTree();
    };
    row.append(main, element('span', 'doc-count', String(group.documentIds.length)));
  } else {
    row.append(element('span', 'structure-title', group.title));
  }
  item.append(row);

  if (group.documentIds.length) {
    const list = element('div', 'document-list');
    list.id = 'documents-' + index;
    list.hidden = state.openDocuments !== group.id;
    list.setAttribute('role', 'group');
    list.setAttribute('aria-label', 'Documents for ' + group.title);
    for (const id of group.documentIds) {
      const source = state.documents.get(id);
      const duplicate = group.documentIds.filter(other => state.documents.get(other).kind === source.kind).length > 1;
      const label = source.kind === 'other' || duplicate ? source.title : labels[source.kind];
      const button = element('button', 'document-button', label);
      button.type = 'button';
      button.title = source.relativePath;
      if (duplicate) button.setAttribute('aria-label', label + ' — ' + source.relativePath);
      button.dataset.focusKey = 'doc:' + source.id;
      if (source.id === state.selectedId) button.setAttribute('aria-current', 'page');
      button.onclick = () => { void selectDocument(id); };
      list.append(button);
    }
    item.append(list);
  }
  if (children.length) {
    const list = element('ul', 'children');
    list.id = 'children-' + index;
    list.hidden = !state.expanded.has(group.id);
    list.append(...children.map(renderGroup));
    item.append(list);
  }
  return item;
}

async function selectDocument(id) {
  state.request?.abort();
  const request = new AbortController();
  state.request = request;
  state.selectedId = id;
  renderTree();
  const source = state.documents.get(id);
  $('reader-empty').hidden = true;
  $('document-view').hidden = false;
  $('document-title').textContent = source.title;
  $('document-path').textContent = source.relativePath;
  $('document-area').textContent = state.groups.get(source.groupId).title;
  $('document-source').textContent = '';
  $('document-status').classList.remove('is-error');
  $('document-status').textContent = 'Opening document…';
  $('reader-scroll').scrollTop = 0;
  document.body.dataset.view = 'document';
  try {
    const response = await fetch('/api/document?id=' + encodeURIComponent(id), { signal: request.signal });
    const result = await response.json();
    if (state.request !== request) return;
    if (!response.ok) throw new Error(result.error);
    $('document-source').textContent = result.markdown;
    $('document-status').textContent = '';
    if (matchMedia('(max-width: 900px)').matches) $('document-title').focus({ preventScroll: true });
  } catch (error) {
    if (error.name === 'AbortError' || state.request !== request) return;
    $('document-status').textContent = error.message || 'This document could not be opened.';
    $('document-status').classList.add('is-error');
  }
}

$('back-to-map').onclick = () => {
  document.body.dataset.view = 'map';
  document.querySelector('[data-focus-key="' + CSS.escape('doc:' + state.selectedId) + '"]')?.focus({ preventScroll: true });
};

async function load() {
  try {
    const response = await fetch('/api/map');
    if (!response.ok) throw new Error('The project could not be loaded.');
    state.map = await response.json();
    state.groups = new Map(state.map.groups.map(group => [group.id, group]));
    state.documents = new Map(state.map.documents.map(source => [source.id, source]));
    for (const group of state.map.groups) {
      if (group.isStructural) state.expanded.add(group.id);
    }
    const project = state.map.project;
    document.title = project.displayName + ' · ddd-docmap';
    $('project-name').textContent = project.displayName;
    $('project-root').textContent = project.rootLabel;
    $('project-root').title = project.rootLabel;
    const features = state.map.groups.filter(group => group.documentIds.length).length;
    $('map-count').textContent = features + ' features · ' + state.map.documents.length + ' documents';
    if (!state.map.documents.length) {
      $('map-message').textContent = 'No documentation found. Add Markdown under a docs folder, or use ddd-docmap.config.json to include another location.';
    }
    if (state.map.warnings.length) {
      $('warnings').hidden = false;
      $('warning-summary').textContent = state.map.warnings.length + ' collection notices';
      $('warning-list').replaceChildren(...state.map.warnings.map(warning =>
        element('li', '', warning.path + ': ' + warning.message)));
    }
    renderTree();
  } catch (error) {
    $('project-name').textContent = 'Project unavailable';
    $('map-count').textContent = '';
    $('map-message').textContent = error.message + ' Check the CLI terminal and reopen the printed address.';
  }
}

void load();
