# SVN Extension Architecture

**Version**: 2.17.114
**Updated**: 2025-11-12

---

## Executive Summary

Mature VS Code extension for SVN integration. Event-driven architecture, decorator-based commands, multi-repository management.

**Stats**:
- **Source lines**: ~12,400
- **Repository**: 923 lines (22% reduction via 3 extracted services)
- **Commands**: 50+ (27 refactored, 150 lines removed via factory pattern)
- **Coverage**: ~50-55% (856 tests, +12 from Phases 18-19) ✅ TARGET REACHED
- **Stability**: 🟡 1/4 P0 bugs fixed ✅, 3 remain (races, crashes, leaks)
- **Performance**: ✅ P0 resolved. 3 P1 bottlenecks identified
- **Security**: 🔴 67 sanitization gaps, unsafe JSON.parse

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

## Critical Issues (P0) 🔴

### Stability Bugs
**A. Watcher crash** ✅ FIXED (v2.17.114)
- Changed: `throw error` → graceful logging
- 1-5% users protected
- +3 tests

**B. Global state data race** (`decorators.ts:119`, `repository.ts:469`)
- Shared `_seqList` object across all repo instances
- 30-40% users (multi-repo data corruption)
- `@globalSequentialize("updateModelState")` uses same queue for all repos
- Fix: 2-3h

**C. Unsafe JSON.parse** (`repository.ts:808,819`)
- Credential parsing without try-catch
- 5-10% users (malformed secrets crash extension)
- Fix: 1h

### Security Bugs
**D. Sanitization gaps** (77 catch blocks, only 10 sanitize calls)
- 67 catch blocks missing sanitization
- 100% users on error paths (credential disclosure)
- Fix: 4-7h (extract error utility, apply to all catches)

---

## Performance Analysis

### P0 Issues - Resolved ✅
- ✅ **UI blocking**: FIXED (v2.17.108-109)
- ✅ **Memory leak**: FIXED (v2.17.107)
- ✅ **Remote polling**: FIXED (v2.17.107)

### P1 Issues
**A. Quadratic descendant** (`StatusService.ts:217-223`): 50-70% users, 100-500ms, 1-2h
**B. Glob matching** (`StatusService.ts:292,350-358`): 30-40% users, 10-50ms, 2-3h
**C. Batch ops** (`svnRepository.ts:615-618`): 20-30% users, 50-200ms, 2-3h

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
- 138 → 856 tests (+718, +520%)
- 21-23% → 50-55% coverage ✅ TARGET
- Phase 18-19: +12 tests (UI blocking, memory, polling)

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

**P0 (Phase 20)**: Stability & security - CRITICAL (8-12h, MUST FIX FIRST)
**P1 (Phase 21)**: Performance optimization (5-8h)
**P2/P3**: Code quality, type safety, architecture (110-155h)

See IMPLEMENTATION_PLAN.md for details.

---

**Version**: 3.4
**Updated**: 2025-11-12 (v2.17.114)
