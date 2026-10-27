import fs from 'node:fs/promises';
import path from 'node:path';

export async function resolveRedirects({ root, config, documents, warnings, acceptsPath }) {
  const byId = new Map(documents.map(document => [document.id, document]));
  const allowed = new Set();
  for (const source of config.redirects.keys()) {
    let valid = acceptsPath(source) && config.isIncluded(source);
    let filename = root;
    for (const segment of source.split('/')) {
      filename = path.join(filename, segment);
      try {
        if ((await fs.lstat(filename)).isSymbolicLink()) valid = false;
      } catch (error) {
        if (error.code !== 'ENOENT') valid = false;
        break;
      }
    }
    if (valid) allowed.add(source);
  }
  const result = [];
  for (const source of config.redirects.keys()) {
    const visited = new Set();
    let target = source;
    let reason;
    while (config.redirects.has(target)) {
      if (visited.has(target)) { reason = 'Cyclic or self-referencing redirect'; break; }
      if (!allowed.has(target)) { reason = 'Redirect source is outside the collection'; break; }
      visited.add(target);
      target = config.redirects.get(target);
    }
    if (!reason && !byId.has(target)) reason = 'Redirect target is not in the collection';
    if (reason) {
      warnings.push({ code: 'INVALID_REDIRECT', path: source, message: reason });
      continue;
    }
    result.push({ source, targetId: target });
    if (byId.has(source)) byId.get(source).canonicalId = target;
  }
  return result.sort((left, right) => left.source < right.source ? -1 : left.source > right.source ? 1 : 0);
}
