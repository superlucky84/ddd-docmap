import path from 'node:path';
import { CollectionOptionsError } from './errors.js';

/** Copy immutable discovery options; folder names are literal project-relative paths. */
export function normalizeCollectionOptions(options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new CollectionOptionsError('Collection options must be an object.');
  }
  for (const key of Object.keys(options)) {
    if (!['docsDirs', 'allMarkdown'].includes(key)) {
      throw new CollectionOptionsError('Unknown collection option: ' + key);
    }
  }
  const { docsDirs = [], allMarkdown = false } = options;
  if (!Array.isArray(docsDirs) || typeof allMarkdown !== 'boolean') {
    throw new CollectionOptionsError('docsDirs must be an array and allMarkdown must be a boolean.');
  }
  const directories = docsDirs.map(directory => {
    if (typeof directory !== 'string' || !directory.trim() || directory.includes('\0') ||
        directory.includes('\\') || path.posix.isAbsolute(directory) || /^[a-z]:/i.test(directory) ||
        directory.split('/').includes('..')) {
      throw new CollectionOptionsError('Document directories must be project-relative paths using /, without .. or an absolute path.');
    }
    return path.posix.normalize(directory).replace(/\/$/, '') || '.';
  });
  return Object.freeze({ docsDirs: Object.freeze([...new Set(directories)]), allMarkdown });
}

export function matchesDocsDirectory(relative, directories) {
  return directories.some(directory => directory === '.' || relative.startsWith(directory + '/'));
}
