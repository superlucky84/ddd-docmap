import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { applyPlan } from './install.js';
import { AgentKitError, loadKit } from './kit.js';
import { CLIENTS, detectClients, planInstall, selectItems } from './plan.js';

export const INSTALL_OPTIONS = {
  project: { type: 'boolean' },
  root: { type: 'string' },
  target: { type: 'string' },
  all: { type: 'boolean' },
  only: { type: 'string', multiple: true },
  'dry-run': { type: 'boolean' },
  force: { type: 'boolean' },
  help: { type: 'boolean', short: 'h' }
};

// Exit codes. NEEDS_DECISION means the run finished but skipped files the user must decide about.
export const EXIT = { OK: 0, FAILED: 1, USAGE: 2, NEEDS_DECISION: 3 };

const TARGETS = [...CLIENTS, 'all'];
const DECISIONS = new Set(['skip-modified', 'skip-downgrade', 'skip-managed', 'blocked']);

export function agentsHelp(kit) {
  const items = kit
    ? kit.items.map(item => '  ' + item.name.padEnd(27) + item.version.padEnd(8) + (item.default ? 'default' : 'with --all or --only'))
    : ['  (the agent kit could not be read)'];
  return [
    'docatlas agents — install doc-driven agent skills and rules for Claude Code and Codex', '',
    'For AI agents running this for a user:',
    '  1. If the user did not say what to install, ask whether to add the implementer and reviewer',
    '     (--all) or keep the default designer only.',
    '  2. Preview: docatlas agents install --dry-run [options]',
    '  3. Show the preview lines to the user and ask for approval.',
    '  4. Apply: run the same command without --dry-run.',
    '  Add --force only after the user approves replacing the files it would back up.',
    '  The command never asks questions. Read its output lines and exit code.', '',
    'Usage:',
    '  docatlas agents install [--project] [--root <dir>] [--target claude|codex|all]',
    '                          [--all | --only <name>] [--dry-run] [--force]',
    '  docatlas agents help', '',
    'Kit' + (kit ? ' ' + kit.kitVersion : '') + ':',
    ...items, '',
    'Where files go (global by default):',
    '  Claude Code  ~/.claude/skills/<name>/SKILL.md  ~/.claude/agents/<name>.md',
    '  Codex        ~/.agents/skills/<name>/SKILL.md  ~/.codex/agents/<name>.toml',
    '  --project puts the same paths under the project root instead of the home folder.',
    '  Claude Code uses a global skill before a project skill with the same name.',
    '  Codex reads project agents only in trusted projects and then prefers them over global ones.', '',
    'Options:',
    '  --project          Install into the project root instead of the home folder.',
    '  --root <dir>       Project root for --project and same-name checks (default: current folder).',
    '  --target <client>  claude, codex or all (default: clients whose folders exist in the home folder).',
    '  --all              Install every kit item.',
    '  --only <name>      Install only this item; repeat for more.',
    '  --dry-run          Print what would happen without writing.',
    '  --force            Also replace skipped files, after copying them to ~/.docatlas/backups/.',
    '  -h, --help         Show this help.', '',
    'Output lines (tab-separated; dry-run prefixes action and summary lines):',
    '  <action> <reason> <client> <kind> <name> <path>',
    '  backup <path> <backup path>',
    '  warning <code> <path> <message>',
    '  record <install record path>',
    '  summary create=N replace=N unchanged=N skipped=N blocked=N', '',
    'Actions:',
    '  create, unchanged, replace  Safe. replace with reason recorded, previous-file or previous-body',
    '                              overwrites an unedited docatlas or earlier published copy.',
    '  skip-modified               The user edited this copy. Ask before --force.',
    '  skip-downgrade              A newer docatlas installed it. Ask before --force.',
    '  skip-managed                ctxbin manages this file. Ask which tool should own it.',
    '  blocked                     The path uses a symbolic link or is not a file. --force does not help.',
    '  With --force, skipped files become replace with reason modified, downgrade or ctxbin and are backed up.', '',
    'Exit codes:',
    '  0  Done, or nothing to do.',
    '  3  Done, but some files were skipped or blocked and need the user\'s decision.',
    '  1  Failed. Files written by this run were restored.',
    '  2  Invalid arguments.', '',
    'Install records: ~/.docatlas/agents.json (global), <root>/.docatlas/agents.json (project; commit it).',
    'Documents, AGENTS.md and CLAUDE.md are never changed.', ''
  ].join('\n');
}

