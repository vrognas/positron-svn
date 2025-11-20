# DX Improvements - Implementation Checklist

Complete step-by-step guide to implement all 7 quick wins.

---

## PHASE 1: CRITICAL (5 Minutes) - Fix CI/CD

### [ ] 1.1 Add test-compile Script

**File**: `/home/user/positron-svn/package.json`

**Find**: Line 53 with `"pretest"` script
```json
"pretest": "npm-run-all --parallel build:ts lint",
```

**Add ABOVE it**:
```json
"test-compile": "npm run build:ts",
```

**Complete section should look like**:
```json
"scripts": {
  // ... other scripts ...
  "security:validate-errors": "tsc -p scripts/tsconfig.json && node out/scripts/validate-error-logging.js",
  "build": "node build.js && npm run build:css",
  "build:css": "sass scss/:css/ --style=compressed --no-source-map",
  "build:ts": "tsc -p ./",
  "compile": "node build.js --watch",
  "test-compile": "npm run build:ts",
  "pretest": "npm-run-all --parallel build:ts lint",
  "test": "vscode-test",
  // ... rest of scripts ...
}
```

### [ ] 1.2 Verify Fix
```bash
cd /home/user/positron-svn
npm run test-compile
# Expected: Should compile without errors
# Files created: ./out directory with compiled TypeScript
```

### [ ] 1.3 Commit
```bash
git add package.json
git commit -m "fix: add missing test-compile npm script"
```

---

## PHASE 2: HIGH-PRIORITY (30 Minutes) - Add Scripts & Docs

### [ ] 2.1 Add Development Workflow Scripts

**File**: `/home/user/positron-svn/package.json`

**Find** the `scripts` section and add after existing scripts:

```json
"scripts": {
  // ... existing scripts above ...

  // Development workflows
  "clean": "rm -rf out dist css .tsbuildinfo",
  "clean-install": "npm run clean && npm ci && npm run build",
  "build:quick": "npm run build:ts",
  "watch:ts": "tsc --watch --incremental",
  "watch": "npm-run-all --parallel watch:ts watch:css",
  "setup": "npm install && npm run build && npm test:fast",

  // Test utilities
  "test:watch": "npm run build:ts && vscode-test --watch",
  "test:coverage": "npm run build:ts && vscode-test --coverage",
  "test:debug": "npm run build:ts && node --inspect-brk ./node_modules/.bin/vscode-test",

  // ... rest of scripts ...
}
```

### [ ] 2.2 Verify Scripts Work

```bash
cd /home/user/positron-svn

# Test 1: Clean
npm run clean
# Expected: Removes out/, dist/, css/, .tsbuildinfo

# Test 2: Watch (background process, Ctrl+C to stop)
npm run watch
# Expected: "Watching for changes..." appears
# Try: Edit a TypeScript file, should auto-compile
# Stop with Ctrl+C

# Test 3: Setup
npm run setup
# Expected: Installs deps, builds, runs tests
# Takes ~2-3 minutes

# Test 4: Test watch
npm run test:watch
# Expected: Compiles and shows test runner
# Stop with Ctrl+C
```

### [ ] 2.3 Create DEVELOPMENT.md

**File**: `/home/user/positron-svn/DEVELOPMENT.md` (create new)

**Copy entire content from below**:

