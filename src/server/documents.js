import { createFileAccess } from './files.js';
import { HttpError } from './errors.js';

export { HttpError } from './errors.js';

export async function readDocument(root, document, access, cachedMarkdown) {
  if (!document) throw new HttpError(404, 'This document is not in the current map.');
  const files = access || await createFileAccess(root);
  try {
    if (cachedMarkdown !== undefined) {
      const file = await files.inspect(document.relativePath);
      if (!file.stat.isFile()) throw new HttpError(403, 'Only regular files can be opened.');
      return cachedMarkdown;
    }
    return await files.read(document.relativePath);
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) {
      throw new HttpError(404, 'This document no longer exists.');
    }
    throw error;
  }
}
