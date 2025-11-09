# Positron SVN - Feature Roadmap

This document tracks future enhancement ideas and potential improvements for the extension.

## Phase 4+: Future Enhancements (Optional)

### UI/UX Improvements

#### VS Code Webview UI Toolkit Migration
**Status**: Idea
**Effort**: 2-3 hours
**Priority**: Low

Migrate commit message webview to use Microsoft's official [VS Code Webview UI Toolkit](https://github.com/microsoft/vscode-webview-ui-toolkit).

**Benefits**:
- Native VS Code look and feel with web components
- Future-proof with official Microsoft support
- Automatic theme integration
- Built-in accessibility features
- Example:
  ```html
  <vscode-text-area>Commit message</vscode-text-area>
  <vscode-button appearance="primary">Commit</vscode-button>
  ```

**Drawbacks**:
- Requires HTML refactor
- New ~20KB dependency
- Breaking change to existing webview
- Testing overhead across themes

**When to Consider**:
- When webview needs major redesign
- When adding more complex UI components
- When Microsoft stabilizes toolkit (currently stable)

---

### Dependency Optimization

#### Replace tmp with Native fs/promises
**Status**: Pending
**Effort**: 3 hours
**Priority**: Low

Replace `tmp` package (~8KB) with Node.js native APIs (fs/promises, os.tmpdir()).

**Benefits**: -8KB, modern async/await, zero dependencies
**Drawbacks**: Need manual cleanup tracking

#### Migrate iconv-lite-umd to @vscode/iconv-lite-umd
**Status**: Pending
**Effort**: 1 hour
**Priority**: Medium

Current package `iconv-lite-umd` is deprecated. Migrate to official `@vscode/iconv-lite-umd`.

**Note**: Check if size or API changes affect build/bundle.

---

### Build & Tooling

#### ESLint Flat Config Migration
**Status**: Idea
**Effort**: 2 hours
**Priority**: Low

Migrate from `.eslintrc.js` to `eslint.config.js` (ESLint 9+ standard).

**Benefits**: Modern config, better performance
**Timing**: When ESLint 10+ becomes standard

#### Biome Evaluation (2026+)
**Status**: Future
**Effort**: 4 hours
**Priority**: Low

Evaluate [Biome](https://biomejs.dev/) as replacement for ESLint + Prettier.

**Benefits**: 100x faster, single tool, Rust-based
**Timing**: When Biome reaches full maturity (200+ rules)

---

### CI/CD & Automation

#### Renovate Setup
**Status**: Pending
**Effort**: 1 hour
**Priority**: Medium

Add Renovate for automated dependency updates with smart grouping.

**Config**: Group @types/*, automerge devDependencies after 3 days

#### CodeQL Security Scanning
**Status**: Pending
**Effort**: 1 hour
**Priority**: Medium

Add GitHub CodeQL workflow for automated security scanning.

---

### Performance

#### Lazy Loading Heavy Modules
**Status**: Idea
**Effort**: 2 hours
**Priority**: Low

Implement dynamic imports for heavy modules (xml2js, dayjs plugins).

**Example**:
```typescript
let _xmlParser: typeof import('xml2js') | undefined;
async function getXmlParser() {
  if (!_xmlParser) _xmlParser = await import('xml2js');
  return _xmlParser;
}
```

**Benefits**: Faster initial activation, reduced memory

#### Fast-xml-parser Migration
**Status**: Idea
**Effort**: 6-8 hours
**Priority**: Low

Replace `xml2js` with `fast-xml-parser` (10x faster, promise-based).

**Timing**: Only if refactoring parsers anyway (5 files affected)

---

## Completed Phases

### ✅ Phase 1: Critical Fixes (Complete - 2025-01-09)
- Removed duplicate dependencies (jschardet, @posit-dev/positron)
- Standardized on npm (removed yarn.lock)
- Modernized CI/CD (Node 20.x, GitHub Actions v4)
- Fixed ESLint deprecations

### ✅ Phase 2: Build Optimization (Complete - 2025-01-09)
- Added esbuild bundler (313.9KB bundle, 77.28KB brotli)
- Configured bundle size tracking with size-limit (200KB cap)
- Optimized activation with onStartupFinished event

### ✅ Phase 3: UI & Dependencies (Complete - 2025-11-09)
- Removed Milligram dependency (zero Sass warnings, -8KB)
- Custom minimal CSS for commit webview (2.3KB)

---

## Contributing Ideas

Have a feature idea? Open an issue at: https://github.com/viktor-rognas/svn-scm/issues

**Note**: This roadmap is aspirational. Not all items will be implemented.
