import fs from 'node:fs/promises';
import path from 'node:path';
import { AgentKitError, compareVersions } from './kit.js';
import { bodyOf, hashText } from './text.js';

export const CLIENTS = ['claude', 'codex'];
export const SCOPES = ['global', 'project'];
export const RECORD_PATH = ['.docatlas', 'agents.json'];

const KINDS = ['skill', 'agent'];
const LAYOUT = {
  claude: {
    skill: name => ['.claude', 'skills', name, 'SKILL.md'],
    agent: name => ['.claude', 'agents', name + '.md']
  },
  codex: {
    skill: name => ['.agents', 'skills', name, 'SKILL.md'],
    agent: name => ['.codex', 'agents', name + '.toml']
  }
};

// What each client does when the global and project folders define the same name (checked 2026-10-28).
const SAME_NAME = {
  'claude:skill': 'Claude Code uses the global skill instead of the project skill.',
  'claude:agent': 'Claude Code uses the project agent instead of the global agent.',
  'codex:skill': 'Codex lists both skills without merging them.',
  'codex:agent': 'Codex does not document which of the two agents it uses.'
};

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function lstatOrNull(filename) {
  try {
    return await fs.lstat(filename);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
      return null;
    }
    throw error;
  }
}

export async function detectClients(home) {
  const found = [];
  if (await lstatOrNull(path.join(home, '.claude'))) {
    found.push('claude');
  }
  if (await lstatOrNull(path.join(home, '.codex')) || await lstatOrNull(path.join(home, '.agents'))) {
    found.push('codex');
  }
  return found;
}

export function selectItems(kit, { all = false, only = [] } = {}) {
  if (all && only.length) {
    throw new AgentKitError('Choose either all items or named items, not both.');
  }
  if (all) {
    return kit.items;
  }
  if (only.length) {
    const unknown = only.filter(name => !kit.items.some(item => item.name === name));
    if (unknown.length) {
      throw new AgentKitError('Unknown agent kit item: ' + unknown.join(', ') +
        '. Available: ' + kit.items.map(item => item.name).join(', '));
    }
    return kit.items.filter(item => only.includes(item.name));
  }
  return kit.items.filter(item => item.default);
}

export async function readInstallRecord(base) {
  const filename = path.join(base, ...RECORD_PATH);
  let text;
  try {
    text = await fs.readFile(filename, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { files: {}, warning: null };
    }
    return { files: {}, warning: 'Cannot read ' + filename + ' (' + error.code + '); continuing without it.' };
  }
  try {
    const record = JSON.parse(text);
    if (record?.schema === 1 && isRecord(record.files)) {
      return { files: record.files, warning: null };
    }
  } catch {
    // Reported below.
  }
  return { files: {}, warning: filename + ' is not a docatlas install record; continuing without it.' };
}

// Names that ctxbin tracks in a destination root such as ~/.claude/skills.
async function ctxbinNames(directory, cache) {
  if (!cache.has(directory)) {
    cache.set(directory, (async () => {
      try {
        const data = JSON.parse(await fs.readFile(path.join(directory, '.ctxbin-sync.json'), 'utf8'));
        return new Set(isRecord(data?.items) ? Object.keys(data.items) : []);
      } catch {
        return new Set();
      }
    })());
  }
  return cache.get(directory);
}

// Refuses paths that pass through a symbolic link. In the global scope the client folder
// itself (for example ~/.claude kept in a dotfiles repository) may be a link to a directory.
async function unsafeReason(base, parts, allowClientLink) {
  let current = base;
  for (const [index, part] of parts.entries()) {
    current = path.join(current, part);
    const stat = await lstatOrNull(current);
    if (!stat) {
      return null;
    }
    const last = index === parts.length - 1;
    if (stat.isSymbolicLink()) {
      if (!allowClientLink || index !== 0) {
        return 'symlink';
      }
      const target = await fs.stat(current).catch(() => null);
      if (!target?.isDirectory()) {
        return 'not-directory';
      }
    } else if (!last && !stat.isDirectory()) {
      return 'not-directory';
    } else if (last && !stat.isFile()) {
      return 'not-file';
    }
  }
  return null;
}

