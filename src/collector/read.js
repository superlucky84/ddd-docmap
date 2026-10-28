import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';

const fail = (code, message) => Object.assign(new Error(message), { code });
const inside = (root, filename) => {
  const relative = path.relative(root, filename);
  return relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
};

/** Read through the inspected descriptor, refusing replacement files and root escapes. */
export async function readRegularFile(root, filename, binary = false) {
  const before = await fs.lstat(filename);
  if (!before.isFile() || before.isSymbolicLink()) throw fail('NOT_REGULAR', 'Only regular files can be opened.');
  const resolved = await fs.realpath(filename);
  if (!inside(root, resolved)) throw fail('OUTSIDE_ROOT', 'This file is outside the project.');
  const handle = await fs.open(resolved, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  try {
    const opened = await handle.stat();
    if (!opened.isFile() || before.dev !== opened.dev || before.ino !== opened.ino) {
      throw fail('FILE_CHANGED', 'This file changed while it was being opened.');
    }
    if (!inside(root, await fs.realpath(resolved))) throw fail('OUTSIDE_ROOT', 'This file is outside the project.');
    return await handle.readFile(binary ? undefined : 'utf8');
  } finally { await handle.close(); }
}
