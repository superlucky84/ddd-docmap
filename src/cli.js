import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import open from 'open';
import { CollectionOptionsError, ConfigurationError, ProjectError } from './collector/index.js';
import { startServer } from './server/index.js';
import { runAgents } from './agent-kit/command.js';

const metadata = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const help = [
  'docatlas — local document maps for Doc-Driven Development', '',
  'Usage:',
  '  docatlas [--root <directory>] [--docs-dir <directory>] [--all-md] [--no-open]',
  '  docatlas --help',
  '  docatlas --version',
  '  docatlas agents install [options]  Install doc-driven agent skills for Claude Code and Codex.',
  '  docatlas agents help               Steps for people and AI agents running the install.', '',
  'Compatibility aliases: docmap, ddd-docmap', '',
  'Options:',
  '  --root <directory>  Read this project instead of the current directory.',
  '  --docs-dir <path>   Add a literal docs directory relative to the project root; repeatable.',
  '  --all-md           Include all Markdown, overriding config include patterns.',
  '  --no-open           Print the address without opening a browser.',
  '  -h, --help          Show this help.',
  '  -v, --version       Show the package version.', '',
  'Examples:',
  '  docatlas --docs-dir documentation --docs-dir notes',
  '  docatlas --all-md', '',
  'Configuration: <project root>/docatlas.config.json (version: 1).',
  'If absent, ddd-docmap.config.json is used. The new file wins when both exist.',
  '  include / exclude  Replace their default glob patterns.',
  '  groups             Override directory titles and summaries.',
  '  redirects          Map previous Markdown paths to current documents.',
  '--docs-dir adds to include; --all-md replaces include. Exclusions still apply.',
  'node_modules, .git, ignored paths, and symbolic links are never bypassed.',
  'Settings and examples: https://github.com/superlucky84/docatlas#configuration', '',
  'Keep this terminal open. Press Ctrl+C to stop your document map.',
  'Read formatted Markdown or switch to source view in the browser.', ''
].join('\n');

export async function run(args, {
  stdout = process.stdout, stderr = process.stderr, signals = process, opener = open, home, cwd, kitDir, now
} = {}) {
  if (args[0] === 'agents') {
    return runAgents(args.slice(1), { stdout, stderr, home, cwd, kitDir, now });
  }
  let values;
  try {
    ({ values } = parseArgs({
      args, allowPositionals: false, strict: true,
      options: {
        root: { type: 'string' }, 'no-open': { type: 'boolean' },
        'docs-dir': { type: 'string', multiple: true }, 'all-md': { type: 'boolean' },
        help: { type: 'boolean', short: 'h' }, version: { type: 'boolean', short: 'v' }
      }
    }));
  } catch (error) {
    stderr.write(error.message + '\nRun docatlas --help for usage.\n');
    return 2;
  }
  if (values.help) {
    stdout.write(help);
    return 0;
  }
  if (values.version) {
    stdout.write(metadata.version + '\n');
    return 0;
  }
  let session;
  try {
    stdout.write('Reading documentation...\n');
    session = await startServer({ root: values.root, collectionOptions: {
      docsDirs: values['docs-dir'] || [], allMarkdown: values['all-md'] || false
    } });
  } catch (error) {
    stderr.write(error.message + '\n');
    return error instanceof ConfigurationError || error instanceof ProjectError || error instanceof CollectionOptionsError ? 2 : 1;
  }
  let stopping = false;
  let resolveStopped;
  const stopped = new Promise(resolve => { resolveStopped = resolve; });
  const onSignal = () => { void stop(); };
  async function stop() {
    if (stopping) return;
    stopping = true;
    signals.off('SIGINT', onSignal);
    signals.off('SIGTERM', onSignal);
    try {
      await session.close();
      stdout.write('Document map stopped.\n');
      resolveStopped(0);
    } catch (error) {
      stderr.write('Could not stop the server: ' + error.message + '\n');
      resolveStopped(1);
    }
  }
  signals.once('SIGINT', onSignal);
  signals.once('SIGTERM', onSignal);
  stdout.write('Document map: ' + session.url + '\n');
  stdout.write('Project: ' + session.snapshot.project.rootLabel + '\n');
  stdout.write(session.snapshot.documents.length + ' documents. Press Ctrl+C to stop.\n');
  if (!values['no-open']) {
    void Promise.resolve().then(() => {
      if (!stopping) return opener(session.url);
    }).catch(error => {
      if (!stopping) {
        stderr.write('Could not open a browser: ' + error.message + '\nOpen ' + session.url + ' manually.\n');
      }
    });
  }
  return stopped;
}

