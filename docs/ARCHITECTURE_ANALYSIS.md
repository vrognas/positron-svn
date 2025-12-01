# SVN Extension Architecture

**Version**: 2.18.0
**Updated**: 2025-11-28

---

## Executive Summary

Mature VS Code extension for SVN integration. Event-driven architecture, decorator-based commands, multi-repository management.

**Stats**:

- **Source lines**: ~13,200 (+550 blame config system)
- **Repository**: 923 lines (22% reduction via 3 extracted services)
- **Commands**: 54 (+3 blame commands)
- **Coverage**: ~60-65% (930+ tests, +41 e2e critical paths) ✅ EXCEEDED TARGET
- **Stability**: 🟢 P0 foundation complete ✅ (4 bugs fixed/addressed)
- **Performance**: 🟢 All P1 bottlenecks fixed ✅ (commit 4-5x, status 3-5x, glob 3x, batch 2-3x faster)
- **Security**: 🟢 All error logging sanitized ✅ (100% coverage, 0 violations)
- **Positron**: 🟢 Runtime detection + Connections pane ✅
- **Blame**: 🟢 Default enabled + dynamic toggle icon ✅
- **Bloat**: ~500-1000 lines removable (duplicate methods, god classes)
- **Test tooling**: c8 coverage reporting configured ✅

---

## Architecture Layers

### Extension Entry

**File**: `src/extension.ts` (164 lines)
Flow: activate() → SvnFinder → Svn → SourceControlManager → registerCommands()

### Repository Management

**SourceControlManager** (527 lines):

- Multi-repository coordinator
- Workspace folder detection
- Event emission for lifecycle

**Repository** (923 lines):

- Single repository state
- SVN operations coordination
- File watcher coordination
- Delegates to services

**Services** (4 extracted):

- **StatusService** (355 lines): Model state updates
- **ResourceGroupManager** (298 lines): VS Code resource groups
- **RemoteChangeService** (107 lines): Polling timers
- **Blame System** (286 lines config + state): Per-file blame tracking

### SVN Execution

**Svn** (369 lines):

- Process spawning, error handling
- Encoding detection/conversion
- Auth credential management

### Command Pattern

**Command base** (492 lines):

- 50+ subclasses for SVN operations
- Repository resolution
- Diff/show infrastructure

---

## Critical Issues (P0) 🔴

### Stability Bugs

**A. Watcher crash** ✅ FIXED (v2.17.114)

- Changed: `throw error` → graceful logging
- 1-5% users protected
- +3 tests

**B. Global state data race** ✅ FIXED (v2.17.117)

- Per-repo keys implemented (`decorators.ts:128`)
- 30-40% users protected from multi-repo corruption
- Each repo now has independent operation queue

**C. Unsafe JSON.parse** ✅ FIXED (v2.17.118)

- Safe try-catch wrappers implemented (`repository.ts:809,826`, `uri.ts:12`)
- 5-10% users protected from crashes on malformed storage
- Returns safe defaults, logs errors

### Security Bugs

**D. Sanitization gaps** ✅ COMPLETE (v2.17.129)

- Safe logging utility created (`util/errorLogger.ts`)
- All 47 catch blocks migrated to logError()
- CI validator enforces sanitization (v2.17.127)
- 100% users protected - all error paths sanitized ✅

---

## Performance Analysis

### P0 Issues - Resolved ✅

- ✅ **UI blocking**: FIXED (v2.17.108-109)
- ✅ **Memory leak**: FIXED (v2.17.107)
- ✅ **Remote polling**: FIXED (v2.17.107)

### P1 Issues

**A. Commit traversal** ✅ FIXED (v2.17.120)

- Flat resource map for O(1) parent lookups (`commit.ts:47-64`)
- 80-100% users, 20-100ms → 5-20ms (4-5x faster)

**B. Descendant resolution** ✅ FIXED (v2.17.121)

- Single-pass O(n) algorithm (`StatusService.ts:214-235`)
- 50-70% users, 100-500ms → 20-100ms (3-5x faster)

**C. Glob matching** ✅ FIXED (v2.17.122)

- Two-tier matching: simple patterns → complex (`globMatch.ts:35-67`)
- 30-40% users, 10-50ms → 3-15ms (3x faster)

**D. Batch operations** ✅ FIXED (v2.17.123)

- Adaptive chunking (`batchOperations.ts`, `svnRepository.ts:621-636,808-819`)
- 20-30% users, 50-200ms → 20-80ms (2-3x faster)

---

## Code Quality Analysis

### Bloat (P2)

- show/showBuffer: 139L duplicate
- util.ts: 336L dumping ground
- Error handling: 70 catch blocks, inconsistent

### Type Safety (P2)

- 248 `any` types (25 files)
- Unsafe casts, missing guards

### Security (P2)

- Password CLI exposure (`svn.ts:110-113`)
- ✅ esbuild vuln: FIXED (v2.17.106)
- ✅ stderr leaks: FIXED (v2.17.102)

---

## Completed Improvements ✅

### Performance (Phases 8-19)

- **Phase 18**: UI non-blocking (ProgressLocation.Notification, cancellation tokens)
- **Phase 19**: Memory leak fix (LRU cache), remote polling (95% faster)
- **Phases 8-16**: Config cache, decorator removal, conditional index rebuild
- **Result**: All P0 bottlenecks resolved, UI responsive, memory stable

### Code Quality

- 162 lines removed (150 helpers/factory + 12 dead code)
- 3 services extracted (760 lines)
- Repository.ts: 1,179 → 923 lines (22% reduction)
- Encapsulation: 2 internal methods made private