async function directory(filename) {
  const resolved = await fs.realpath(filename);
  if (!(await fs.stat(resolved)).isDirectory()) {
    throw new Error('not a directory');
  }
  return resolved;
}

export async function runAgents(args, {
  stdout = process.stdout, stderr = process.stderr, home = os.homedir(), cwd = process.cwd(), kitDir, now
} = {}) {
  const usage = message => {
    stderr.write(message + '\nRun docatlas agents help for usage.\n');
    return EXIT.USAGE;
  };
  const loadForHelp = () => loadKit(kitDir).catch(() => null);
  const [command, ...rest] = args;
  if (command === 'help' || command === '--help' || command === '-h') {
    stdout.write(agentsHelp(await loadForHelp()));
    return EXIT.OK;
  }
  if (command !== 'install') {
    return usage(command ? 'Unknown agents command: ' + command : 'Missing agents command.');
  }
  let values;
  try {
    ({ values } = parseArgs({ args: rest, allowPositionals: false, strict: true, options: INSTALL_OPTIONS }));
  } catch (error) {
    return usage(error.message);
  }
  if (values.help) {
    stdout.write(agentsHelp(await loadForHelp()));
    return EXIT.OK;
  }
  if (values.target !== undefined && !TARGETS.includes(values.target)) {
    return usage('--target must be one of: ' + TARGETS.join(', '));
  }
  let root;
  try {
    root = await directory(path.resolve(cwd, values.root ?? '.'));
  } catch {
    return usage('Project root not found: ' + path.resolve(cwd, values.root ?? '.'));
  }
  const homeFolder = await fs.realpath(home).catch(() => home);
  let kit;
  try {
    kit = await loadKit(kitDir);
  } catch (error) {
    stderr.write(error.message + '\n');
    return EXIT.FAILED;
  }
  let items;
  try {
    items = selectItems(kit, { all: values.all, only: values.only ?? [] });
  } catch (error) {
    return usage(error.message);
  }
  const clients = values.target === undefined
    ? await detectClients(homeFolder)
    : values.target === 'all' ? CLIENTS : [values.target];
  if (clients.length === 0) {
    return usage('No Claude Code or Codex folder was found in ' + homeFolder + '. Choose clients with --target claude, codex or all.');
  }
  const dryRun = values['dry-run'] === true;
  let plan;
  let result = null;
  try {
    plan = await planInstall({
      kit, items, scope: values.project ? 'project' : 'global', home: homeFolder, root, clients, force: values.force === true
    });
    if (!dryRun) {
      result = await applyPlan(plan, { home: homeFolder, now });
    }
  } catch (error) {
    stderr.write((error instanceof AgentKitError ? '' : 'Install failed: ') + error.message + '\n');
    return EXIT.FAILED;
  }
  const prefix = dryRun ? 'dry-run\t' : '';
  const count = { create: 0, replace: 0, unchanged: 0, skipped: 0, blocked: 0 };
  for (const action of plan.actions) {
    stdout.write(prefix + [action.action, action.reason, action.client, action.kind, action.name, action.path].join('\t') + '\n');
    count[action.action.startsWith('skip-') ? 'skipped' : action.action]++;
  }
  for (const backup of result?.backups ?? []) {
    stdout.write('backup\t' + backup.path + '\t' + backup.backup + '\n');
  }
  for (const warning of plan.warnings) {
    stdout.write('warning\t' + warning.code + '\t' + (warning.path ?? '-') + '\t' + warning.message + '\n');
  }
  if (result?.record) {
    stdout.write('record\t' + result.record + '\n');
  }
  stdout.write(prefix + 'summary\t' + Object.entries(count).map(([key, value]) => key + '=' + value).join('\t') + '\n');
  if (plan.actions.some(action => DECISIONS.has(action.action))) {
    stderr.write('Some files were skipped or blocked. Show these lines to the user before using --force; see docatlas agents help.\n');
    return EXIT.NEEDS_DECISION;
  }
  return EXIT.OK;
}
