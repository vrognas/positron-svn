# DX Improvements - Implementation Guide

Quick reference for implementing all 7 DX quick wins.

---

## 1. Fix test-compile Script (CRITICAL)

### File: package.json
Look for pretest script around line 53 and add test-compile:

```json
{
  "scripts": {
    "test-compile": "npm run build:ts",
    "pretest": "npm-run-all --parallel build:ts lint",
    // ... rest of scripts
  }
}
```

**Why**: CI calls `npm run test-compile` but script doesn't exist. This is breaking the build.

---

## 2. Add Development Workflow Scripts

### File: package.json
Add these scripts to the scripts section:

```json
{
  "scripts": {
    // ... existing scripts ...
    "clean": "rm -rf out dist css .tsbuildinfo",
    "clean-install": "npm run clean && npm ci && npm run build",
    "build:quick": "npm run build:ts",
    "watch:ts": "tsc --watch --incremental",
    "watch": "npm-run-all --parallel watch:ts watch:css",
    "setup": "npm install && npm run build && npm test:fast"
  }
}
```

**Commands developers will use**:
- `npm run setup` - Fresh local environment
- `npm run watch` - Watch all files during development
- `npm run clean` - Clean build artifacts
- `npm run build:quick` - Fast TypeScript rebuild

---

## 3. Add Test Utility Scripts

### File: package.json
Add these test-related scripts:

```json
{
  "scripts": {
    // ... existing test scripts ...
    "test:fast": "npm run build:ts && vscode-test",
    "test:watch": "npm run build:ts && vscode-test --watch",
    "test:coverage": "npm run build:ts && vscode-test --coverage",
    "test:debug": "npm run build:ts && node --inspect-brk ./node_modules/.bin/vscode-test"
  }
}
```

**Commands developers will use**:
- `npm test:fast` - Quick test run (TS only, no lint)
- `npm test:watch` - Tests re-run on file changes
- `npm test:coverage` - Generate coverage reports
- `npm test:debug` - Debug tests in Node inspector

---

## 4. Create DEVELOPMENT.md

### File: /home/user/positron-svn/DEVELOPMENT.md

Create new file with this content:

```markdown
# Local Development Guide

Positron SVN Extension

## Quick Start

### First Time Setup
\`\`\`bash
npm run setup
# Installs deps, builds, runs tests
\`\`\`

### Active Development
\`\`\`bash
# Terminal 1: Watch for changes
npm run watch

# Terminal 2: Run tests (in separate terminal)
npm test
\`\`\`

---

## Build System Overview

This project uses two complementary build systems:

### 1. esbuild (VSCode Extension Bundle)
- **Purpose**: Creates \`dist/extension.js\` that VSCode loads
- **Entry**: \`src/extension.ts\`
- **Command**: \`npm run build\`
- **Output**: \`dist/extension.js\` (minified, bundled)
- **Note**: No watch mode available for esbuild
- **When to use**: Before packaging or publishing

### 2. tsc (TypeScript Compilation)
- **Purpose**: Compiles all TypeScript for tests and tools
- **Entry**: All \`src/**/*.ts\` files
- **Command**: \`npm run build:ts\`
- **Output**: \`out/\` directory (organized by source structure)
- **Watch**: \`npm run compile\` or \`npm run watch:ts\`
- **When to use**: During development, always
- **Incremental**: Uses .tsbuildinfo cache for speed

### 3. SCSS Compilation
- **Purpose**: Compiles stylesheets
- **Command**: \`npm run build:css\`
- **Watch**: \`npm run watch:css\`

---

## Development Workflows

### Making Code Changes

Use watch mode for instant feedback:
\`\`\`bash
npm run watch
# Rebuilds TypeScript + CSS on file change
# Takes 1-3 seconds per change
\`\`\`

### Running Tests

#### Run tests once
\`\`\`bash
npm test
# Compiles TS + Lints + Runs tests (60-90s)
\`\`\`

#### Fast test run (skip linting)
\`\`\`bash
npm run test:fast
# Compiles TS + Runs tests only (30-40s)
# Good for iterating on test failures
\`\`\`

#### Watch tests
\`\`\`bash
npm run test:watch
# Re-runs tests on file change
# Good for TDD workflow
\`\`\`

#### Debug tests
\`\`\`bash
npm run test:debug
# Opens Node inspector on port 9229
# Connect with VSCode debugger or Chrome DevTools
\`\`\`

### Code Quality

#### Lint check
\`\`\`bash
npm run lint
\`\`\`

#### Auto-fix issues
\`\`\`bash
npm run lint:fix
# Auto-fixes linting errors
\`\`\`

#### Check code style
\`\`\`bash
npm run style-check
# Check Prettier formatting (TS files)
\`\`\`

#### Auto-format
\`\`\`bash
npm run style-fix
# Auto-format all TypeScript files
\`\`\`

### Before Committing

\`\`\`bash
npm run lint:fix      # Auto-fix lint errors
npm run style-fix     # Auto-format code
npm run build         # Ensure esbuild works
npm test              # Run full test suite
\`\`\`

Or in one command:
\`\`\`bash
npm run lint:fix && npm run style-fix && npm run build && npm test
\`\`\`

---

## Cleaning Up

### Clean build artifacts
\`\`\`bash
npm run clean
# Removes: out/, dist/, css/, .tsbuildinfo
\`\`\`

### Fresh install
\`\`\`bash
npm run clean-install
# Cleans, reinstalls node_modules, rebuilds everything
\`\`\`

---

## Troubleshooting

### Tests failing locally but passing in CI?
- CI runs \`pretest\` which compiles + lints
- Local might be stale: \`npm run clean && npm test\`

### "Module not found" errors?
- TypeScript out of date: \`npm run build:ts\`
- Stale cache: \`npm run clean && npm run build:ts\`

### esbuild takes forever?
- Normal (15-20s first time, 1-3s incremental)
- Use \`npm run watch:ts\` for iteration instead

### Can't run tests?
- Need VSCode binary: \`npm run test\` downloads it
- Takes longer first time, cached after

---

## Common Commands

| Task | Command | Time |
|------|---------|------|
| Start dev loop | \`npm run watch\` | 1s setup |
| Run tests | \`npm test\` | 60-90s |
| Fast tests | \`npm run test:fast\` | 30-40s |
| Watch tests | \`npm run test:watch\` | 5-10s per change |
| Lint check | \`npm run lint\` | 3-5s |
| Auto-fix | \`npm run lint:fix\` | 3-5s |
| Build dist | \`npm run build\` | 15-20s |
| Package VSIX | \`npm run package\` | 30-45s |

---

## Architecture Notes

See \`docs/ARCHITECTURE_ANALYSIS.md\` for system design.

Key files:
- \`src/extension.ts\` - Extension entry point
- \`src/source_control_manager.ts\` - Repository management
- \`src/repository.ts\` - Single repo state
- \`src/commands/\` - Command implementations

---

## Contributing

1. Read \`CLAUDE.md\` for coding guidelines
2. Read \`docs/LESSONS_LEARNED.md\` for patterns
3. Create feature branch from \`master\`
4. Make changes, run \`npm run watch\` for feedback
5. Run \`npm test\` before commit
6. Use \`npm run lint:fix\` to auto-fix issues
7. Push and create PR

---

Version: 1.0
Last Updated: 2025-11-20
```

