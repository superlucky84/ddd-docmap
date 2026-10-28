export const GENERATED_DOCUMENTS = {
  '.venv/lib/python3.12/site-packages/example/docs/README.md': '# Virtual environment dependency',
  'tools/venv/Lib/site-packages/example/REQUIREMENTS.md': '# Windows virtual environment dependency',
  '.conda/lib/python3.12/site-packages/example/docs/README.md': '# Conda environment dependency',
  'services/api/.conda/Lib/site-packages/example/DESIGN.md': '# Nested Windows conda environment dependency',
  'src/__pycache__/docs/DESIGN.md': '# Bytecode cache',
  '.pytest_cache/docs/README.md': '# Test cache',
  'tools/.mypy_cache/docs/DESIGN.md': '# Type checker cache',
  '.ruff_cache/docs/README.md': '# Linter cache',
  '.tox/py312/docs/README.md': '# Tox environment',
  'tools/.nox/test/docs/README.md': '# Nox environment',
  '.eggs/dependency/docs/README.md': '# Legacy package dependency',
  'src/example.egg-info/docs/README.md': '# Package metadata',
  'target/generated-docs/docs/README.md': '# Maven build output',
  'services/account/target/site/REQUIREMENTS.md': '# Nested Maven build output',
  '.gradle/caches/plugin/docs/README.md': '# Gradle plugin cache',
  'services/account/.gradle/docs/DESIGN.md': '# Nested Gradle cache',
  '.m2/repository/example/docs/README.md': '# Project-local Maven cache',
  'services/account/build/docs/README.md': '# Gradle build output'
};

export const SOURCE_DOCUMENTS = {
  'docs/DESIGN.md': '# Application contract',
  'src/python/REQUIREMENTS.md': '# Python feature contract',
  'src/main/java/example/DESIGN.md': '# Java feature contract',
  'services/account/docs/DESIGN.md': '# Spring service contract',
  'target-design/docs/README.md': '# Target selection design',
  'venv-guide/docs/README.md': '# Virtual environment guide',
  'env/docs/DESIGN.md': '# Environment feature contract',
  'bin/docs/DESIGN.md': '# Command feature contract',
  'out/docs/DESIGN.md': '# Outbound feature contract',
  'vendor/docs/DESIGN.md': '# Vendor feature contract'
};

export const LANGUAGE_FILES = {
  'pyproject.toml': '[project]\nname = "example"\nversion = "1.0"\n',
  'main.py': 'raise RuntimeError("Project code must never run")\n',
  'pom.xml': '<project><modelVersion>4.0.0</modelVersion></project>\n',
  'build.gradle.kts': 'error("Project build must never run")\n',
  ...GENERATED_DOCUMENTS,
  ...SOURCE_DOCUMENTS
};
