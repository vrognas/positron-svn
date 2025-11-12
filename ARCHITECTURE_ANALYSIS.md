# SVN Extension Architecture

**Version**: 2.17.103
**Updated**: 2025-11-12

---

## Executive Summary

Mature VS Code extension for SVN integration. Event-driven architecture, decorator-based commands, multi-repository management.

**Stats**:
- **Source lines**: ~12,400
- **Repository**: 1,179 → 923 lines (22% reduction, 3 services extracted)
- **Commands**: 50+ (27 refactored, 150 lines removed via factory pattern)
- **Coverage**: ~50-55% (844 tests, +638 command tests) ✅ TARGET REACHED
- **Performance**: ✅ Phases 8-10+12+14-16 COMPLETE (25 bottlenecks fixed, 1 bug)
- **Security**: ✅ Phase 17A+stderr sanitization (M-1 critical fix, information disclosure prevented)

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

## Recent Improvements (Phases 10-16) ✅

### Performance (Phases 10+12+15+16, v2.17.58-91)
- **processConcurrently import** ✅ Fixed regression (45% users)
- **Command cache** ✅ Cached SourceControlManager (100% users, -10ms per command)
- **updateInfo() cache** ✅ Timestamp 5s cache (30% users, 90% reduction)
- **updateModelState cache** ✅ Timestamp 2s cache (50% users, 60-80% burst reduction)
- **Decorator overhead** ✅ Removed @throttle (50-100% users, 1-2ms → <0.5ms)
- **Conditional index rebuild** ✅ Hash-based detection (50-80% users, 5-15ms eliminated)

### Code Quality (Phases 11+13, v2.17.58+64)
- **127 lines removed** from 22 commands (Phase 11: 82, Phase 13: 45)
- **5 helpers added**: executeOnResources, handleRepositoryOperation, executeRevert, getResourceStatesOrExit
- **17 commands** using error helpers (up from 3)
- **Single source of truth** for command patterns

### Bug Fixes (Phase 14, v2.17.67)
- **Async deletion bug** ✅ Added await to deleteDirectory() (40-50% users, DATA LOSS fix)

### Technical Debt

**Deferred (Low ROI)**:
- God classes: repository.ts (923) + svnRepository.ts (970) (diminishing returns)
- Missing AuthService: Auth logic scattered (HIGH risk to extract)
- Test coverage: 21-23% → 50%+ (20-30h effort)

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

See IMPLEMENTATION_PLAN.md (Deferred):
- **Phase 2b**: AuthService extraction (70 lines, 4-6h, HIGH risk)
- **Phase 12**: God classes refactoring (LOW ROI)

---

**Version**: 1.23
**Updated**: 2025-11-12 (v2.17.101)