```markdown
# Local Development Guide

Positron SVN Extension - Development Setup & Workflow

## Quick Start

### First Time Setup
\`\`\`bash
npm run setup
# Installs dependencies, builds extension, runs tests
# Takes about 2-3 minutes
\`\`\`

### Active Development
\`\`\`bash
# Terminal 1: Watch for changes (continuously rebuilds)
npm run watch

# Terminal 2: Run tests (in separate terminal)
npm test
\`\`\`

---

## Build System Overview

This project uses **two complementary build systems**:

### 1. esbuild (VSCode Extension Bundle)
**Purpose**: Creates the extension file that VSCode loads
- **Entry point**: \`src/extension.ts\`
- **Output**: \`dist/extension.js\` (single bundled file)
- **Command**: \`npm run build\`
- **Watch mode**: Not available
- **When to use**: Building for release/testing in VSCode

### 2. TypeScript Compiler (tsc)
**Purpose**: Compiles TypeScript for development and tests
- **Input**: All \`src/**/*.ts\` files
- **Output**: \`out/\` directory (organized by file structure)
- **Commands**:
  - \`npm run build:ts\` - One-time compile
  - \`npm run compile\` - Watch mode
  - \`npm run watch:ts\` - Better watch (incremental)
- **When to use**: During development (always)
- **Note**: Uses .tsbuildinfo for incremental compilation

### 3. SCSS Compiler
**Purpose**: Compiles stylesheets
- **Command**: \`npm run build:css\`
- **Watch**: \`npm run watch:css\`

---

## Common Development Tasks

### Making Code Changes (Most Common)

Start watch mode - automatically recompiles on file changes:
\`\`\`bash
npm run watch
\`\`\`

This runs in background, rebuilds as you code. Press Ctrl+C to stop.

### Running Tests

#### Full test suite (includes linting)
\`\`\`bash
npm test
# Time: ~60-90 seconds
# Compiles TS + Lints + Runs tests
# Use before committing
\`\`\`

#### Quick tests (skip linting)
\`\`\`bash
npm run test:fast
# Time: ~30-40 seconds
# Only compiles + runs tests
# Good for iterating on test failures
\`\`\`

#### Watch mode (re-run on change)
\`\`\`bash
npm run test:watch
# Automatically re-runs tests when files change
# Good for TDD workflow
\`\`\`

#### Debug mode (attach debugger)
\`\`\`bash
npm run test:debug
# Starts test runner with debugger on port 9229
# Connect with VSCode or Chrome DevTools
\`\`\`

#### Coverage report
\`\`\`bash
npm run test:coverage
# Generates coverage report
# Time: ~40-50 seconds
\`\`\`

### Code Quality

#### Check for linting issues
\`\`\`bash
npm run lint
\`\`\`

#### Auto-fix linting errors
\`\`\`bash
npm run lint:fix
# Automatically fixes most issues
\`\`\`

#### Check code style
\`\`\`bash
npm run style-check
# Checks if code matches Prettier format
\`\`\`

#### Auto-format code
\`\`\`bash
npm run style-fix
# Auto-formats all TypeScript files
\`\`\`

### Before Committing

Run this checklist:
\`\`\`bash
# 1. Fix any lint issues
npm run lint:fix

# 2. Format code
npm run style-fix

# 3. Build for production
npm run build

# 4. Run full tests
npm test

# 5. Commit if all pass
git add .
git commit -m "your message"
\`\`\`

Or in one command:
\`\`\`bash
npm run lint:fix && npm run style-fix && npm run build && npm test
\`\`\`

### Cleaning Up

#### Remove build artifacts
\`\`\`bash
npm run clean
# Removes: out/, dist/, css/, .tsbuildinfo
\`\`\`

#### Fresh install
\`\`\`bash
npm run clean-install
# Clean + reinstall node_modules + rebuild everything
# Use if dependencies seem broken
\`\`\`

---

## Common Commands Reference

| Task | Command | Time |
|------|---------|------|
| Start development | \`npm run watch\` | 1s setup |
| Run all tests | \`npm test\` | 60-90s |
| Quick tests | \`npm run test:fast\` | 30-40s |
| Watch tests | \`npm run test:watch\` | Instant + ongoing |
| Auto-fix lint | \`npm run lint:fix\` | 3-5s |
| Format code | \`npm run style-fix\` | 3-5s |
| Build dist | \`npm run build\` | 15-20s |
| Fresh setup | \`npm run setup\` | 2-3m |
| Clean all | \`npm run clean\` | <1s |

---

## Troubleshooting

### Tests fail locally but pass in CI?
**Problem**: stale compilation

**Solution**:
\`\`\`bash
npm run clean
npm test
\`\`\`

### "Cannot find module" errors?
**Problem**: TypeScript not compiled

**Solution**:
\`\`\`bash
npm run build:ts
\`\`\`

### Watch mode not picking up changes?
**Problem**: might be hitting file limit (common on Linux)

**Solution**:
\`\`\`bash
# Increase file watch limit
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# Or just restart watch mode
# Press Ctrl+C then npm run watch again
\`\`\`

### Build takes forever?
**Problem**: might be esbuild bundling (normal first run)

**Solution**:
- First build: ~15-20s (normal)
- Subsequent: ~1-3s (incremental)
- Restart if seems stuck longer than 30s

### VSCode extension not loading?
**Problem**: dist/extension.js not built

**Solution**:
\`\`\`bash
npm run build
# Creates dist/extension.js which VSCode loads
\`\`\`

### All tests failing?
**Problem**: VSCode test binary missing

**Solution**:
\`\`\`bash
npm test
# First run downloads VSCode binary, then runs tests
# Takes longer but cached after
\`\`\`

---

## Development Workflow Example

Typical development session:

```bash
# 1. Start watching
npm run watch

# In another terminal:
# 2. Make code changes (watch picks them up)
# 3. Run tests
npm run test:fast

# 4. If tests pass:
npm run lint:fix
npm run style-fix

# 5. Before commit:
npm test

# 6. Commit
git commit -m "fix: my change"
```

---

## File Structure

Key directories:
- \`src/\` - Source TypeScript files
- \`out/\` - Compiled TypeScript (from tsc) - used by tests
- \`dist/\` - Bundled extension (from esbuild) - used by VSCode
- \`scss/\` - Stylesheets
- \`css/\` - Compiled stylesheets
- \`test/\` - Test files

Key files:
- \`build.js\` - esbuild configuration
- \`tsconfig.json\` - TypeScript configuration
- \`package.json\` - Dependencies and scripts
- \`.vscode-test.mjs\` - Test runner configuration

---

## Architecture Resources

For understanding system design:
- **docs/ARCHITECTURE_ANALYSIS.md** - System architecture overview
- **docs/LESSONS_LEARNED.md** - Development patterns and best practices
- **CLAUDE.md** - Coding guidelines and standards

---

## VS Code Recommended Extensions

- **ESLint** - Real-time linting
- **Prettier** - Code formatting
- **Test Explorer UI** - Run tests from UI
- **Debugger for Chrome** - Debug tests

---

## Getting Help

1. Check CLAUDE.md for coding standards
2. Check docs/ARCHITECTURE_ANALYSIS.md for system design
3. Check docs/LESSONS_LEARNED.md for patterns
4. Ask in team chat/discussion

---

**Version**: 1.0
**Last Updated**: 2025-11-20
```

