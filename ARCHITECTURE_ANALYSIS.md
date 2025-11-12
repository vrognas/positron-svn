# SVN Extension Architecture

**Version**: 2.17.107
**Updated**: 2025-11-12

---

## Executive Summary

Mature VS Code extension for SVN integration. Event-driven architecture, decorator-based commands, multi-repository management.

**Stats**:
- **Source lines**: ~12,400
- **Repository**: 923 lines (22% reduction via 3 extracted services)
- **Commands**: 50+ (27 refactored, 150 lines removed via factory pattern)
- **Coverage**: ~50-55% (844 tests) ✅ TARGET REACHED
- **Performance**: ✅ 25 bottlenecks fixed, but P0 issues remain (UI freezes, memory leaks)
- **Security**: ✅ Stderr sanitization complete, esbuild vuln pending

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

**Services** (3 extracted):
- **StatusService** (355 lines): Model state updates
- **ResourceGroupManager** (298 lines): VS Code resource groups
- **RemoteChangeService** (107 lines): Polling timers

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

## Critical Issues (See IMPLEMENTATION_PLAN.md)

### Performance (P0)
- **UI blocking**: 50-100% users, 2-5s freezes during status/refresh
- **Memory leak**: ✅ FIXED - Info cache now LRU with 500 entry limit
- **Remote polling**: Full `svn stat` every 5min on network repos

### Security (P0)
- **esbuild 0.24.2**: GHSA-67mh-4wv8-2f99 (CORS bypass)

### Code Quality (P1)
- **248 `any` types**: Type safety compromised across 25 files
- **Dead code**: util.ts, svnRepository.ts (pathEquals, countNewCommit, etc.)
- **Duplication**: show/showBuffer (139 lines 90% identical), 8 plain log methods

---

## Completed Improvements ✅

### Performance (Phases 8-16)
- Config cache, decorator removal, conditional index rebuild
- 60-80% burst reduction, 5-15ms savings per operation
- 25 bottlenecks fixed (but P0 issues remain)

### Code Quality
- 150 lines removed via helpers + factory pattern
- 3 services extracted (760 lines)
- Repository.ts: 1,179 → 923 lines (22% reduction)

### Security
- Stderr sanitization (M-1 critical fix, credential disclosure prevented)

### Testing
- 138 → 844 tests (+706, +512%)
- 21-23% → 50-55% coverage ✅ TARGET

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

**Entry**: extension.ts, source_control_manager.ts, commands.ts
**Core**: repository.ts, svnRepository.ts, svn.ts
**Services**: statusService.ts, resourceGroupManager.ts, remoteChangeService.ts
**Commands**: command.ts (base), commands/*.ts (50+)
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

See IMPLEMENTATION_PLAN.md for detailed plans:
- **Phase 18**: UI Performance - Non-blocking operations (4-6h, CRITICAL)
- **Phase 19**: Memory + Security fixes (2-3h, CRITICAL)

---

**Version**: 2.0
**Updated**: 2025-11-12 (v2.17.104)
