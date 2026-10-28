import { createReader } from './reader.js';
import { createSearch } from './search.js';
import { connectLive } from './live.js';

const $ = id => document.getElementById(id);
let reader;
let search;
const labels = {
  requirements: 'Requirements', design: 'Design', implementation: 'Implementation',
  'manual-test': 'Checks', readme: 'Overview', research: 'Research', other: 'Document'
};
const state = {
  map: null, groups: new Map(), documents: new Map(), redirects: new Map(), expanded: new Set(['.']),
  openDocuments: null, selectedId: null, locatedId: null
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
      if (source.id === state.locatedId) button.classList.add('is-located');
      button.onclick = () => { void reader.open(id); };
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

function getDocument(id) {
  return state.documents.get(state.redirects.get(id) || id);
}

function expandDocumentPath(source) {
  state.openDocuments = source.groupId;
  let parent = state.groups.get(source.groupId).parentId;
  while (parent !== null) {
    state.expanded.add(parent);
    parent = state.groups.get(parent).parentId;
  }
}

function revealDocument(id) {
  const source = getDocument(id);
  reader.showMap({ cancelPending: true });
  if (!source) {
    $('map-message').textContent = 'This document is no longer in the map. Search again to find its current location.';
    $('doc-search').focus({ preventScroll: true });
    return;
  }
  state.locatedId = source.id;
  expandDocumentPath(source);
  renderTree();
  const target = $('map-tree').querySelector('[data-focus-key="' + CSS.escape('doc:' + source.id) + '"]');
  $('map-message').textContent = 'Located in tree: ' + source.relativePath;
  if (target) {
    const scroll = $('map-scroll');
    scroll.scrollTop += target.getBoundingClientRect().top - scroll.getBoundingClientRect().top -
      (scroll.clientHeight - target.offsetHeight) / 2;
    target.focus({ preventScroll: true });
  }
}

function applyMap(map) {
  const oldGroups = state.groups;
  state.map = map;
  state.groups = new Map(map.groups.map(group => [group.id, group]));
  state.documents = new Map(map.documents.map(source => [source.id, source]));
  state.redirects = new Map(map.redirects.map(entry => [entry.source, entry.targetId]));
  state.expanded = new Set([...state.expanded].filter(id => state.groups.has(id)));
  for (const group of map.groups) {
    if (group.isStructural && !oldGroups.has(group.id)) state.expanded.add(group.id);
  }
  if (!state.groups.has(state.openDocuments)) state.openDocuments = null;
  state.selectedId = getDocument(state.selectedId)?.id || null;
  state.locatedId = getDocument(state.locatedId)?.id || null;
  const features = map.groups.filter(group => group.documentIds.length).length;
  const count = map.documents.filter(source => !source.canonicalId).length;
  $('map-count').textContent = features + ' features · ' + count + ' documents';
  $('map-message').textContent = count ? '' : 'No documentation found. Add Markdown under a docs folder, use --docs-dir or --all-md, or configure docatlas.config.json.';
  $('warnings').hidden = !map.warnings.length;
  $('warning-summary').textContent = map.warnings.length + ' collection notices';
  $('warning-list').replaceChildren(...map.warnings.map(warning =>
    element('li', '', warning.path + ': ' + warning.message)));
  renderTree();
}

async function load() {
  try {
    const response = await fetch('/api/map');
    if (!response.ok) throw new Error('The project could not be loaded.');
    applyMap(await response.json());
    const project = state.map.project;
    document.title = project.displayName + ' · docatlas';
    $('project-name').textContent = project.displayName;
    $('project-root').textContent = project.rootLabel;
    $('project-root').title = project.rootLabel;
    reader = createReader({
      projectId: project.id,
      getDocument,
      getGroup: id => state.groups.get(id),
      onSelect(id, reveal) {
        const source = getDocument(id);
        state.selectedId = source?.id || null;
        if (source) $('map-message').textContent = '';
        if (source && reveal) {
          state.locatedId = null;
          expandDocumentPath(source);
        }
        renderTree();
        search?.selected();
      },
      captureMap: () => ({
        scroll: $('map-scroll').scrollTop, expanded: [...state.expanded], openDocuments: state.openDocuments,
        search: search?.capture(), locatedId: state.locatedId
      }),
      restoreMap(saved) {
        state.expanded = new Set(saved.expanded.filter(id => state.groups.has(id)));
        state.openDocuments = state.groups.has(saved.openDocuments) ? saved.openDocuments : null;
        state.locatedId = getDocument(saved.locatedId)?.id || null;
        renderTree();
        search?.restore(saved.search, saved.scroll);
        $('map-scroll').scrollTop = saved.scroll;
      },
      onError: message => { $('map-message').textContent = message; }
    });
    search = createSearch({ open: reader.open, reveal: revealDocument, showMap: reader.showMap,
      getSequence: () => state.map.sequence, getSelected: () => state.selectedId });
    await reader.initialize();
    connectLive({
      getSequence: () => state.map.sequence,
      status(message) {
        $('live-status').textContent = message;
        $('live-status').classList.toggle('is-error', message !== 'Live updates');
      },
      async refresh() {
        const response = await fetch('/api/map');
        if (!response.ok) throw new Error('The document map could not be refreshed.');
        const map = await response.json();
        if (map.sequence <= state.map.sequence) return;
        applyMap(map);
        search.refresh();
        void reader.refresh(map.sequence);
      }
    });
  } catch (error) {
    $('project-name').textContent = 'Project unavailable';
    $('map-count').textContent = '';
    $('map-message').textContent = error.message + ' Check the CLI terminal and reopen the printed address.';
  }
}

void load();