### [ ] 2.4 Verify DEVELOPMENT.md Created

```bash
ls -la /home/user/positron-svn/DEVELOPMENT.md
# Expected: file exists and is readable
```

### [ ] 2.5 Commit Changes

```bash
git add package.json DEVELOPMENT.md
git commit -m "improve: add npm scripts and development guide

- Add test-compile, watch, clean, setup scripts
- Add test:watch, test:coverage, test:debug utilities
- Create DEVELOPMENT.md with comprehensive dev guide
- Reduces setup time and improves workflow clarity"
```

---

## PHASE 3: OPTIONAL (1 Hour) - Polish

### [ ] 3.1 Improve build.js Error Messages

**File**: `/home/user/positron-svn/build.js`

**Replace entire file** with:

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

**Key improvements**:
- ✓/✗ emoji indicators
- Clear success message
- Detailed error output

### [ ] 3.2 Commit Improvements

```bash
git add build.js
git commit -m "improve: better error messages in build process"
```

### [ ] 3.3 Setup Pre-commit Hooks (Optional)

```bash
cd /home/user/positron-svn

# Install dependencies
npm install -D husky lint-staged

# Setup husky
npx husky install
```

**Create** `/home/user/positron-svn/.husky/pre-commit`:

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Run linting on staged files
npx lint-staged
```

**Create** `/home/user/positron-svn/.lintstagedrc.json`:

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

### [ ] 3.4 Verify Pre-commit Works

```bash
# Try committing something (should run linting first)
npm run lint:fix  # Ensure no lint errors
git add -A
git commit -m "test: pre-commit hook"
# Expected: Should run eslint + prettier before committing
```

### [ ] 3.5 Commit Hook Setup

```bash
git add .husky .lintstagedrc.json
git commit -m "improve: add pre-commit hooks for code quality"
```

---

## Final Verification

### [ ] 4.1 Test All Scripts

```bash
cd /home/user/positron-svn

# Test each script
npm run test-compile    # Should compile TS
npm run watch           # Should watch files (Ctrl+C to stop)
npm run clean           # Should remove artifacts
npm run setup           # Should do full setup
npm run test:fast       # Should run tests quickly
npm run test:watch      # Should watch tests (Ctrl+C to stop)
npm run build           # Should build dist/extension.js
npm run lint:fix        # Should auto-fix lint
npm run style-fix       # Should auto-format
```

### [ ] 4.2 Verify Documentation

```bash
# Check DEVELOPMENT.md exists and is readable
cat /home/user/positron-svn/DEVELOPMENT.md | head -50
# Should see: "# Local Development Guide"
```

### [ ] 4.3 Run Full Test Suite

```bash
npm test
# All tests should pass
```

### [ ] 4.4 Check CI Works

```bash
# Simulate CI steps
npm run test-compile    # ✓ Should pass
npm run build:ts        # ✓ Should pass
npm run lint            # ✓ Should pass
npm run build           # ✓ Should pass
npm run size            # ✓ Should pass
npm test                # ✓ Should pass
```

### [ ] 4.5 Create Summary Commit

```bash
git log --oneline -5
# Should show:
# - improve: add pre-commit hooks (Phase 3)
# - improve: better error messages (Phase 3)
# - improve: add npm scripts and dev guide (Phase 2)
# - fix: add missing test-compile npm script (Phase 1)
```

---

## Success Criteria

After all phases complete:

✓ CI/CD unblocked (npm run test-compile works)
✓ Development faster (npm run watch works)
✓ Tests clearer (npm test:fast, npm test:watch available)
✓ Onboarding faster (DEVELOPMENT.md available)
✓ Error messages better (build.js improved)
✓ Code quality better (pre-commit hooks active)
✓ All tests passing
✓ All new developers can follow DEVELOPMENT.md

---

## Timeline

| Phase | Tasks | Effort | Timeline |
|-------|-------|--------|----------|
| 1 | Fix CI (test-compile) | 5m | NOW |
| 2 | Add scripts + docs | 30m | TODAY |
| 3 | Polish (errors, hooks) | 60m | THIS WEEK |
| **Total** | **All 7 quick wins** | **95m** | **THIS WEEK** |

---

## Questions?

Refer to:
- **DX_QUICK_WINS_ANALYSIS.md** - Why these changes?
- **DX_IMPROVEMENTS.md** - How to implement?
- **DX_QUICK_REFERENCE.md** - Quick lookup?
- **DEVELOPMENT.md** - Dev workflow guide?

---

**Status**: Ready to implement
**Created**: 2025-11-20
**Effort**: ~1.5 hours total
**ROI**: ~150 hours saved annually
