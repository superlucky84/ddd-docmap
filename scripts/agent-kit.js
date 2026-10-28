import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareVersions } from '../src/agent-kit/kit.js';
import { bodyOf, hashText, parseFrontmatter } from '../src/agent-kit/text.js';

// Authoring checks for agent-kit/. Not part of the published package.
// Hashing and frontmatter rules come from src/agent-kit/ so installs and checks agree.

const SCHEMA = 1;
const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const SHA256 = /^[0-9a-f]{64}$/;
const NAME_LIMIT = 64;
const DESCRIPTION_LIMIT = 1024;
const MANIFEST_KEYS = ['schema', 'kitVersion', 'items'];
const ITEM_KEYS = ['name', 'version', 'default', 'skill', 'agent', 'previous'];
const PREVIOUS_KEYS = ['version', 'kind', 'part', 'sha256', 'source'];
const SKILL_KEYS = ['name', 'description', 'metadata'];
const SKILL_METADATA_KEYS = ['short-description', 'version'];
const AGENT_KEYS = ['name', 'description'];
const KINDS = ['skill', 'agent', 'codex-agent'];
const EXTRA_FILES = ['README.md', 'manifest.json'];
const decoder = new TextDecoder('utf-8', { fatal: true });

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function unknownKeys(value, allowed) {
  return Object.keys(value).filter(key => !allowed.includes(key));
}

async function readText(filename) {
  const stat = await fs.lstat(filename);
  if (!stat.isFile()) {
    throw new Error('is not a regular file');
  }
  return decoder.decode(await fs.readFile(filename));
}

async function listFiles(directory, prefix = '') {
  const found = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const relative = prefix + entry.name;
    if (entry.isDirectory()) {
      found.push(...await listFiles(path.join(directory, entry.name), relative + '/'));
    } else {
      found.push({ relative, regular: entry.isFile() });
    }
  }
  return found;
}

function checkDescription(fields, label, fail) {
  const { description } = fields;
  if (typeof description !== 'string' || description.length === 0) {
    fail(label + ': description is required');
  } else if (description.length > DESCRIPTION_LIMIT) {
    fail(label + ': description is longer than ' + DESCRIPTION_LIMIT + ' characters');
  }
}

async function checkSource(kitDir, item, kind, fail) {
  const entry = item[kind];
  const expected = kind === 'skill' ? 'skills/' + item.name + '/SKILL.md' : 'agents/' + item.name + '.md';
  const label = expected;
  if (!isRecord(entry) || unknownKeys(entry, ['path', 'sha256']).length) {
    fail(item.name + ': ' + kind + ' needs only path and sha256');
    return null;
  }
  if (entry.path !== expected) {
    fail(item.name + ': ' + kind + '.path must be ' + expected);
    return null;
  }
  let text;
  try {
    text = await readText(path.join(kitDir, ...expected.split('/')));
  } catch (error) {
    fail(label + ': ' + (error.code === 'ENOENT' ? 'file is missing' : error.message));
    return null;
  }
  const actual = hashText(text);
  if (entry.sha256 !== actual) {
    fail(label + ': sha256 is ' + actual + ' but manifest.json lists ' + entry.sha256);
  }
  let parsed;
  try {
    parsed = parseFrontmatter(text);
  } catch (error) {
    fail(label + ': ' + error.message);
    return null;
  }
  const { fields, body } = parsed;
  const allowed = kind === 'skill' ? SKILL_KEYS : AGENT_KEYS;
  for (const key of unknownKeys(fields, allowed)) {
    fail(label + ': frontmatter key ' + key + ' is not allowed');
  }
  if (fields.name !== item.name) {
    fail(label + ': frontmatter name must be ' + item.name);
  }
  checkDescription(fields, label, fail);
  if (kind === 'skill') {
    const { metadata } = fields;
    if (!isRecord(metadata)) {
      fail(label + ': metadata.version is required');
    } else {
      for (const key of unknownKeys(metadata, SKILL_METADATA_KEYS)) {
        fail(label + ': metadata key ' + key + ' is not allowed');
      }
      if (metadata.version !== item.version) {
        fail(label + ': metadata.version must match manifest version ' + item.version);
      }
    }
  }
  if (body.trim() === '') {
    fail(label + ': body is empty');
  }
  return { file: actual, body: hashText(body) };
}

