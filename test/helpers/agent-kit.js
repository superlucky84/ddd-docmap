import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { hashText } from '../../src/agent-kit/text.js';

// Synthetic kit sources for installer tests.
export const OLD_SKILL = '---\nname: sample-designer\ndescription: Use when testing an older kit.\n---\n\n# Sample designer\n\nOld guidance.\n';
export const OLD_RULE_BODY = '# Sample rule\n\nOld rule.\n';

export function skillText(name, version) {
  return '---\nname: ' + name + '\ndescription: Use when testing the installer.\nmetadata:\n  version: ' + version +
    '\n---\n\n# ' + name + '\n\nCurrent guidance.\n';
}

export function ruleText(name, body = '# Sample rule\n\nCurrent rule.\n') {
  return '---\nname: ' + name + '\ndescription: Sample rule for installer tests.\n---\n\n' + body;
}

export const SAMPLE_ITEMS = [
  {
    name: 'sample-designer',
    version: '1.1.0',
    default: true,
    previous: [
      { version: '1.0.0', kind: 'skill', part: 'file', sha256: hashText(OLD_SKILL), source: 'test' },
      { version: '1.0.0', kind: 'agent', part: 'body', sha256: hashText(OLD_RULE_BODY), source: 'test' }
    ]
  },
  { name: 'sample-reviewer', version: '1.0.0', default: false, previous: [] }
];

async function writeFile(base, relative, content) {
  const filename = path.join(base, ...relative.split('/'));
  await fs.mkdir(path.dirname(filename), { recursive: true });
  await fs.writeFile(filename, content);
  return filename;
}

// A temporary folder with a kit, a home folder and a project root.
export async function createWorkspace(t) {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'docatlas-agent-kit-'));
  const root = await fs.realpath(temporary);
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const home = path.join(root, 'home');
  const project = path.join(root, 'project');
  const kitDir = path.join(root, 'kit');
  await fs.mkdir(home);
  await fs.mkdir(project);
  return { root, home, project, kitDir, write: writeFile };
}

export async function writeKit(kitDir, { kitVersion = '1.0.0', items = SAMPLE_ITEMS } = {}) {
  const manifest = { schema: 1, kitVersion, items: [] };
  for (const item of items) {
    const skill = item.skill ?? skillText(item.name, item.version);
    const agent = item.agent ?? ruleText(item.name);
    const skillPath = 'skills/' + item.name + '/SKILL.md';
    const agentPath = 'agents/' + item.name + '.md';
    await writeFile(kitDir, skillPath, skill);
    await writeFile(kitDir, agentPath, agent);
    manifest.items.push({
      name: item.name,
      version: item.version,
      default: item.default,
      skill: { path: skillPath, sha256: hashText(skill) },
      agent: { path: agentPath, sha256: hashText(agent) },
      previous: item.previous ?? []
    });
  }
  await writeFile(kitDir, 'manifest.json', JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

// Every path below a folder with its type and content hash, for proving that planning writes nothing.
export async function snapshot(directory, prefix = '') {
  const entries = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const relative = prefix + entry.name;
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      entries.push(relative + '/', ...await snapshot(filename, relative + '/'));
    } else if (entry.isSymbolicLink()) {
      entries.push(relative + ' -> ' + await fs.readlink(filename));
    } else {
      entries.push(relative + ' ' + crypto.createHash('sha256').update(await fs.readFile(filename)).digest('hex'));
    }
  }
  return entries.sort();
}
