const $ = id => document.getElementById(id);
const node = (tag, className, text) => {
  const value = document.createElement(tag);
  if (className) value.className = className;
  if (text !== undefined) value.textContent = text;
  return value;
};
const routeUrl = (id, fragment = '') => id
  ? '/?doc=' + encodeURIComponent(id) + (fragment ? '#' + encodeURIComponent(fragment) : '')
  : '/';

export function createReader({ projectId, getDocument, getGroup, onSelect, captureMap, restoreMap, onError }) {
  const state = {
    current: null, mode: 'read', fragment: '', request: null, requestLive: false,
    entryId: crypto.randomUUID(), positions: new Map(), cache: new Map(), modes: new Map(),
    documents: new Map(), restorePosition: null, sequence: 0, refreshAttempt: 0, missingId: null
  };
  history.scrollRestoration = 'manual';

  function remember() {
    if (state.current) {
      state.modes.set(state.current.id + ':' + state.mode, $('reader-scroll').scrollTop);
      state.documents.set(state.current.id, { mode: state.mode, scroll: $('reader-scroll').scrollTop });
    }
    state.positions.set(state.entryId, {
      mode: state.mode, readerScroll: $('reader-scroll').scrollTop,
      map: captureMap(), view: document.body.dataset.view
    });
  }

  function notice(message, relativePath = '') {
    $('link-notice').hidden = false;
    $('link-message').textContent = message;
    $('link-path').textContent = relativePath;
    $('link-path').hidden = !relativePath;
    $('copy-link-path').hidden = !relativePath;
    $('copy-link-path').textContent = 'Copy path';
    if (document.body.dataset.view === 'map') onError(message);
  }

  function clearNotice() {
    $('link-notice').hidden = true;
    $('link-path').textContent = '';
  }

  function applyMode() {
    const read = state.mode === 'read';
    $('document-view').dataset.mode = state.mode;
    $('document-content').hidden = !read;
    $('document-source').hidden = read;
    $('document-toc').hidden = !read || !$('toc-links').children.length;
    $('reading-layout').classList.toggle('has-toc', read && !$('document-toc').hidden);
    $('view-toggle').textContent = read ? 'View source' : 'Read document';
    $('document-mode').textContent = read ? 'Reading' : 'Markdown source';
  }

  function headingPosition(fragment) {
    const heading = document.getElementById('heading-' + fragment);
    return heading
      ? Math.max(0, heading.getBoundingClientRect().top - $('reader-scroll').getBoundingClientRect().top +
        $('reader-scroll').scrollTop - 18)
      : 0;
  }

  function setPosition(scroll, fragment = '') {
    const apply = () => { $('reader-scroll').scrollTop = fragment ? headingPosition(fragment) : scroll; };
    state.restorePosition = apply;
    apply();
    for (const image of $('document-content').querySelectorAll('img')) {
      image.addEventListener('load', () => {
        if (state.restorePosition === apply) apply();
      }, { once: true });
    }
  }

  function writeRoute(id, fragment, replace = false) {
    if (!replace) state.entryId = crypto.randomUUID();
    history[replace ? 'replaceState' : 'pushState'](
      { docmap: projectId, entryId: state.entryId, docId: id, fragment }, '', routeUrl(id, fragment)
    );
  }

  function renderToc(data) {
    $('toc-details').open = matchMedia('(min-width: 1280px)').matches;
    const headings = data.headings.filter((heading, index) => !(index === 0 && data.leadTitle));
    $('toc-links').replaceChildren(...headings.map(heading => {
      const link = node('a', 'toc-level-' + heading.level, heading.text || 'Section');
      link.href = routeUrl(data.id, heading.id);
      link.dataset.fragment = heading.id;
      return link;
    }));
  }

  async function open(id, options = {}) {
    let source = getDocument(id);
    if (!source) {
      onError('This document is not in the current map.');
      return false;
    }
    id = source.id;
    if (!options.entry) remember();
    state.request?.abort();
    const request = new AbortController();
    state.request = request;
    state.requestLive = Boolean(options.live);
    state.restorePosition = null;
    clearNotice();
    if (state.current?.id === id && !options.fromLink && !options.entry && !options.force && (state.current.sequence || 0) >= state.sequence) {
      $('document-status').textContent = '';
      document.body.dataset.view = 'document';
      state.request = null;
      return true;
    }
    if (!state.current) {
      $('reader-empty').hidden = true;
      $('document-view').hidden = false;
      $('document-title').textContent = source.title;
      $('document-path').textContent = source.relativePath;
      $('document-area').textContent = getGroup(source.groupId)?.title || source.groupId;
      document.body.dataset.view = 'document';
    }
    $('document-status').classList.remove('is-error');
    $('document-status').textContent = options.live ? '' : 'Opening document…';
    try {
      let data = options.force ? null : state.current?.id === id ? state.current : options.entry ? state.cache.get(id) : null;
      if (!data) {
        const response = await fetch('/api/document?id=' + encodeURIComponent(id), { signal: request.signal });
        data = await response.json();
        if (state.request !== request) return false;
        if (!response.ok) throw new Error(data.error);
        if (typeof data.html !== 'string' || !Array.isArray(data.headings) || !Array.isArray(data.references)) {
          throw new Error('The document response is incomplete. Restart the CLI and reload this page.');
        }
      }
      if (request.signal.aborted) return false;
      if (data.id && data.id !== id) {
        source = getDocument(data.id);
        if (!source) throw new Error('The map is updating. Select this document again in a moment.');
        id = source.id;
      } else source = getDocument(id) || source;
      const fragment = options.fragment || '';
      if (fragment && !data.headings.some(heading => heading.id === fragment) && state.current && !options.live) {
        $('document-status').textContent = '';
        notice('Section not found: ' + fragment);
        return false;
      }
      if (options.live) {
        options.restore = { ...options.restore, mode: state.mode,
          readerScroll: $('reader-scroll').scrollTop, view: document.body.dataset.view };
      }
      state.current = data;
      state.missingId = null;
      state.cache.set(id, data);
      state.fragment = fragment;
      const saved = options.restore || state.documents.get(id);
      state.mode = options.fromLink ? 'read' : saved?.mode || 'read';
      $('reader-empty').hidden = true;
      $('document-view').hidden = false;
      $('document-view').classList.toggle('has-lead-title', Boolean(data.leadTitle));
      $('document-title').textContent = source.title;
      $('document-path').textContent = source.relativePath;
      $('document-area').textContent = getGroup(source.groupId)?.title || source.groupId;
      $('document-source').textContent = data.markdown;
      $('document-content').innerHTML = data.html;
      $('document-status').textContent = '';
      renderToc(data);
      applyMode();
      document.body.dataset.view = options.restore?.view || 'document';
      onSelect(id, !options.restore);
      if (options.restore?.map && !options.live) restoreMap(options.restore.map);
      if (options.entry) {
        state.entryId = options.entry.entryId;
        if (currentRoute().id !== id) writeRoute(id, fragment, true);
      } else {
        writeRoute(id, fragment, Boolean(options.replace));
      }
      await new Promise(resolve => requestAnimationFrame(resolve));
      if (state.request !== request) return false;
      setPosition(options.restore?.readerScroll ?? saved?.scroll ?? 0, options.restore ? '' : fragment);
      if (fragment && !data.headings.some(heading => heading.id === fragment)) {
        notice('Section not found: ' + fragment);
      }
      if (!options.live && (matchMedia('(max-width: 900px)').matches || options.fromLink) && document.body.dataset.view === 'document') {
        const heading = state.mode === 'read' && (fragment
          ? document.getElementById('heading-' + fragment)
          : data.leadTitle ? document.getElementById('heading-' + data.headings[0].id) : null);
        (heading || $('document-title')).focus({ preventScroll: true });
      }
      remember();
      return true;
    } catch (error) {
      if (error.name === 'AbortError' || state.request !== request) return false;
      $('document-status').textContent = state.current ? '' : error.message;
      if (state.current) notice(error.message);
      else $('document-status').classList.add('is-error');
      return false;
    } finally {
      if (state.request === request) {
        state.request = null;
        if ((state.current?.sequence || 0) < state.sequence && (!options.live || state.sequence > state.refreshAttempt)) {
          queueMicrotask(() => { void refresh(state.sequence); });
        }
      }
    }
  }

  async function refresh(sequence) {
    state.sequence = Math.max(state.sequence, sequence);
    state.cache.clear();
    if (state.request) return;
    state.refreshAttempt = state.sequence;
    const id = state.current?.id || state.missingId;
    if (!id) return;
    remember();
    const saved = state.positions.get(state.entryId);
    const source = getDocument(id);
    if (!source) {
      state.missingId = id;
      state.current = null;
      state.restorePosition = null;
      $('document-content').replaceChildren();
      $('document-source').textContent = '';
      $('toc-links').replaceChildren();
      $('document-toc').hidden = true;
      $('document-view').classList.remove('has-lead-title');
      $('document-status').textContent = 'This document was removed from the map. Choose another document.';
      $('document-status').classList.add('is-error');
      clearNotice();
      onSelect(null, false);
      return;
    }
    if (source.id !== id) onSelect(source.id, true);
    await open(source.id, { force: true, live: true, replace: true, restore: saved, fragment: state.fragment });
  }

  function showMap({ cancelPending = false } = {}) {
    remember();
    if (cancelPending && state.request && !state.requestLive) {
      state.request.abort();
      state.request = null;
      $('document-status').textContent = '';
      if (!state.current) {
        $('document-view').hidden = true;
        $('reader-empty').hidden = false;
      }
    }
    document.body.dataset.view = 'map';
    document.querySelector('[data-focus-key="' + CSS.escape('doc:' + state.current?.id) + '"]')?.focus({ preventScroll: true });
  }

  $('view-toggle').onclick = () => {
    if (!state.current) return;
    remember();
    state.restorePosition = null;
    state.mode = state.mode === 'read' ? 'source' : 'read';
    applyMode();
    setPosition(state.modes.get(state.current.id + ':' + state.mode) || 0);
  };
  $('back-to-map').onclick = showMap;
  $('dismiss-notice').onclick = clearNotice;
  $('copy-link-path').onclick = async () => {
    try {
      await navigator.clipboard.writeText($('link-path').textContent);
      $('copy-link-path').textContent = 'Copied';
    } catch {
      $('link-message').textContent = 'Select the path below to copy it.';
    }
  };
  $('document-content').addEventListener('click', event => {
    const link = event.target.closest('a[data-reference]');
    if (!link || !state.current) return;
    const reference = state.current.references[Number(link.dataset.reference)];
    if (!reference || reference.type === 'external') return;
    if (reference.type === 'document' && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) return;
    event.preventDefault();
    if (reference.type === 'document') {
      void open(reference.targetId, { fragment: reference.fragment, fromLink: true });
    } else {
      notice(reference.message, reference.relativePath || '');
    }
  });
  $('document-content').addEventListener('error', event => {
    if (event.target.tagName !== 'IMG') return;
    event.target.replaceWith(node('span', 'image-unavailable', 'Image could not be loaded: ' + event.target.alt));
  }, true);
  $('toc-links').addEventListener('click', event => {
    const link = event.target.closest('a[data-fragment]');
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    void open(state.current.id, { fragment: link.dataset.fragment, fromLink: true });
  });
  for (const type of ['wheel', 'pointerdown', 'keydown']) {
    $('reader-scroll').addEventListener(type, () => { state.restorePosition = null; }, { passive: true });
  }

  function currentRoute() {
    const url = new URL(location.href);
    let fragment = '';
    try { fragment = decodeURIComponent(url.hash.slice(1)); } catch {}
    return { id: url.searchParams.get('doc'), fragment };
  }

  window.addEventListener('popstate', event => {
    remember();
    state.request?.abort();
    const route = currentRoute();
    const entryId = event.state?.docmap === projectId ? event.state.entryId : crypto.randomUUID();
    const saved = state.positions.get(entryId);
    if (!route.id) {
      state.entryId = entryId;
      state.current = null;
      state.missingId = null;
      $('document-view').hidden = true;
      $('reader-empty').hidden = false;
      document.body.dataset.view = 'map';
      onSelect(null, false);
      if (saved?.map) restoreMap(saved.map);
      return;
    }
    void open(route.id, { fragment: route.fragment, entry: { entryId }, restore: saved }).then(ok => {
      if (!ok && state.current) {
        state.entryId = entryId;
        writeRoute(state.current.id, state.fragment, true);
      }
    });
  });

  return {
    open, refresh, showMap,
    async initialize() {
      const route = currentRoute();
      writeRoute(null, '', true);
      remember();
      if (route.id && !await open(route.id, { fragment: route.fragment, fromLink: true, replace: true })) {
        if (!state.current) writeRoute(null, '', true);
      }
    }
  };
}
