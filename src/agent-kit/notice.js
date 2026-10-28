import fs from 'node:fs/promises';
import path from 'node:path';
import { KIT_DIRECTORY, compareVersions } from './kit.js';
import { readInstallRecord } from './plan.js';

const SEMVER = /^\d+\.\d+\.\d+$/;

// Returns a one-line update hint when an install record names an older kit, or null.
// Reads only the packaged manifest and existing install records and never writes.
// Copies made by hand have no record and get no hint, so teams can adopt the installer when ready.
export async function agentKitNotice({ home, root, kitDir = KIT_DIRECTORY } = {}) {
  try {
    const manifest = JSON.parse(await fs.readFile(path.join(kitDir, 'manifest.json'), 'utf8'));
    const available = manifest?.kitVersion;
    if (!SEMVER.test(String(available)) || !Array.isArray(manifest.items)) {
      return null;
    }
    const known = new Set(manifest.items.map(item => item?.name));
    const defaults = new Set(manifest.items.filter(item => item?.default === true).map(item => item.name));
    const scopes = [['global', home]];
    if (root && (!home || path.resolve(root) !== path.resolve(home))) {
      scopes.push(['project', root]);
    }
    const commands = [];
    let oldest = null;
    for (const [scope, base] of scopes) {
      if (!base) {
        continue;
      }
      const { files } = await readInstallRecord(base);
      const names = new Set();
      for (const [key, entry] of Object.entries(files)) {
        const name = key.split('/')[2];
        const version = entry?.kitVersion;
        if (!known.has(name) || !SEMVER.test(String(version)) || compareVersions(version, available) >= 0) {
          continue;
        }
        names.add(name);
        if (!oldest || compareVersions(version, oldest) < 0) {
          oldest = version;
        }
      }
      if (names.size) {
        const sorted = [...names].sort();
        const selection = sorted.every(name => defaults.has(name)) ? [] : sorted.flatMap(name => ['--only', name]);
        commands.push(['docatlas agents install', ...(scope === 'project' ? ['--project'] : []), ...selection, '--dry-run'].join(' '));
      }
    }
    if (!commands.length) {
      return null;
    }
    return 'Agent skills: kit ' + available + ' is available (installed ' + oldest + '). Preview the update with: ' + commands.join('; ');
  } catch {
    return null;
  }
}