### Security

- Stderr sanitization (M-1 critical fix, credential disclosure prevented)

### Testing

- 138 → 856 → 930+ tests (+792, +574%)
- 21-23% → 50-55% → 60-65% coverage ✅ EXCEEDED TARGET
- Phase 18-19: +12 tests (UI blocking, memory, polling)
- Phase 22 (v2.17.235): +41 e2e tests (core execution, services, commands, fs)
  - Core: svn.ts, svnFinder, resource.ts (9 tests)
  - Services: StatusService, ResourceGroupManager, RemoteChangeService (9 tests)
  - Commands: add, remove, commitAll, upgrade, pullIncomingChange (15 tests)
  - File system: mkdir, write_file, read_file, stat (8 tests)
- Coverage tooling: c8 configured for HTML/text/lcov reports

---

## Design Patterns

1. **Command Pattern**: Command base + 50+ subclasses
2. **Observer/Event**: EventEmitter throughout
3. **Repository Pattern**: Data access abstraction
4. **Decorator**: @memoize, @throttle, @debounce, @sequentialize
5. **Strategy**: Multiple parsers (status, log, info, diff, list)
6. **Adapter**: File watching, URI schemes

---

## Key Files

**Entry**: extension.ts, source*control_manager.ts, commands.ts
**Core**: repository.ts, svnRepository.ts, svn.ts
**Services**: statusService.ts, resourceGroupManager.ts, remoteChangeService.ts
**Blame**: blameConfiguration.ts, blameStateManager.ts, commands/blame/*.ts
**Commands**: command.ts (base), commands/\_.ts (54 total, 3 blame)
**Parsing**: statusParser.ts, logParser.ts, infoParser.ts
**Utils**: types.ts (323 lines), util.ts, decorators.ts

---

## Strengths

1. Event-driven, clear Observer pattern
2. Layered (UI, Business Logic, CLI Wrapper)
3. Decorator-based commands (elegant)
4. Configurable behavior
5. Async/await throughout
6. Separate concerns (parsing, execution, UI)

---

## Next Actions

**P0 (Phase 20)**: Stability & security - CRITICAL (8-12h, MUST FIX FIRST)
**P1 (Phase 21)**: Performance optimization (5-8h)
**P2/P3**: Code quality, type safety, architecture (110-155h)

See IMPLEMENTATION_PLAN.md for details.

---

## Recent Additions (v2.17.215)

### Blame Performance Optimizations

- **Progressive rendering**: 10-20x faster (v2.17.208)
- **Template compilation**: 10-20x faster (v2.17.209)
- **Batch log fetching**: 50x faster (v2.17.210)
- **Scroll handler removal**: Eliminates 100-200ms lag (v2.17.211)
- **Icon type leak fix**: Prevents unbounded growth (v2.17.212)
- **Document flicker fix**: No visible flicker during typing (v2.17.213)
- **Cursor tracking**: 60-80% faster (v2.17.214)
- **LRU cache eviction**: MAX_CACHE_SIZE=20, MAX_MESSAGE_CACHE_SIZE=500 (v2.17.215)

### Blame Configuration System (v2.17.186)

- **Complete**: 13 settings, 3 commands, 5 menu integrations
- **Architecture**: BlameConfiguration (singleton), BlameStateManager (per-file tracking)
- **State Management**: 3-level toggles (extension-wide, global, per-file)
- **Tests**: 27 end-to-end tests across 3 suites
- **Templates**: Customizable status bar/gutter with variable substitution
- **Performance**: Large file warnings, optional log fetching (4-10x speedup)
- **Design Doc**: BLAME_CONFIG_DESIGN.md (545 lines)

---

### File Locking System (v2.24.0)

- **Commands**: `svn.lock`, `svn.unlock`, `svn.breakLock`
- **Parser**: `lockParser.ts` extracts lock info from `svn info --xml`
- **Types**: `ISvnLockInfo`, `ILockOptions`, `IUnlockOptions`
- **API Layer**: `Repository.lock()`, `Repository.unlock()`, `Repository.getLockInfo()`
- **UI**: Lock status in tooltips (🔒), Explorer context menu integration
- **Directory Support**: Locks can be applied to both files and directories

---

### Sparse Checkout Manager (v2.25.0)

- **Tree View**: `sparseCheckout` in SCM sidebar
- **Provider**: `sparseCheckoutProvider.ts` (~310 lines)
- **Node**: `sparseItemNode.ts` for tree items
- **Types**: `ISparseItem`, `SparseDepthKey`
- **Features**:
  - Shows local items with depth labels (Full, Shallow, Files Only, Empty)
  - Shows ghost items (not checked out) with cloud icon
  - Lazy-loads children on expand via `svn list`
  - Checkout command for ghost items (pick depth)
  - Exclude command for local items
- **Commands**: `svn.sparse.refresh`, `svn.sparse.checkout`, `svn.sparse.exclude`

---

### Scoped Status Fetching (v2.26.4)

- **Method**: `svnRepository.getScopedStatus(path, depth)`
- **Purpose**: Targeted status queries for large repos (100k+ files)
- **Benefits**:
  - Avoids full repo status XML parsing
  - Respects `svn.performance.maxXmlTags` limits
  - Enables folder-specific status updates
- **Depth Options**: empty, files, immediates, infinity
- **Use Cases**:
  - Sparse checkout folder depth queries
  - Incremental status updates after file changes
  - Large repository support

---

**Version**: 3.22
**Updated**: 2025-11-30 (v2.26.4)
