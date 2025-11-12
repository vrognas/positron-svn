# IMPLEMENTATION PLAN

**Version**: v2.17.116
**Updated**: 2025-11-12
**Status**: Phase 20 active (1/4 bugs fixed ✅). Phase 21 validated w/ new finding.

---

## Phase 20: P0 Stability & Security 🔴 CRITICAL

**Target**: v2.17.115-118
**Effort**: 8-12h
**Impact**: Crashes eliminated, data races fixed, credential leaks prevented

### Critical Bugs

**A. Watcher crash** ✅ FIXED (v2.17.114)
- `repositoryFilesWatcher.ts:59-67`: Uncaught error → extension crash
- Fix: Graceful logging
- Impact: 1-5% users

**B. Global state data race** (P0 - CRITICAL)
- `decorators.ts:119`, `repository.ts:469`: Shared `_seqList` across all repos
- Impact: 30-40% users (multi-repo corruption, perf degradation)
- Fix: Per-repo keys (append repo path to key: `_seqList["updateModelState:/path"]`)
  - Why: Less invasive than instance-level, keeps decorator pattern
  - Implementation: Modify decorator to accept repo identifier param
- Effort: 2-3h

**C. Unsafe JSON.parse** (P0 - SECURITY)
- `repository.ts:808,819`, `uri.ts:11`: No try-catch on credential parsing
- Impact: 5-10% users (crash on malformed secrets)
- Effort: 1h

**D. Sanitization gaps** (P0 - SECURITY)
- 43 catch blocks vs 6 sanitize calls (86% gap)
- Impact: 100% users (credential disclosure on errors)
- Effort: 4-7h

| Issue | Users | Severity | Effort |
|-------|-------|----------|--------|
| Watcher crash | 1-5% | Extension kill | DONE |
| Global state race | 30-40% | Data corruption | 2-3h |
| Unsafe JSON.parse | 5-10% | Crash | 1h |
| Sanitization gaps | 100% | Credential leak | 4-7h |

---

## Phase 21: P1 Performance Optimization ⚡

**Target**: v2.17.119-122
**Effort**: 7-11h
**Impact**: 50-100% users, 2-10x faster operations

### Bottlenecks

**A. Commit parent traversal** (P1 - NEW FINDING)
- `commit.ts:38-48`: O(n×d) getResourceFromFile in while loop
- Impact: 80-100% users (every commit operation)
- Current: 20-100ms on deep trees
- Fix: Cache parent lookups or flat map
- Effort: 1-2h

**B. Quadratic descendant resolution** (P1)
- `StatusService.ts:217-223`: O(e×n) nested loop despite "fix" comment
- Impact: 50-70% users (externals + 1000+ files)
- Current: 100-500ms
- Fix: Build descendant set once
- Effort: 1-2h

**C. Glob pattern matching** (P1)
- `StatusService.ts:292,350-358`: Per-file matchAll() calls
- Impact: 30-40% users (exclusion patterns + 500+ files)
- Current: 10-50ms
- Fix: Two-tier matching (simple first)
- Effort: 2-3h

**D. Batch operations** (P1)
- `svnRepository.ts:615-618`: No chunking for bulk add/revert
- Impact: 20-30% users (100+ file operations)
- Current: 50-200ms overhead
- Fix: Adaptive batching strategy
  - <50 files: single batch (no overhead)
  - 50-500 files: 50 files/chunk (balance overhead vs feedback)
  - 500+ files: 100 files/chunk (reduce total overhead)
  - Why: Adaptive sizing optimizes for common cases
- Effort: 2-3h

| Bottleneck | Users | Current | Target | Effort |
|------------|-------|---------|--------|--------|
| Commit traversal | 80-100% | 20-100ms | 5-20ms | 1-2h |
| Descendant resolution | 50-70% | 100-500ms | 20-100ms | 1-2h |
| Glob matching | 30-40% | 10-50ms | 3-15ms | 2-3h |
| Batch ops | 20-30% | 50-200ms | 20-80ms | 2-3h |

---

## Summary

**Phase 20**: 8-12h, CRITICAL (stability/security)
**Phase 21**: 7-11h, HIGH (performance, 80-100% users affected)
**Total**: 15-23h for complete P0/P1 resolution

**Next action**: Phase 20-B (global state race) - 2-3h

---

## Implementation Decisions

**Global state race fix (20-B)**:
- Strategy: Per-repo keys vs instance-level
- Decision: Per-repo keys (append repo path: `_seqList["op:/path"]`)
- Rationale: Less invasive, preserves decorator pattern, matches 2-3h estimate
- Alternative rejected: Instance-level requires full decorator removal (6-8h)

**Batch operations (21-D)**:
- Strategy: Fixed vs adaptive chunk size
- Decision: Adaptive (50→100 files based on total count)
- Rationale: Optimizes for common case (<50: no split), scales for bulk ops
- Thresholds: <50 (single), 50-500 (50/chunk), 500+ (100/chunk)

**Commit traversal fix (21-A)**:
- Strategy: Cache lookups vs flat map
- Decision: Build flat resource map once at command start
- Rationale: O(n) prebuild + O(1) lookups vs O(n×d) repeated calls
- Impact: 20-100ms → 5-20ms (4-5x improvement)
