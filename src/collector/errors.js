export class ConfigurationError extends Error {
  constructor(message, options = {}) {
    const file = options.file || 'docatlas.config.json';
    super(file + ': ' + message, { cause: options.cause });
    this.name = 'ConfigurationError';
    this.code = 'INVALID_CONFIG';
    this.file = file;
    this.detail = message;
  }
}

export class ProjectError extends Error {
  constructor(message, options = {}) {
    super(message, { cause: options.cause });
    this.name = 'ProjectError';
    this.code = 'INVALID_ROOT';
  }
}

export class CollectionOptionsError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CollectionOptionsError';
    this.code = 'INVALID_COLLECTION_OPTIONS';
  }
}