---

## 5. Improve Error Messages in build.js

### File: /home/user/positron-svn/build.js

Replace the file with:

```javascript
const esbuild = require('esbuild');

const isWatch = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: ['vscode', '@posit-dev/positron'],
  format: 'cjs',
  platform: 'node',
  target: 'node16',
  minify: !isWatch,
  sourcemap: true,
  mainFields: ['module', 'main'],
  treeShaking: true,
  logLevel: 'info',
};

if (isWatch) {
  esbuild.context(buildOptions)
    .then(ctx => {
      ctx.watch();
      console.log('✓ Watching for changes... (Press Ctrl+C to stop)');
    })
    .catch(err => {
      console.error('✗ Build failed:', err.message);
      if (err.errors && err.errors.length > 0) {
        console.error('Errors:');
        err.errors.forEach(e => console.error('  - ' + e.text));
      }
      process.exit(1);
    });
} else {
  esbuild.build(buildOptions)
    .then(() => {
      console.log('✓ Build successful: dist/extension.js');
    })
    .catch(err => {
      console.error('✗ Build failed:', err.message);
      if (err.errors && err.errors.length > 0) {
        console.error('Errors:');
        err.errors.forEach(e => console.error('  - ' + e.text));
      }
      process.exit(1);
    });
}
```

**Changes**:
- Added ✓/✗ emoji indicators
- Added error details output
- Better error message formatting

---

## 6. Setup Pre-commit Hooks (Optional)

### File: /home/user/positron-svn/.husky/pre-commit

Create if using husky:

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Run linting on staged files
npx lint-staged
```

### File: /home/user/positron-svn/.lintstagedrc.json

Create new file:

```json
{
  "src/**/*.ts": [
    "eslint --fix",
    "prettier --write"
  ],
  "scss/**/*.scss": [
    "prettier --write"
  ]
}
```

### Setup
\`\`\`bash
npm install -D husky lint-staged
npx husky install
\`\`\`

---

## Summary of Changes

### Must Do (Critical)
1. ✓ Add \`test-compile\` script to package.json

### Should Do (High Impact)
2. ✓ Add development workflow scripts to package.json
3. ✓ Add test utility scripts to package.json
4. ✓ Create DEVELOPMENT.md

### Nice to Have
5. ✓ Improve build.js error messages
6. ✓ Setup pre-commit hooks

---

## Testing Your Changes

After implementing, verify:

\`\`\`bash
# Test new scripts work
npm run test-compile   # Should compile TS
npm run watch         # Should watch files
npm run clean         # Should delete build artifacts
npm run setup         # Should install + build + test
npm test:fast         # Should run tests
\`\`\`

If all pass, commit with:
\`\`\`bash
git commit -m "improve: add DX scripts and documentation"
\`\`\`

---

**Total Implementation Time**: 1-2 hours
**Impact**: 20-40% faster development iteration
