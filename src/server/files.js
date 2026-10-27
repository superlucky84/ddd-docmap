import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { loadConfiguration } from '../collector/config.js';
import { extendIgnoreLayers, isIgnored, isProtectedName } from '../collector/policy.js';
import { HttpError } from './errors.js';

const isInside = (root, filename) => {
  const relative = path.relative(root, filename);
  return relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
};

function filesystemError(error) {
  if (error instanceof HttpError) return error;
  if (['ENOENT', 'ENOTDIR'].includes(error.code)) return new HttpError(404, 'This file no longer exists.');
  if (['EACCES', 'EPERM', 'ELOOP'].includes(error.code)) return new HttpError(403, 'This file cannot be read.');
  return error;
}

async function readRegular(root, filename, binary = false) {
  const stat = await fs.lstat(filename);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new HttpError(403, 'Only regular files can be opened.');
  }
  const resolved = await fs.realpath(filename);
  if (!isInside(root, resolved)) throw new HttpError(403, 'This file is outside the project.');
  const handle = await fs.open(resolved, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  try {
    if (!(await handle.stat()).isFile()) throw new HttpError(403, 'Only regular files can be opened.');
    return await handle.readFile(binary ? undefined : 'utf8');
  } finally {
    await handle.close();
  }
}

export async function createFileAccess(root) {
  const config = await loadConfiguration(root);
  const ignoreLayers = new Map();

  async function layersFor(directory, inherited) {
    if (!ignoreLayers.has(directory)) {
      ignoreLayers.set(directory, (async () => {
        try {
          const rules = await readRegular(root, path.join(directory, '.gitignore'));
          return extendIgnoreLayers(inherited, directory, rules);
        } catch (error) {
          if (error.code === 'ENOENT') return inherited;
          throw new HttpError(403, 'The ignore rules for this path cannot be read.');
        }
      })());
    }
    return ignoreLayers.get(directory);
  }

  async function inspect(relative) {
    if (
      typeof relative !== 'string' || !relative || path.posix.isAbsolute(relative) ||
      relative.includes('\\') || relative.includes('\0') || relative.split('/').includes('..') ||
      /^[a-z]:/i.test(relative)
    ) {
      throw new HttpError(403, 'This path is outside the project.');
    }
    try {
      if (relative === '.') return { absolute: root, stat: await fs.stat(root) };
      let filename = root;
      let layers = [];
      const segments = relative.split('/');
      for (const [index, segment] of segments.entries()) {
        if (isProtectedName(segment)) throw new HttpError(403, 'This path is excluded from the project.');
        layers = await layersFor(filename, layers);
        filename = path.join(filename, segment);
        const stat = await fs.lstat(filename);
        if (stat.isSymbolicLink()) throw new HttpError(403, 'Symbolic links cannot be opened.');
        const directory = stat.isDirectory();
        const local = path.relative(root, filename).split(path.sep).join('/');
        if (isIgnored(filename, directory, layers) || config.isExcluded(local, directory)) {
          throw new HttpError(403, 'This path is excluded from the project.');
        }
        if (index < segments.length - 1 && !directory) {
          throw new HttpError(404, 'This path no longer exists.');
        }
        if (index === segments.length - 1) {
          const resolved = await fs.realpath(filename);
          if (!isInside(root, resolved)) throw new HttpError(403, 'This file is outside the project.');
          return { absolute: resolved, stat };
        }
      }
    } catch (error) {
      throw filesystemError(error);
    }
  }

  return {
    inspect,
    async read(relative, { binary = false } = {}) {
      const file = await inspect(relative);
      if (!file?.stat.isFile()) throw new HttpError(404, 'This is not a regular file.');
      try {
        return await readRegular(root, file.absolute, binary);
      } catch (error) {
        throw filesystemError(error);
      }
    }
  };
}
