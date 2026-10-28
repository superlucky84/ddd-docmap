import { scanProject } from './scan.js';

export { CollectionOptionsError, ConfigurationError, ProjectError } from './errors.js';

/** Collect a deterministic snapshot without starting a server or changing the project. */
export async function collectProject(directory = process.cwd(), collectionOptions = {}) {
  return (await scanProject(directory, { collectionOptions })).snapshot;
}
