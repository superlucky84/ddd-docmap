import { scanProject } from './scan.js';

export { ConfigurationError, ProjectError } from './errors.js';

/** Collect a deterministic snapshot without starting a server or changing the project. */
export async function collectProject(directory = process.cwd()) {
  return (await scanProject(directory)).snapshot;
}
