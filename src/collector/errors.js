export class ConfigurationError extends Error {
  constructor(message, options = {}) {
    super('ddd-docmap.config.json: ' + message, { cause: options.cause });
    this.name = 'ConfigurationError';
    this.code = 'INVALID_CONFIG';
  }
}

export class ProjectError extends Error {
  constructor(message, options = {}) {
    super(message, { cause: options.cause });
    this.name = 'ProjectError';
    this.code = 'INVALID_ROOT';
  }
}
