// ESLint v9 flat config
const tseslint = require('typescript-eslint');

module.exports = tseslint.config(
  // Global ignores (replaces .eslintignore)
  {
    ignores: [
      '**/vscode.proposed.d.ts',
      'src/test/**/*.ts',
      'src/tools/**/*.ts',
      'dist/**',
      'out/**',
      'node_modules/**',
      '*.js', // Ignore JS config files
      'build.js',
      'css/**',
      'icons/**',
      'images/**',
      '**/*.json'
    ]
  },

  // Base TypeScript config
  ...tseslint.configs.recommended,

  // Custom rules for TypeScript files
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.json',
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    },
    rules: {
      // TypeScript rules
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        caughtErrors: 'none'
      }],
      '@typescript-eslint/no-inferrable-types': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-unused-expressions': 'off'
    }
  }
);
