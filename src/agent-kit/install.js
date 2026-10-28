import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { AgentKitError } from './kit.js';
import { RECORD_PATH, readInstallRecord, unsafeReason } from './plan.js';
import { hashText } from './text.js';

const WRITES = new Set(['create', 'replace']);
const RECORDED = new Set(['create', 'replace', 'unchanged']);

async function readOrNull(filename) {
  try {
    return await fs.readFile(filename);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

// Writes next to the target and renames, so a reader never sees a partial file.
async function writeAtomic(filename, content) {
  const temporary = path.join(path.dirname(filename),
    '.' + path.basename(filename) + '.docatlas-' + process.pid + '-' + crypto.randomBytes(4).toString('hex'));
  await fs.writeFile(temporary, content, { flag: 'wx' });
  try {
    await fs.rename(temporary, filename);
  } catch (error) {
    await fs.rm(temporary, { force: true });
    throw error;
  }
}

async function makeDirectories(base, parts, created) {
  let current = base;
  for (const part of parts) {
    current = path.join(current, part);
    try {
      await fs.mkdir(current);
      created.push(current);
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }
}

async function rollback(journal, created) {
  const failed = [];
  for (const entry of journal.reverse()) {
    try {
      if (entry.previous === null) {
        await fs.rm(entry.path, { force: true });
      } else {
        await writeAtomic(entry.path, entry.previous);
      }
    } catch {
      failed.push(entry.path);
    }
  }
  for (const directory of created.reverse()) {
    await fs.rmdir(directory).catch(() => {});
  }
  return failed;
}

function backupStamp(now) {
  return now.toISOString().replace(/[:.]/g, '-');
}

function sortedObject(value) {
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

// Applies a plan from planInstall. Nothing is written unless every target still matches the plan.
// On failure, files and folders written by this call are restored before the error is thrown.
export async function applyPlan(plan, { home, now = new Date() } = {}) {
  if (!home) {
    throw new AgentKitError('A home folder is required for backups.');
  }
  const allowClientLink = plan.scope === 'global';
  const writes = plan.actions.filter(action => WRITES.has(action.action));
  for (const action of writes) {
    const unsafe = await unsafeReason(plan.base, action.relative.split('/'), allowClientLink);
    if (unsafe) {
      throw new AgentKitError(action.path + ' is no longer safe to write (' + unsafe + '). Nothing was changed.');
    }
    const current = await readOrNull(action.path);
    if ((current === null ? null : hashText(current.toString('utf8'))) !== action.observed) {
      throw new AgentKitError(action.path + ' changed after planning. Nothing was changed; run the command again.');
    }
  }
  const recordUnsafe = await unsafeReason(plan.base, RECORD_PATH, false);
  if (recordUnsafe) {
    throw new AgentKitError(path.join(plan.base, ...RECORD_PATH) + ' is not safe to write (' + recordUnsafe + '). Nothing was changed.');
  }

  const journal = [];
  const created = [];
  const backups = [];
  const backupRoot = path.join(home, '.docatlas', 'backups', backupStamp(now), plan.scope);
  let record = null;
  try {
    for (const action of writes) {
      const parts = action.relative.split('/');
      const previous = await readOrNull(action.path);
      if (action.backup && previous !== null) {
        const backup = path.join(backupRoot, ...parts);
        await fs.mkdir(path.dirname(backup), { recursive: true });
        await fs.writeFile(backup, previous, { flag: 'wx' });
        backups.push({ path: action.path, backup });
      }
      await makeDirectories(plan.base, parts.slice(0, -1), created);
      journal.push({ path: action.path, previous });
      await writeAtomic(action.path, action.content);
    }

    const recordPath = path.join(plan.base, ...RECORD_PATH);
    const { files } = await readInstallRecord(plan.base);
    const next = { ...files };
    for (const action of plan.actions) {
      if (RECORDED.has(action.action)) {
        next[action.key] = { path: action.relative, kitVersion: plan.kitVersion, version: action.version, sha256: action.sha256 };
      }
    }
    const content = JSON.stringify({ schema: 1, files: sortedObject(next) }, null, 2) + '\n';
    const previousRecord = await readOrNull(recordPath);
    if (previousRecord === null || previousRecord.toString('utf8') !== content) {
      await makeDirectories(plan.base, RECORD_PATH.slice(0, -1), created);
      journal.push({ path: recordPath, previous: previousRecord });
      await writeAtomic(recordPath, content);
      record = recordPath;
    }
  } catch (error) {
    const failed = await rollback(journal, created);
    throw new AgentKitError('Install failed: ' + error.message + '. ' + (failed.length
      ? 'Could not restore: ' + failed.join(', ') + '. Backups are in ' + backupRoot + '.'
      : 'Files written by this run were restored.'));
  }
  return { written: writes, backups, record };
}
