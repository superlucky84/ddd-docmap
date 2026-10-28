import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { AgentKitError } from './kit.js';
import { RECORD_PATH, readInstallRecord, unsafeReason } from './plan.js';
import { hashText } from './text.js';

export const LOCK_PATH = ['.docatlas', 'install.lock'];

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

async function modeOrNull(filename) {
  try {
    return (await fs.stat(filename)).mode & 0o7777;
  } catch {
    return null;
  }
}

// Writes next to the target and renames, so a reader never sees a partial file.
// An existing file keeps its permission bits.
async function writeAtomic(filename, content, mode = null) {
  const temporary = path.join(path.dirname(filename),
    '.' + path.basename(filename) + '.docatlas-' + process.pid + '-' + crypto.randomBytes(4).toString('hex'));
  await fs.writeFile(temporary, content, { flag: 'wx' });
  try {
    if (mode !== null) {
      await fs.chmod(temporary, mode);
    }
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

// One install at a time per base folder, so a failing run never undoes another run's files.
async function acquireLock(base, created) {
  const unsafe = await unsafeReason(base, LOCK_PATH, false);
  if (unsafe) {
    throw new AgentKitError(path.join(base, ...LOCK_PATH) + ' is not safe to write (' + unsafe + '). Nothing was changed.');
  }
  await makeDirectories(base, LOCK_PATH.slice(0, -1), created);
  const filename = path.join(base, ...LOCK_PATH);
  try {
    await fs.writeFile(filename, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }) + '\n', { flag: 'wx' });
  } catch (error) {
    if (error.code === 'EEXIST') {
      throw new AgentKitError('Another docatlas agents install is running (' + filename +
        '). Nothing was changed. If no install is running, delete that file and try again.');
    }
    throw error;
  }
  return filename;
}

async function restore(journal) {
  const failed = [];
  for (const entry of journal.reverse()) {
    try {
      if (entry.previous === null) {
        await fs.rm(entry.path, { force: true });
      } else {
        await writeAtomic(entry.path, entry.previous, entry.mode);
      }
    } catch {
      failed.push(entry.path);
    }
  }
  return failed;
}

function backupStamp(now) {
  return now.toISOString().replace(/[:.]/g, '-');
}

function sortedObject(value) {
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

async function checkTargets(plan, writes) {
  const allowClientLink = plan.scope === 'global';
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
}

// Applies a plan from planInstall under an install lock. Nothing is written unless every target
// still matches the plan. On failure, files and folders written by this call are restored.
export async function applyPlan(plan, { home, now = new Date() } = {}) {
  if (!home) {
    throw new AgentKitError('A home folder is required for backups.');
  }
  const writes = plan.actions.filter(action => WRITES.has(action.action));
  const created = [];
  const journal = [];
  const backups = [];
  const backupRoot = path.join(home, '.docatlas', 'backups', backupStamp(now), plan.scope);
  let lock = null;
  let writing = false;
  try {
    lock = await acquireLock(plan.base, created);
    await checkTargets(plan, writes);
    writing = true;
    for (const action of writes) {
      const parts = action.relative.split('/');
      const previous = await readOrNull(action.path);
      const mode = previous === null ? null : await modeOrNull(action.path);
      if (action.backup && previous !== null) {
        const backup = path.join(backupRoot, ...parts);
        await fs.mkdir(path.dirname(backup), { recursive: true });
        await fs.writeFile(backup, previous, { flag: 'wx' });
        backups.push({ path: action.path, backup });
      }
      await makeDirectories(plan.base, parts.slice(0, -1), created);
      journal.push({ path: action.path, previous, mode });
      await writeAtomic(action.path, action.content, mode);
    }

    let record = null;
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
    const changed = previousRecord === null ? Object.keys(next).length > 0 : previousRecord.toString('utf8') !== content;
    if (changed) {
      const mode = previousRecord === null ? null : await modeOrNull(recordPath);
      journal.push({ path: recordPath, previous: previousRecord, mode });
      await writeAtomic(recordPath, content, mode);
      record = recordPath;
    }
    return { written: writes, backups, record };
  } catch (error) {
    if (!writing) {
      throw error;
    }
    const failed = await restore(journal);
    throw new AgentKitError('Install failed: ' + error.message + '. ' + (failed.length
      ? 'Could not restore: ' + failed.join(', ') + '. Backups are in ' + backupRoot + '.'
      : 'Files written by this run were restored.' + (backups.length ? ' Backups are in ' + backupRoot + '.' : '')));
  } finally {
    if (lock) {
      await fs.rm(lock, { force: true });
    }
    // Folders this run created stay only if they now hold files; rmdir fails on non-empty folders.
    for (const directory of created.reverse()) {
      await fs.rmdir(directory).catch(() => {});
    }
  }
}