function outcome(action, reason, backup = false) {
  return { action, reason, backup };
}

async function decide({ base, parts, scope, item, client, kind, sha256, key, recorded, kitVersion, force, cache }) {
  const unsafe = await unsafeReason(base, parts, scope === 'global');
  if (unsafe) {
    return outcome('blocked', unsafe);
  }
  const filename = path.join(base, ...parts);
  if (!await lstatOrNull(filename)) {
    return outcome('create', 'new');
  }
  const text = (await fs.readFile(filename)).toString('utf8');
  const current = hashText(text);
  if (current === sha256) {
    return outcome('unchanged', 'same');
  }
  const skip = (action, reason) => force ? outcome('replace', reason, true) : outcome(action, reason);
  if ((await ctxbinNames(path.join(base, ...parts.slice(0, 2)), cache)).has(item.name)) {
    return skip('skip-managed', 'ctxbin');
  }
  const entry = recorded[key];
  if (isRecord(entry) && entry.path === parts.join('/') && entry.sha256 === current) {
    if (compareVersions(entry.kitVersion, kitVersion) > 0) {
      return skip('skip-downgrade', 'downgrade');
    }
    return outcome('replace', 'recorded');
  }
  const previousKind = client === 'codex' && kind === 'agent' ? 'codex-agent' : kind;
  const known = item.previous.filter(previous => previous.kind === previousKind);
  if (known.some(previous => previous.part === 'file' && previous.sha256 === current)) {
    return outcome('replace', 'previous-file');
  }
  const body = hashText(bodyOf(text));
  if (previousKind !== 'codex-agent' && known.some(previous => previous.part === 'body' && previous.sha256 === body)) {
    return outcome('replace', 'previous-body');
  }
  return skip('skip-modified', 'modified');
}

function desiredFile(item, client, kind) {
  if (kind === 'skill') {
    return item.files.skill;
  }
  return client === 'codex' ? item.files.codexAgent : item.files.agent;
}

// Decides what an install would do for each file without writing anything.
// base is the home folder for the global scope and the project root for the project scope.
export async function planInstall({ kit, items, scope, home, root, clients, force = false }) {
  if (!SCOPES.includes(scope)) {
    throw new AgentKitError('Unknown install scope: ' + scope);
  }
  const unknown = clients.filter(client => !CLIENTS.includes(client));
  if (unknown.length || clients.length === 0) {
    throw new AgentKitError('Choose at least one client from: ' + CLIENTS.join(', '));
  }
  const base = scope === 'global' ? home : root;
  const other = scope === 'global' ? root : home;
  if (!base) {
    throw new AgentKitError(scope === 'global' ? 'A home folder is required.' : 'A project root is required.');
  }
  const { files: recorded, warning } = await readInstallRecord(base);
  const warnings = warning ? [{ code: 'record', message: warning }] : [];
  const cache = new Map();
  const actions = [];
  for (const item of items) {
    for (const client of clients) {
      for (const kind of KINDS) {
        const parts = LAYOUT[client][kind](item.name);
        const key = client + '/' + kind + '/' + item.name;
        const { text, sha256 } = desiredFile(item, client, kind);
        const result = await decide({
          base, parts, scope, item, client, kind, sha256, key, recorded, kitVersion: kit.kitVersion, force, cache
        });
        actions.push({
          ...result, key, client, kind, name: item.name, version: item.version,
          relative: parts.join('/'), path: path.join(base, ...parts), content: text, sha256
        });
        const counterpart = other && path.resolve(other) !== path.resolve(base) ? path.join(other, ...parts) : null;
        if (counterpart && await lstatOrNull(counterpart)) {
          warnings.push({
            code: 'same-name', client, kind, name: item.name, path: counterpart,
            message: SAME_NAME[client + ':' + kind]
          });
        }
      }
    }
  }
  return { scope, base, kitVersion: kit.kitVersion, actions, warnings };
}
