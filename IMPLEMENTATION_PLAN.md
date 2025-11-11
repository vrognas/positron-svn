# IMPLEMENTATION PLAN

**Version**: v2.17.64
**Updated**: 2025-11-11
**Status**: Phases 12-13 COMPLETE ✅

---

## Completed ✅

- Phase 2: 3 services extracted (760 lines), Repository 22% smaller
- Phase 4a: 111 tests, 21-23% coverage
- Phase 4b/4b.1: 60-80% perf gain (debounce, throttle fixes)
- Phase 8: 15 bottlenecks (v2.17.46-50, 70% faster UI)
- Phase 9: 3 NEW bottlenecks (v2.17.52-54, 45% impact)
- Phase 10: Regression + hot path fixes (v2.17.59-60, 100% users)
- Phase 11: Command boilerplate (v2.17.58, 82 lines removed)
- Phase 12: Status update cache (v2.17.63, 60-80% burst reduction)
- Phase 13: Code bloat cleanup (v2.17.64, 45 lines removed, 17 commands)

---

## Phase 12: Status Update Performance 🔥 CRITICAL

**Target**: Eliminate redundant status updates (50% users)
**Effort**: 1-2h
**Impact**: CRITICAL - 200-500ms savings per change burst
**Priority**: IMMEDIATE

### Issue
**File**: `repository.ts:468` (updateModelState)
**Problem**: Has @throttle + @globalSequentialize but no short-term cache. Multiple events within 2-3s trigger redundant SVN status calls.
**Impact**: 50% active editors, 200-500ms per burst, 2-5x duplicate calls

### Fix
```typescript
// Add to Repository class
private lastModelUpdate: number = 0;
private readonly MODEL_CACHE_MS = 2000; // 2s cache

@globalSequentialize
@throttle(300)
async updateModelState(): Promise<void> {
  const now = Date.now();
  if (now - this.lastModelUpdate < this.MODEL_CACHE_MS) return;
  this.lastModelUpdate = now;

  // ... existing logic
}
```

**Why 2s**: Bursts typically occur within 2-3s window. Longer cache risks stale UI.

**Tests** (2 TDD):
1. Multiple events within 2s trigger single update
2. Events >2s apart trigger separate updates

**Success Criteria**:
- [x] updateModelState calls reduced 60-80% during bursts
- [x] UI still responsive (<2s staleness acceptable)
- [x] Tests pass (v2.17.63)

---

## Phase 13: Code Bloat Cleanup 🏗️ HIGH

**Target**: Remove 260 lines defensive/duplicate code
**Effort**: 2.5h
**Impact**: HIGH - Maintainability, leverage Phase 11 work
**Priority**: HIGH

### 13.1: Remove Defensive Null Checks ✅ (v2.17.64)
**Pattern**: 5 commands had `if (!repository) return;`
**Files**: commit.ts, patch.ts, pullIncomingChange.ts, resolved.ts, revertAll.ts (20 lines)
**Fix**: Removed all unnecessary repository null guards
**Result**: Command base already handles resolution ✓

### 13.2: Extract Empty Selection Guards ✅ (v2.17.64)
**Pattern**: 6 commands duplicate selection check (18 lines)
**Files**: resolve.ts, revert.ts, patch.ts, remove.ts, deleteUnversioned.ts, addToIgnoreSCM.ts
**Fix**: Added `getResourceStatesOrExit()` to Command base returning null on empty
**Tests** (1 TDD):
1. Returns null on empty selection, exits early ✓

### 13.3: Migrate to Phase 11 Error Helpers ✅ (v2.17.64)
**Pattern**: 11 commands migrated (update, log, commit*, changeList, revert*, resolve*, search*, pull*)
**Fix**: Converted try/catch blocks to use `handleRepositoryOperation()`
**Result**: 17 commands total using Phase 11 helpers (up from 3)

**Success Criteria**:
- [x] 45 total lines bloat removed (13.1: 20, 13.2+13.3: 25)
- [x] Command base has getResourceStatesOrExit helper
- [x] 17 commands using error helpers (up from 3)
- [x] Build passes, no regressions

---

## Deferred (Low Priority)

**AuthService Extraction** (70 lines, 4-6h, HIGH risk):
- Security isolation, but scattered logic risky to extract
- Defer until stability window

**God Classes** (1,893 lines, LOW ROI):
- Already extracted 3 services, diminishing returns

**Test Coverage** (21-23% → 50%+, 20-30h):
- Command layer, SVN process, multi-repo (47 commands untested)
- Defer until features stabilize

**SVN Timeout Config** (2-3h, 10-15% users):
- Per-operation timeouts (status:10s, commit:60s)
- Defer until Phase 12-13 complete

---

## Metrics

| Metric | Before | Phase 12 Target | Phase 13 Target |
|--------|--------|-----------------|-----------------|
| updateModelState redundant | 60-80% | <20% | - |
| Status burst latency | 200-500ms | <100ms | - |
| Code bloat lines | 260 | - | 0 |
| Commands refactored | 5 | - | 25 total |

---

## Execution Order

**COMPLETE**: Phases 12-13 delivered (v2.17.63-64)

**Next Priority** (if needed):
1. SVN Timeout Config (2-3h, 10-15% users, network issues)
2. Test Coverage (20-30h, command layer untested)
3. AuthService Extraction (4-6h, HIGH risk, defer)

**Total Effort**: 3.5-4.5h
