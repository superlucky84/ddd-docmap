import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const cliPath = fileURLToPath(new URL('../../bin/docatlas.js', import.meta.url));

export async function startCli(t, { cwd, args = [], executable = cliPath }) {
  const child = spawn(process.execPath, [executable, ...args], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  const exited = new Promise(resolve => child.once('exit', (code, signal) => resolve({ code, signal })));
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
    await exited;
  });
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('CLI did not become ready.\n' + stderr)), 5000);
    const finish = fn => value => { clearTimeout(timer); fn(value); };
    child.once('error', finish(reject));
    child.stdout.on('data', data => {
      stdout += data.toString();
      const match = stdout.match(/Document map: (http:\/\/127\.0\.0\.1:\d+\/)/);
      if (match) finish(resolve)(match[1]);
    });
    child.stderr.on('data', data => { stderr += data.toString(); });
    void exited.then(result => finish(reject)(new Error(
      'CLI exited before ready: ' + JSON.stringify(result) + '\n' + stderr
    )));
  });
  return { child, url, exited, output: () => ({ stdout, stderr }) };
}
