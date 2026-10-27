import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
let count = 0;

async function check(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await check(filename);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      const result = spawnSync(process.execPath, ['--check', filename], { stdio: 'inherit' });
      if (result.error) {
        throw result.error;
      }
      if (result.status !== 0) {
        process.exitCode = result.status || 1;
        return;
      }
      count++;
    }
  }
}

for (const directory of ['bin', 'src', 'scripts', 'test']) {
  await check(path.join(root, directory));
}
if (!process.exitCode) {
  console.log('Syntax checked ' + count + ' JavaScript files.');
}
