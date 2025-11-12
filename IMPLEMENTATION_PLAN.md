# IMPLEMENTATION PLAN

**Version**: v2.17.114
**Updated**: 2025-11-12
**Status**: Phase 20 in progress (1/4 bugs fixed ✅). 3 CRITICAL P0 bugs remain.

---

## Phase 20: P0 Stability & Security 🔴 CRITICAL

**Target**: v2.17.114-117
**Effort**: 8-12h
**Impact**: Crashes eliminated, data races fixed, credential leaks prevented

### Critical Bugs

**A. Watcher crash kills extension** ✅ FIXED (v2.17.114)
- Location: `repositoryFilesWatcher.ts:59-67`
- Issue: Uncaught error thrown → crashes extension
- Fix: Graceful error logging, extension continues
- Impact: 1-5% users protected (ENOENT, EACCES errors)
- Tests: +3 tests verify stability

**B. Global state data race** (P0 - CRITICAL)
- Location: `decorators.ts:119`, used in `repository.ts:469`
- Issue: Shared `_seqList` object across all repo instances
```typescript
const _seqList: { [key: string]: any } = {};  // ❌ Global!
@globalSequentialize("updateModelState")  // All repos share queue
```
- Impact: 30-40% users (multi-repo data corruption, race conditions)
- Fix: Instance-level sequentialization or per-repo keys
- Effort: 2-3h

**C. Unsafe JSON.parse** (P0 - SECURITY)
- Location: `repository.ts:808,819`
- Issue: Credential parsing without try-catch
```typescript
const credentials = JSON.parse(secret);  // ❌ Crashes on corruption
```
- Impact: 5-10% users (malformed secrets crash extension)
- Fix: Wrap in try-catch, validate schema
- Effort: 1h

**D. Sanitization gaps** (P0 - SECURITY)
- Coverage: 10 sanitize calls vs 77 catch blocks (67 gaps!)
- Issue: Error messages leak credentials in 30+ files
- Impact: 100% users on error paths (credential disclosure)
- Fix: Extract error handler utility, apply to all catch blocks
- Effort: 4-7h

### Metrics

| Issue | Users | Severity | Effort |
|-------|-------|----------|--------|
| Watcher crash | 1-5% | Extension kill | 1h |
| Global state race | 30-40% | Data corruption | 2-3h |
| Unsafe JSON.parse | 5-10% | Extension crash | 1h |
| Sanitization gaps | 100% | Credential leak | 4-7h |

---

## Phase 21: P1 Performance Optimization ⚡

**Target**: v2.17.118-120
**Effort**: 5-8h
**Impact**: 50-70% users, 2-5x faster status updates

### Bottlenecks

**A. Quadratic descendant resolution** (P1)
- Location: `StatusService.ts:217-223`
- Issue: O(n*m) nested loop (100-500ms on 1000+ files)
- Impact: 50-70% users
- Fix: Build descendant set once, single iteration
- Effort: 1-2h

**B. Glob pattern matching** (P1)
- Location: `StatusService.ts:292,350-358`
- Issue: Per-item `matchAll()` calls (10-50ms on 500+ files)
- Impact: 30-40% users
- Fix: Pre-filter simple patterns, two-tier matching
- Effort: 2-3h

**C. Batch operations** (P1)
- Location: `svnRepository.ts:615-618`
- Issue: No chunking for bulk ops (50-200ms overhead)
- Impact: 20-30% users
- Fix: Batch SVN commands (50 files/chunk)
- Effort: 2-3h

### Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Status update (1000 files) | 100-500ms | 20-100ms |
| Glob filtering (500 files) | 10-50ms | 3-15ms |
| Bulk add (100 files) | 50-200ms | 20-80ms |

---

## Completed Phases ✅

**Phase 18 (v2.17.108-109)**: UI Performance
- Non-blocking progress (ProgressLocation.Notification)
- CancellationToken support
- Impact: UI freezes eliminated (2-5s → 0s)

**Phase 19 (v2.17.106-107)**: Memory + Security
- Info cache LRU (500 entry limit)
- esbuild update (vuln fix)
- Smart remote polling (95% faster)
- Impact: Memory stable (<50MB vs 100-500MB/8h)

---

## Future Opportunities (P2/P3)

**Code Quality** (12-15h):
- show/showBuffer duplication (139 lines, 90% identical)
- util.ts split (336 lines → 3 modules)
- Optional chaining (48 occurrences)

**Type Safety** (80-120h):
- 248 `any` types across 25 files
- Decorator type definitions
- Error type guards

**Architecture** (16-20h):
- Extract FileOperationsService
- Extract DiffService
- Repository god class (923L → 550L)

---

## Summary

**P0 (Phase 20)**: 8-12h effort, CRITICAL (crashes, races, leaks)
**P1 (Phase 21)**: 5-8h effort, high user impact (performance)
**P2/P3**: 110-155h effort, lower priority

**Next action**: Phase 20 (Stability & Security) - MUST FIX FIRST
