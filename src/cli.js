import { readFileSync } from 'node:fs';

const metadata = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8')
);

const help = `ddd-docmap — local document maps for Doc-Driven Development

Status: initial project scaffold. The document map viewer is planned.

Usage:
  ddd-docmap --help
  ddd-docmap --version

Options:
  -h, --help     Show this help.
  -v, --version  Show the package version.

Roadmap: https://github.com/superlucky84/ddd-docmap/blob/main/docs/IMPLEMENT.md
`;

export function run(args) {
  if (args.length === 0 || (args.length === 1 && ['--help', '-h'].includes(args[0]))) {
    process.stdout.write(help);
    return 0;
  }

  if (args.length === 1 && ['--version', '-v'].includes(args[0])) {
    process.stdout.write(`${metadata.version}\n`);
    return 0;
  }

  process.stderr.write('Unsupported arguments. Run ddd-docmap --help.\n');
  return 2;
}

