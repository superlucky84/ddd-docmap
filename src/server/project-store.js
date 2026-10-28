import path from 'node:path';
import { watch } from 'chokidar';
import { scanProject } from '../collector/scan.js';
import { createSearchIndex } from '../collector/search.js';
import { CONFIG_FILE } from '../collector/config.js';

/** Owns one project's watcher and atomically published read/search generation. */
export async function createProjectStore(root, { watcherFactory = watch } = {}) {
  let current;
  let error = null;
  let watcher;
  let timer;
  let running;
  let dirty = false;
  let reconfigure = false;
  let closed = false;
  let closing;
  let cancelReady;
  const listeners = new Set();
  const notify = type => {
    for (const listener of listeners) listener(type, status());
  };
  const status = () => ({ sequence: current.sequence, revision: current.snapshot.revision, error });
  function publish(scan) {
    current = { ...scan, sequence: (current?.sequence || 0) + 1,
      documents: new Map(scan.snapshot.documents.map(document => [document.id, document])),
      redirects: new Map(scan.snapshot.redirects.map(entry => [entry.source, entry.targetId])),
      searchIndex: createSearchIndex(scan) };
    error = null;
  }
  publish(await scanProject(root, { previous: current }));
  root = current.snapshot.project.rootLabel;

  async function startWatcher() {
    const policy = current.acceptsPath;
    const next = watcherFactory(root, {
      ignoreInitial: true, followSymlinks: false, atomic: 120,
      // Native fs.watch can suppress the first write immediately after startup.
      usePolling: true, interval: 300, binaryInterval: 500,
      awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 40 },
      ignored(filename, stat) {
        const relative = path.relative(root, filename).split(path.sep).join('/');
        if (!relative) return false;
        if (relative === CONFIG_FILE) return false;
        if (path.posix.basename(relative) === '.gitignore') {
          const parent = path.posix.dirname(relative);
          return parent !== '.' && !policy(parent, true);
        }
        if (!stat) return false;
        if (stat.isSymbolicLink()) return true;
        if (!policy(relative, stat.isDirectory())) return true;
        return stat.isFile() && !/\.(?:md|png|jpe?g|gif|webp|avif)$/i.test(relative);
      }
    });
    watcher = next;
    next.on('all', (_event, filename) => {
      if (closed) return;
      const name = path.basename(filename);
      if (name === CONFIG_FILE || name === '.gitignore') reconfigure = true;
      dirty = true;
      clearTimeout(timer);
      timer = setTimeout(() => { void rebuild(); }, 150);
    });
    next.on('error', cause => {
      if (!closed) { error = 'File watching failed: ' + cause.message; notify('update-error'); }
    });
    await new Promise((resolve, reject) => {
      const cleanup = () => {
        next.off('ready', ready);
        next.off('error', failed);
        if (cancelReady === cancel) cancelReady = null;
      };
      const ready = () => { cleanup(); resolve(); };
      const failed = cause => { cleanup(); reject(cause); };
      const cancel = () => failed(new Error('The project watcher was closed.'));
      cancelReady = cancel;
      next.once('ready', ready);
      next.once('error', failed);
      if (closed) cancel();
    });
  }

  async function rebuild() {
    if (closed) return;
    if (running) return running;
    running = (async () => {
      while (dirty && !closed) {
        dirty = false;
        const reset = reconfigure;
        reconfigure = false;
        try {
          const scan = await scanProject(root, { previous: current });
          if (closed) return;
          publish(scan);
          if (reset) {
            await watcher.close();
            if (closed) return;
            await startWatcher();
            // Include changes made while the replacement watcher was starting.
            if (closed) return;
            const audited = await scanProject(root, { previous: current });
            if (closed) return;
            publish(audited);
          }
          if (!closed) notify('change');
        } catch (cause) {
          if (!closed) { error = cause.message; notify('update-error'); }
        }
      }
    })().finally(() => { running = null; });
    return running;
  }

  try {
    await startWatcher();
    const scan = await scanProject(root, { previous: current });
    if (scan.snapshot.revision !== current.snapshot.revision) publish(scan);
  } catch (cause) {
    closed = true;
    clearTimeout(timer);
    await watcher?.close();
    throw cause;
  }
  return {
    get current() { return current; },
    status,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    close() {
      if (!closing) {
        closed = true;
        clearTimeout(timer);
        listeners.clear();
        cancelReady?.();
        closing = (async () => { await watcher.close(); await running; })();
      }
      return closing;
    }
  };
}