function checkPrevious(item, current, fail) {
  if (!Array.isArray(item.previous)) {
    fail(item.name + ': previous must be an array');
    return;
  }
  const seen = new Set();
  for (const [index, entry] of item.previous.entries()) {
    const label = item.name + ': previous[' + index + ']';
    if (!isRecord(entry) || unknownKeys(entry, PREVIOUS_KEYS).length) {
      fail(label + ' needs only ' + PREVIOUS_KEYS.join(', '));
      continue;
    }
    if (!SEMVER.test(entry.version ?? '')) {
      fail(label + '.version must be x.y.z');
    } else if (SEMVER.test(item.version ?? '') && compareVersions(entry.version, item.version) >= 0) {
      fail(label + '.version must be lower than ' + item.version);
    }
    if (!KINDS.includes(entry.kind)) {
      fail(label + '.kind must be one of ' + KINDS.join(', '));
    }
    const parts = entry.kind === 'codex-agent' ? ['file'] : ['file', 'body'];
    if (!parts.includes(entry.part)) {
      fail(label + '.part must be one of ' + parts.join(', '));
    }
    if (!SHA256.test(entry.sha256 ?? '')) {
      fail(label + '.sha256 must be 64 lowercase hex characters');
    }
    if (typeof entry.source !== 'string' || entry.source.trim() === '') {
      fail(label + '.source is required');
    }
    const key = entry.kind + ':' + entry.part + ':' + entry.sha256;
    if (seen.has(key)) {
      fail(label + ' repeats an earlier entry');
    }
    seen.add(key);
    const now = current[entry.kind];
    if (now && now[entry.part] === entry.sha256) {
      fail(label + ' matches the current ' + entry.kind + ' ' + entry.part);
    }
  }
}

export async function checkAgentKit(kitDir) {
  const errors = [];
  const fail = message => errors.push(message);
  let manifest;
  try {
    manifest = JSON.parse(await readText(path.join(kitDir, 'manifest.json')));
  } catch (error) {
    return { errors: ['manifest.json: ' + (error.code === 'ENOENT' ? 'file is missing' : error.message)], manifest: null };
  }
  if (!isRecord(manifest)) {
    return { errors: ['manifest.json: must be an object'], manifest: null };
  }
  for (const key of unknownKeys(manifest, MANIFEST_KEYS)) {
    fail('manifest.json: key ' + key + ' is not allowed');
  }
  if (manifest.schema !== SCHEMA) {
    fail('manifest.json: schema must be ' + SCHEMA);
  }
  if (!SEMVER.test(manifest.kitVersion ?? '')) {
    fail('manifest.json: kitVersion must be x.y.z');
  }
  const items = Array.isArray(manifest.items) ? manifest.items : [];
  if (items.length === 0) {
    fail('manifest.json: items must list at least one skill and rule pair');
  }
  const names = new Set();
  const listed = new Set(EXTRA_FILES);
  for (const [index, item] of items.entries()) {
    if (!isRecord(item)) {
      fail('manifest.json: items[' + index + '] must be an object');
      continue;
    }
    for (const key of unknownKeys(item, ITEM_KEYS)) {
      fail('manifest.json: items[' + index + '] key ' + key + ' is not allowed');
    }
    if (typeof item.name !== 'string' || !NAME.test(item.name) || item.name.length > NAME_LIMIT) {
      fail('manifest.json: items[' + index + '].name must be lowercase words joined by single hyphens, at most ' + NAME_LIMIT + ' characters');
      continue;
    }
    if (names.has(item.name)) {
      fail('manifest.json: ' + item.name + ' is listed twice');
      continue;
    }
    names.add(item.name);
    if (!SEMVER.test(item.version ?? '')) {
      fail(item.name + ': version must be x.y.z');
    }
    if (typeof item.default !== 'boolean') {
      fail(item.name + ': default must be true or false');
    }
    listed.add('skills/' + item.name + '/SKILL.md');
    listed.add('agents/' + item.name + '.md');
    const current = {
      skill: await checkSource(kitDir, item, 'skill', fail),
      agent: await checkSource(kitDir, item, 'agent', fail)
    };
    checkPrevious(item, current, fail);
  }
  if (items.length && !items.some(item => item?.default === true)) {
    fail('manifest.json: at least one item must be installed by default');
  }
  for (const { relative, regular } of await listFiles(kitDir)) {
    if (!regular) {
      fail(relative + ': only regular files are allowed');
    } else if (!listed.has(relative)) {
      fail(relative + ': file is not listed in manifest.json');
    }
  }
  return { errors, manifest };
}

// node scripts/agent-kit.js hash <file>... prints the file and body hashes used in manifest.json.
async function main(args) {
  if (args[0] !== 'hash' || args.length < 2) {
    console.error('Usage: node scripts/agent-kit.js hash <file>...');
    process.exitCode = 2;
    return;
  }
  for (const filename of args.slice(1)) {
    const text = await readText(filename);
    console.log('file ' + hashText(text) + '  body ' + hashText(bodyOf(text)) + '  ' + filename);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main(process.argv.slice(2));
}
