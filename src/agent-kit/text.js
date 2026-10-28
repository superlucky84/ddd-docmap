import crypto from 'node:crypto';

// Copies made by hand differ in line endings and trailing blank lines, so hashes ignore both.
export function normalizeText(text) {
  return text.replace(/^﻿/, '').replace(/\r\n?/g, '\n').trimEnd() + '\n';
}

export function hashText(text) {
  return crypto.createHash('sha256').update(normalizeText(text)).digest('hex');
}

// Splits a leading frontmatter block without interpreting it. Returns null when there is none.
export function splitFrontmatter(text) {
  const normalized = normalizeText(text);
  if (!normalized.startsWith('---\n')) {
    return null;
  }
  const end = normalized.indexOf('\n---\n', 3);
  if (end < 0) {
    return null;
  }
  return { header: normalized.slice(4, end), body: normalized.slice(end + 5).replace(/^\n+/, '') };
}

// The text after any frontmatter. A rule pasted without frontmatter is all body.
export function bodyOf(text) {
  return splitFrontmatter(text)?.body ?? normalizeText(text);
}

function parseScalar(raw, where) {
  const value = raw.trim();
  if (value === '') {
    throw new Error(where + ' has an empty value');
  }
  if (value.startsWith('"')) {
    let parsed;
    try {
      parsed = JSON.parse(value);
    } catch {
      parsed = null;
    }
    if (typeof parsed !== 'string') {
      throw new Error(where + ' has an invalid double-quoted value');
    }
    return parsed;
  }
  if (value.startsWith("'")) {
    throw new Error(where + ' uses single quotes; use a plain or double-quoted value');
  }
  if (/^[-?:,[\]{}#&*!|>%@`]/.test(value) || value.includes(': ') || value.includes(' #') || value.endsWith(':')) {
    throw new Error(where + ' needs double quotes to stay valid YAML');
  }
  if (/^(?:true|false|null|~|yes|no|on|off)$/i.test(value) || /^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i.test(value)) {
    throw new Error(where + ' would not be read as text; use double quotes');
  }
  return value;
}

// Parses the frontmatter subset used by kit sources:
// top-level "key: value" lines and one level of two-space nested maps.
export function parseFrontmatter(text) {
  const parts = splitFrontmatter(text);
  if (!parts) {
    throw new Error(normalizeText(text).startsWith('---\n') ? 'unclosed frontmatter' : 'missing frontmatter');
  }
  const fields = {};
  let map = null;
  for (const [index, line] of parts.header.split('\n').entries()) {
    const where = 'frontmatter line ' + (index + 2);
    if (line.trim() === '') {
      continue;
    }
    const nested = /^ {2}([A-Za-z0-9_-]+):(?: (.*))?$/.exec(line);
    const top = /^([A-Za-z0-9_-]+):(?: (.*))?$/.exec(line);
    if (nested && map) {
      if (Object.hasOwn(map.value, nested[1])) {
        throw new Error(where + ' repeats ' + map.key + '.' + nested[1]);
      }
      map.value[nested[1]] = parseScalar(nested[2] ?? '', where);
    } else if (top) {
      if (Object.hasOwn(fields, top[1])) {
        throw new Error(where + ' repeats ' + top[1]);
      }
      if ((top[2] ?? '').trim() === '') {
        map = { key: top[1], value: {} };
        fields[top[1]] = map.value;
      } else {
        map = null;
        fields[top[1]] = parseScalar(top[2], where);
      }
    } else {
      throw new Error(where + ' is not a supported "key: value" line');
    }
  }
  return { fields, body: parts.body };
}
