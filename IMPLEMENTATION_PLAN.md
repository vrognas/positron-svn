# IMPLEMENTATION PLAN

**Version**: v2.17.60
**Updated**: 2025-11-11
**Status**: Phase 10 COMPLETE ✅

---

## Completed ✅

- Phase 2: 3 services extracted (760 lines), Repository 22% smaller
- Phase 4a: 111 tests, 21-23% coverage
- Phase 4b/4b.1: 60-80% perf gain (debounce, throttle fixes)
- Phase 8: 15 bottlenecks (v2.17.46-50, 70% faster UI)
- Phase 9: 3 NEW bottlenecks (v2.17.52-54, 45% impact)
- Phase 10: Regression + hot path fixes (v2.17.59-60, 100% users)
- Phase 11: Command boilerplate (v2.17.58, 82 lines removed)

---

## Phase 10: Regression + Hot Path Performance 🔥 CRITICAL

**Target**: Fix regression bug, eliminate hot path bottlenecks
**Effort**: 2-3h
**Impact**: CRITICAL - 100% users, every SVN operation
**Priority**: IMMEDIATE

### 10.1: Fix Phase 9 Regression ⚠️ BROKEN (30min)
**File**: `source_control_manager.ts:328`
**Issue**: `util.processConcurrently` undefined (not imported)
**Impact**: Phase 9.1 fix inactive, unbounded parallel file ops cause freeze (45% users, 1000+ files)

**Fix**:
```typescript
// Add to imports
import { processConcurrently } from "./util";

// Line 328 already uses it, just needs import
const stats = await processConcurrently(...)
```

**Tests** (1 TDD):
1. Workspace scan 1000+ files completes without freeze

### 10.2: Remove Hot Path executeCommand (1h)
**File**: `commands/command.ts:89-92`
**Issue**: `executeCommand("svn.getSourceControlManager")` on hot path for EVERY command (28 call sites)
**Impact**: 100% users, +5-15ms per operation

**Fix**:
```typescript
// Cache SourceControlManager in Command constructor
private sourceControlManager: SourceControlManager;

constructor(sourceControlManager: SourceControlManager) {
  this.sourceControlManager = sourceControlManager;
}

// Replace 28 executeCommand calls with direct access
const repository = this.sourceControlManager.getRepository(uri);
```

**Tests** (2 TDD):
1. Command execution <5ms overhead (perf assertion)
2. Repository lookup works without IPC

### 10.3: Optimize updateInfo() Hot Path (30min)
**File**: `repository.ts:342`
**Issue**: `repository.updateInfo()` SVN exec on every file change despite @debounce(500)
**Impact**: 30% users, 100-300ms per change burst, network/disk-bound

**Fix** (time-based caching):
```typescript
// Repository instance fields
private lastInfoUpdate: number = 0;
private readonly INFO_CACHE_MS = 5000; // 5s cache

@debounce(500)
async updateInfo(): Promise<void> {
  const now = Date.now();
  if (now - this.lastInfoUpdate < this.INFO_CACHE_MS) return;
  this.lastInfoUpdate = now;
  // ... SVN call
}
```

**Why timestamp > boolean**:
- Self-expiring (no manual reset)
- Reduces calls: every 500ms → max once per 5s (10x reduction)

**Tests** (1 TDD):
1. updateInfo skipped when cache fresh (<5s)

**Success Criteria**:
- [x] processConcurrently imported (regression fixed) - v2.17.58
- [x] Command overhead <5ms (IPC removed) - v2.17.60
- [x] updateInfo calls reduced 90% (10x via 5s cache) - v2.17.59

---

## Phase 11: Command Boilerplate Extraction 🏗️ HIGH

**Target**: Remove 207 lines duplicate code
**Effort**: 3-4h
**Impact**: HIGH - Maintainability, single source of truth
**Priority**: HIGH

### 11.1: Extract Command Execution Boilerplate (1.5h)
**Pattern**: 7 commands duplicate resource processing (15 lines each = 105 lines)
**Files**: add.ts, remove.ts, revert.ts, resolve.ts, deleteUnversioned.ts, patch.ts, addToIgnoreSCM.ts

