import { normalizeText } from './text.js';

// Control characters a TOML multi-line literal string cannot hold.
const LITERAL_UNSAFE = /[\u0000-\u0008\u000B-\u001F\u007F]/;

// JSON string escapes are valid TOML basic string escapes; TOML also forbids a raw DEL.
export function tomlString(value) {
  return JSON.stringify(value).replace(/\u007f/g, '\\u007F');
}

// Codex agents are TOML files with name, description and developer_instructions.
export function toCodexAgentToml({ name, description, body }) {
  const instructions = normalizeText(body);
  const value = instructions.includes("'''") || LITERAL_UNSAFE.test(instructions)
    ? tomlString(instructions)
    : "'''\n" + instructions + "'''";
  return [
    'name = ' + tomlString(name),
    'description = ' + tomlString(description),
    'developer_instructions = ' + value
  ].join('\n') + '\n';
}
