import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { extendIgnoreLayers, isIgnored, isProtectedName } from './policy.js';
import { CONFIG_FILE, loadConfiguration } from './config.js';
import { ProjectError } from './errors.js';
import {
  documentKind, DOCUMENT_ORDER, extractMetadata, groupTitle, REPRESENTATIVE_ORDER
} from './markdown.js';

import { resolveRedirects } from './redirects.js';
import { readRegularFile } from './read.js';

const compare = (left, right) => left < right ? -1 : left > right ? 1 : 0;
const hash = value => createHash('sha256').update(value).digest('hex');
const relativePath = (root, filename) => path.relative(root, filename).split(path.sep).join('/');
const isInside = (root, filename) => {
  const relative = path.relative(root, filename);
  return relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
};

function buildGroups(documents, config, project, warnings, headings) {
  const groups = new Map();
  const byId = new Map(documents.map(document => [document.id, document]));
  function add(id) {
    if (groups.has(id)) {
      return groups.get(id);
    }
    const parentId = id === '.' ? null : path.posix.dirname(id);
    if (parentId !== null) {
      add(parentId);
    }
    const group = {
      id, parentId, sourceDirectory: id,
      title: id === '.' ? project.displayName : path.posix.basename(id),
      summary: '', documentIds: [], childIds: [], isStructural: true
    };
    groups.set(id, group);
    if (parentId !== null) {
      groups.get(parentId).childIds.push(id);
    }
    return group;
  }
  add('.');
  for (const document of documents) {
    const group = add(document.groupId);
    group.documentIds.push(document.id);
    group.isStructural = false;
  }
  for (const group of groups.values()) {
    const members = group.documentIds.map(id => byId.get(id));
    const representative = [...members].sort((left, right) =>
      REPRESENTATIVE_ORDER.indexOf(left.kind) - REPRESENTATIVE_ORDER.indexOf(right.kind) ||
      compare(left.relativePath, right.relativePath)
    )[0];
    if (representative) {
      group.title = groupTitle(headings.get(representative.id)) || group.title;
      group.summary = representative.summary;
    }
    Object.assign(group, config.groups.get(group.id));
    group.documentIds.sort((left, right) =>
      DOCUMENT_ORDER.indexOf(byId.get(left).kind) - DOCUMENT_ORDER.indexOf(byId.get(right).kind) ||
      compare(left, right)
    );
    group.childIds.sort(compare);
  }
  for (const id of config.groups.keys()) {
    if (!groups.has(id)) {
      warnings.push({
        code: 'UNMATCHED_GROUP', path: CONFIG_FILE,
        message: 'No discovered group matches ' + id
      });
    }
  }
  return [...groups.values()].sort((left, right) => compare(left.id, right.id));
}

/**
 * Read a project's Markdown and return a deterministic document-map snapshot.
 * This function never modifies the target project or starts a server.
 */
export async function scanProject(directory = process.cwd(), { previous } = {}) {
  let root;
  try {
    if (typeof directory !== 'string' || !directory.trim()) {
      throw new TypeError('expected a non-empty directory path');
    }
    root = await fs.realpath(path.resolve(directory));
    if (!(await fs.stat(root)).isDirectory()) {
      throw new TypeError('expected a directory');
    }
  } catch (cause) {
    throw new ProjectError('Cannot open project root: ' + cause.message, { cause });
  }

  const config = await loadConfiguration(root);
  const project = { id: hash(root), displayName: path.basename(root), rootLabel: root };
  const documents = [];
  const headings = new Map();
  const metadataCache = new Map();
  const contents = new Map();
  const searchTexts = new Map();
  const directoryLayers = new Map();
  const warnings = [];
  const warn = (code, filename, message) => warnings.push({
    code, path: relativePath(root, filename) || '.', message
  });

  const readRegular = filename => readRegularFile(root, filename);

  async function walk(directory, inherited) {
    const ignorePath = path.join(directory, '.gitignore');
    let layers = inherited;
    try {
      const rules = await readRegular(ignorePath);
      layers = extendIgnoreLayers(inherited, directory, rules);
    } catch (cause) {
      if (cause.code !== 'ENOENT') {
        warn('IGNORE_READ_FAILED', ignorePath, 'Subtree skipped: cannot read ignore rules (' + cause.code + ')');
        return;
      }
    }

    directoryLayers.set(directory, layers);
    let entries;
    try {
      const resolved = await fs.realpath(directory);
      if (!isInside(root, resolved)) {
        warn('OUTSIDE_ROOT', directory, 'Directory is outside the project root');
        return;
      }
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch (cause) {
      warn('DIRECTORY_READ_FAILED', directory, 'Cannot read directory (' + cause.code + ')');
      return;
    }
    entries.sort((left, right) => compare(left.name, right.name));

    for (const entry of entries) {
      if (isProtectedName(entry.name)) {
        continue;
      }
      const filename = path.join(directory, entry.name);
      const relative = relativePath(root, filename);
      if (entry.isSymbolicLink()) {
        warn('SYMLINK_SKIPPED', filename, 'Symbolic links are not collected');
        continue;
      }
      const isDirectory = entry.isDirectory();
      if (isIgnored(filename, isDirectory, layers) || config.isExcluded(relative, isDirectory)) {
        continue;
      }
      if (isDirectory) {
        await walk(filename, layers);
        continue;
      }
      if (!entry.isFile() || !/\.md$/i.test(entry.name) || !config.isIncluded(relative)) {
        continue;
      }
      try {
        const markdown = await readRegular(filename);
        const contentHash = hash(markdown);
        const cached = previous?.snapshot.project.id === project.id ? previous.metadataCache?.get(relative) : null;
        const metadata = cached?.contentHash === contentHash
          ? cached : { ...extractMetadata(markdown, entry.name), contentHash };
        metadataCache.set(relative, metadata);
        headings.set(relative, metadata.headingTitle);
        contents.set(relative, markdown);
        searchTexts.set(relative, metadata.searchText);
        documents.push({
          id: relative, relativePath: relative,
          groupId: path.posix.dirname(relative),
          kind: documentKind(entry.name),
          title: metadata.title, summary: metadata.summary,
          canonicalId: null, contentHash
        });
      } catch (cause) {
        warn('DOCUMENT_READ_FAILED', filename, 'Cannot read document (' + (cause.code || cause.name) + ')');
      }
    }
  }

  await walk(root, []);
  documents.sort((left, right) => compare(left.id, right.id));
  function acceptsPath(relative, directory = false) {
    const segments = relative.split('/');
    let layers = directoryLayers.get(root) || [];
    for (let index = 0; index < segments.length; index++) {
      const local = segments.slice(0, index + 1).join('/');
      const filename = path.join(root, local);
      const isDirectory = index < segments.length - 1 || directory;
      if (isProtectedName(segments[index]) || config.isExcluded(local, isDirectory) ||
          isIgnored(filename, isDirectory, layers)) return false;
      if (isDirectory) layers = directoryLayers.get(filename) || layers;
    }
    return true;
  }
  const redirects = await resolveRedirects({ root, config, documents, warnings, acceptsPath });
  const groups = buildGroups(documents.filter(document => !document.canonicalId), config, project, warnings, headings);
  warnings.sort((left, right) =>
    compare(left.path, right.path) || compare(left.code, right.code) || compare(left.message, right.message)
  );
  const data = { project, groups, documents, redirects, warnings };
  return { snapshot: { revision: hash(JSON.stringify(data)), ...data }, contents, searchTexts, metadataCache, acceptsPath };
}
