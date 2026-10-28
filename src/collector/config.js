import fs from 'node:fs/promises';
import path from 'node:path';
import picomatch from 'picomatch';
import { ConfigurationError } from './errors.js';
import { readRegularFile } from './read.js';

export const CONFIG_FILE = 'ddd-docmap.config.json';

const DEFAULT_INCLUDE = [
  '**/docs/**/*.md',
  '**/REQUIREMENTS.md',
  '**/DESIGN.md',
  '**/IMPLEMENT.md',
  '**/MANUAL_TEST_CHECKLIST.md'
];
const DEFAULT_EXCLUDE = [
  '**/dist/**',
  '**/build/**',
  '**/coverage/**',
  '**/.ddd-docmap/**'
];

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function fail(field, message) {
  throw new ConfigurationError(field + ': ' + message);
}

function checkFields(value, allowed, field) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      fail(field ? field + '.' + key : key, 'unknown property');
    }
  }
}

function checkRelative(value, field, allowRoot = false) {
  if (
    typeof value !== 'string' || !value.trim() || value.includes('\0') ||
    value.includes('\\') || value.startsWith('/') || /^[a-z]:/i.test(value) ||
    value.split('/').includes('..')
  ) {
    fail(field, 'expected a project-relative path using /');
  }
  const normalized = path.posix.normalize(value);
  if (!allowRoot && normalized === '.') {
    fail(field, 'expected a non-empty relative path');
  }
  return normalized.replace(/\/$/, '') || '.';
}

function patterns(value, defaults, field) {
  const list = value === undefined ? [...defaults] : value;
  if (!Array.isArray(list)) {
    fail(field, 'expected an array of glob strings');
  }
  for (const [index, pattern] of list.entries()) {
    const label = field + '[' + index + ']';
    checkRelative(pattern, label);
    if (pattern.startsWith('!') || pattern.startsWith('./')) {
      fail(label, 'use positive globs without a leading ./');
    }
  }
  try {
    const matchers = list.map(pattern => picomatch(pattern, {
      dot: true,
      nocase: true,
      strictBrackets: true,
      windows: false
    }));
    return { list, matches: value => matchers.some(match => match(value)) };
  } catch (cause) {
    throw new ConfigurationError(field + ': invalid glob: ' + cause.message, { cause });
  }
}

export async function loadConfiguration(root) {
  const filename = path.join(root, CONFIG_FILE);
  let value = { version: 1 };
  let stat;
  try {
    stat = await fs.lstat(filename);
  } catch (cause) {
    if (cause.code !== 'ENOENT') {
      throw new ConfigurationError('cannot inspect config (' + cause.code + ')', { cause });
    }
  }
  if (stat) {
    if (!stat.isFile() || stat.isSymbolicLink()) {
      fail('config', 'expected a regular file, not a symbolic link');
    }
    try {
      value = JSON.parse(await readRegularFile(root, filename));
    } catch (cause) {
      throw new ConfigurationError('cannot read JSON: ' + cause.message, { cause });
    }
  }
  if (!isObject(value)) {
    fail('config', 'expected a JSON object');
  }
  checkFields(value, ['version', 'include', 'exclude', 'groups', 'redirects'], '');
  if (value.version !== 1) {
    fail('version', 'expected supported version 1');
  }
  const include = patterns(value.include, DEFAULT_INCLUDE, 'include');
  const exclude = patterns(value.exclude, DEFAULT_EXCLUDE, 'exclude');
  const overrides = value.groups === undefined ? {} : value.groups;
  if (!isObject(overrides)) {
    fail('groups', 'expected an object');
  }
  const groups = new Map();
  for (const [key, entry] of Object.entries(overrides)) {
    const id = checkRelative(key, 'groups.' + key, true);
    if (groups.has(id)) {
      fail('groups.' + key, 'duplicate normalized directory');
    }
    if (!isObject(entry)) {
      fail('groups.' + key, 'expected an object');
    }
    checkFields(entry, ['title', 'summary'], 'groups.' + key);
    if (entry.title !== undefined && (typeof entry.title !== 'string' || !entry.title.trim())) {
      fail('groups.' + key + '.title', 'expected a non-empty string');
    }
    if (entry.summary !== undefined && typeof entry.summary !== 'string') {
      fail('groups.' + key + '.summary', 'expected a string');
    }
    groups.set(id, entry);
  }
  const redirects = new Map();
  if (value.redirects !== undefined && !isObject(value.redirects)) fail('redirects', 'expected an object');
  for (const [source, destination] of Object.entries(value.redirects || {})) {
    const from = checkRelative(source, 'redirects.' + source);
    const to = checkRelative(destination, 'redirects.' + source);
    if (!/\.md$/i.test(from) || !/\.md$/i.test(to)) fail('redirects.' + source, 'expected Markdown paths');
    if (redirects.has(from)) fail('redirects.' + source, 'duplicate normalized path');
    redirects.set(from, to);
  }
  return {
    redirects,
    include: include.list,
    exclude: exclude.list,
    groups,
    isIncluded: include.matches,
    isExcluded: (relative, directory = false) =>
      exclude.matches(relative) || (directory && exclude.matches(relative + '/'))
  };
}
