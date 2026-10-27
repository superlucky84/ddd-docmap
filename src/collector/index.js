import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import ignore from 'ignore';
import { CONFIG_FILE, loadConfiguration } from './config.js';
import { ProjectError } from './errors.js';
import {
  documentKind, DOCUMENT_ORDER, extractMetadata, groupTitle, REPRESENTATIVE_ORDER
} from './markdown.js';

export { ConfigurationError, ProjectError } from './errors.js';

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
export async function collectProject(directory = process.cwd()) {
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
  const warnings = [];
  const warn = (code, filename, message) => warnings.push({
    code, path: relativePath(root, filename) || '.', message
  });

  async function readRegular(filename) {
    const stat = await fs.lstat(filename);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw Object.assign(new Error('not a regular file'), { code: 'NOT_REGULAR' });
    }
    const resolved = await fs.realpath(filename);
    if (!isInside(root, resolved)) {
      throw Object.assign(new Error('outside project root'), { code: 'OUTSIDE_ROOT' });
    }
    return fs.readFile(resolved, 'utf8');
  }

  function isIgnored(filename, directory, layers) {
    let ignored = false;
    for (const layer of layers) {
      const relative = relativePath(layer.directory, filename) + (directory ? '/' : '');
      const result = layer.matcher.test(relative);
      if (result.ignored) {
        ignored = true;
      } else if (result.unignored) {
        ignored = false;
      }
    }
    return ignored;
  }

  async function walk(directory, inherited) {
    const ignorePath = path.join(directory, '.gitignore');
    let layers = inherited;
    try {
      const rules = await readRegular(ignorePath);
      layers = [...inherited, {
        directory, matcher: ignore({ ignorecase: false }).add(rules)
      }];
    } catch (cause) {
      if (cause.code !== 'ENOENT') {
        warn('IGNORE_READ_FAILED', ignorePath, 'Subtree skipped: cannot read ignore rules (' + cause.code + ')');
        return;
      }
    }

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
      if (['.git', 'node_modules'].includes(entry.name.toLowerCase())) {
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
        const metadata = extractMetadata(markdown, entry.name);
        headings.set(relative, metadata.headingTitle);
        documents.push({
          id: relative, relativePath: relative,
          groupId: path.posix.dirname(relative),
          kind: documentKind(entry.name),
          title: metadata.title, summary: metadata.summary,
          canonicalId: null, contentHash: hash(markdown)
        });
      } catch (cause) {
        warn('DOCUMENT_READ_FAILED', filename, 'Cannot read document (' + (cause.code || cause.name) + ')');
      }
    }
  }

  await walk(root, []);
  documents.sort((left, right) => compare(left.id, right.id));
  const groups = buildGroups(documents, config, project, warnings, headings);
  warnings.sort((left, right) =>
    compare(left.path, right.path) || compare(left.code, right.code) || compare(left.message, right.message)
  );
  const data = { project, groups, documents, warnings };
  return { revision: hash(JSON.stringify(data)), ...data };
}