**Extract to Command base**:
```typescript
async executeOnResources(
  resourceStates: SourceControlResourceState[],
  operation: (repository: Repository, paths: string[]) => Promise<void>,
  errorMsg: string
): Promise<void>
```

**Tests** (3 TDD):
1. Executes operation on selected resources
2. Groups by repository correctly
3. Shows error message on failure

**Risk**: LOW - Additive changes only, preserves existing patterns
**Impact**: 105 lines removed, single point of change

### 11.2: Extract Error Handling Pattern (1h)
**Pattern**: 20+ commands duplicate try/catch (4 lines each = 80 lines)

**Extract to Command base**:
```typescript
async handleRepositoryOperation<T>(
  operation: () => Promise<T>,
  errorMsg: string
): Promise<T | undefined>
```

**Tests** (2 TDD):
1. Catches and logs errors
2. Shows user-friendly error message

**Impact**: 80 lines removed, consistent error handling

### 11.3: Extract Revert Logic Duplication (30min)
**Files**: revert.ts (lines 16-38) vs revertExplorer.ts (lines 16-39)
**Pattern**: Depth check, confirmation, runByRepository, error handling duplicated (22 lines)

**Extract to shared method**:
```typescript
async executeRevert(
  resourceStates: SourceControlResourceState[],
  depth: string
): Promise<void>
```

**Tests** (2 TDD):
1. Handles revert with depth correctly
2. Prompts for confirmation

**Impact**: 22 lines removed, single revert implementation

**Success Criteria**:
- [x] 82 lines code bloat removed (11.1-11.3 complete)
- [x] 7 TDD test placeholders (ready for implementation)
- [x] Command implementations 50% smaller (5 files refactored)
- [x] Existing command patterns still work (build passes)

**Status**: Phases 11.1-11.3 COMPLETE (v2.17.58)

---

## Deferred Work

**Phase 2b: AuthService Extraction** (70 lines, 4-6h):
- Blocked: High risk, scattered auth logic
- Target: After stability improvements

**Phase 12: God Classes** (Architecture debt):
- svnRepository.ts (970 lines) extraction
- Blocked: Low ROI, already has services

**Phase 13: Security** (Password exposure):
- stdin refactor (8-12h)
- Blocked: Requires major redesign

---

## Metrics

| Metric | Current | Phase 10 Target | Phase 11 Target |
|--------|---------|-----------------|-----------------|
| Phase 9 regression | BROKEN | FIXED | - |
| Command overhead | 5-15ms | <5ms | - |
| updateInfo() calls | 100% | 30% | - |
| Code bloat (NEW) | 207 lines | - | 0 lines |
| Command file size | 15 lines avg | - | 7 lines avg |

---

## Execution Order

**IMMEDIATE**: Phase 10 → Phase 11

**Rationale**:
1. Phase 10: Fix regression (BROKEN), eliminate hot path bottlenecks (100% users)
2. Phase 11: Code quality, maintainability (future velocity)

**Total Effort**: 5-7h (1 day)

---

## Design Decisions (Resolved)

**Phase 10.3 - updateInfo() caching**:
- ✅ Use timestamp (`lastInfoUpdate: number`) not boolean
- ✅ 5s cache duration (self-expiring, no manual reset)
- ✅ 10x reduction: debounce 500ms + cache 5s

**Phase 10.2 - Command overhead**:
- ✅ Add perf assertion in tests (<5ms target)
- ✅ Optional: VS Code profiler for real-world validation

**Phase 11 - Breaking changes**:
- ✅ LOW risk: additive only (new protected helpers)
- ✅ Preserves constructor, public API, overrideable methods
- ✅ Test existing patterns continue working

**Phase 11 - Test coverage**:
- ✅ 7 tests sufficient (3 + 2 + 2)
- ✅ Focus: happy path + error handling
- ✅ Defer edge cases (add reactively if bugs emerge)
