// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Subject line max 50 characters
    'header-max-length': [2, 'always', 50],
    // Body line max 72 characters
    'body-max-line-length': [2, 'always', 72],
    // Allow custom scopes
    'scope-case': [0],
    // Type enum
    'type-enum': [
      2,
      'always',
      [
        'feat',     // New feature
        'fix',      // Bug fix
        'perf',     // Performance improvement
        'refactor', // Code refactoring
        'test',     // Add/update tests
        'docs',     // Documentation
        'chore',    // Maintenance
        'style',    // Code style (formatting)
        'ci',       // CI/CD changes
        'build',    // Build system changes
        'revert',   // Revert previous commit
      ],
    ],
  },
};
