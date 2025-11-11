# SVN Extension Architecture

**Version**: 2.17.61
**Updated**: 2025-11-11

---

## Executive Summary

Mature VS Code extension for SVN integration. Event-driven architecture, decorator-based commands, multi-repository management.

**Stats**:
- **Source lines**: ~12,200
- **Repository**: 1,179 → 923 lines (22% reduction, 3 services extracted)
- **Commands**: 50+ (5 refactored, 82 lines removed)
- **Coverage**: ~21-23% (118 tests)
- **Performance**: ✅ Phase 8+9+10 COMPLETE (22 bottlenecks fixed, 100% users)

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

## Recent Improvements (Phase 10 & 11) ✅

### Performance Fixes (Phase 10, v2.17.58-61)
- **processConcurrently import** ✅ Fixed regression (45% users)
- **Command cache** ✅ Cached SourceControlManager (100% users, -10ms per command)
- **updateInfo() cache** ✅ Timestamp-based 5s cache (30% users, 90% reduction)

### Code Quality (Phase 11, v2.17.58)
- **82 lines removed** from 5 commands (50% size reduction)
- **3 helpers added**: executeOnResources, handleRepositoryOperation, executeRevert
- **Single source of truth** for command patterns

### Remaining Technical Debt

**Architecture Debt** (Deferred):
- **God classes**: repository.ts (923) + svnRepository.ts (970) = 1,893 lines
- **Missing AuthService**: Auth logic scattered (70 lines)
- **Command base ISP**: 50+ commands inherit unused methods (492 lines)

**Low Priority**:
- show()/showBuffer() duplication (35 lines)
- Redundant null checks (30 lines)
- @sequentialize blocks concurrent requests (20% users)

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

**Version**: 1.9
**Updated**: 2025-11-11 (v2.17.61)
