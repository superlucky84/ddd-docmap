import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function readDocument(root, document) {
  if (!document) {
    throw new HttpError(404, 'This document is not in the current map.');
  }
  let filename = root;
  try {
    const segments = document.relativePath.split('/');
    for (const [index, segment] of segments.entries()) {
      filename = path.join(filename, segment);
      const stat = await fs.lstat(filename);
      if (stat.isSymbolicLink()) {
        throw new HttpError(403, 'Symbolic links cannot be opened.');
      }
      if (index < segments.length - 1 ? !stat.isDirectory() : !stat.isFile()) {
        throw new HttpError(404, 'The document is no longer a regular file.');
      }
    }
    const resolved = await fs.realpath(filename);
    const relative = path.relative(root, resolved);
    if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
      throw new HttpError(403, 'This document is outside the project.');
    }
    const handle = await fs.open(resolved, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
    try {
      if (!(await handle.stat()).isFile()) {
        throw new HttpError(404, 'The document is no longer a regular file.');
      }
      return await handle.readFile('utf8');
    } finally {
      await handle.close();
    }
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (['ENOENT', 'ENOTDIR'].includes(error.code)) {
      throw new HttpError(404, 'This document no longer exists.');
    }
    if (['EACCES', 'EPERM', 'ELOOP'].includes(error.code)) {
      throw new HttpError(403, 'This document cannot be read.');
    }
    throw error;
  }
}
