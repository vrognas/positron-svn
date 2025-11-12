# IMPLEMENTATION PLAN

**Version**: v2.17.104
**Updated**: 2025-11-12
**Status**: Critical performance/security phases identified

---

## Phase 18: UI Performance - Non-Blocking Operations ⚡ CRITICAL

**Impact**: 50-100% users, 2-5s UI freezes eliminated
**Effort**: 4-6h
**Risk**: MEDIUM (async refactor of critical path)
**Priority**: P0 - Highest user impact

### Problem
Blocking SVN operations freeze UI during:
- File saves (status update)
- Branch switches (full repo scan)
- Remote checks (5min poll)
- Manual refresh

**Root cause**: `await repository.getStatus()` + `svn stat --xml --show-updates` runs serially, blocks main thread.

**User impact**: Editor unresponsive 2-5s per operation, 50-100% users affected.

### Implementation
1. Convert `run()` to non-blocking: use ProgressLocation.Notification
2. Add cancellation tokens to long ops (status, update, log)
3. Implement background queue for status updates
4. Add "Cancel" button to progress UI
5. Defer non-critical updates (decorations, counts)

### Success Metrics
- UI freeze <100ms (down from 2-5s)
- Operations cancellable within 500ms
- Background queue handles burst events

### Tests
- Status update doesn't block typing (integration)
- Cancel interrupts long operation (unit)
- Queue batches rapid events (unit)

---

## Phase 19: Memory + Security Fixes 🔒 CRITICAL

**Impact**: Memory leak (20-30% users, 100-500MB growth) + Security vuln
**Effort**: 2-3h
**Risk**: LOW (isolated fixes)
**Priority**: P0 - Security + stability

### Problems
1. **Info cache unbounded**: `_infoCache` Map grows indefinitely, no LRU eviction
2. **Security**: esbuild 0.24.2 has GHSA-67mh-4wv8-2f99 (CORS bypass)
3. **Remote polling waste**: Full `svn stat` every 5min on network repos

### Implementation
**A. Info cache LRU (1h)**
- Add max size 500 entries
- Track access time, evict LRU
- Location: `svnRepository.ts:43-236`

**B. Update dependencies (30min)**
- esbuild 0.24.2 → latest (>0.24.2)
- Verify no breaking changes

**C. Smart remote polling (1h)**
- Use `svn log -r BASE:HEAD --limit 1` before full status
- Early exit if no new revisions
- Location: `remoteChangeService.ts:89-92`, `repository.ts:407-419`

### Success Metrics
- Memory stable after 8h session (<50MB growth)
- Security scan passes
- Remote polls 95% faster (no changes case)

### Tests
- Cache evicts LRU entries (unit)
- Remote poll skips status when no changes (integration)
- Dependency audit passes (CI)

---

## Metrics

| Metric | Before | Phase 18 | Phase 19 |
|--------|--------|----------|----------|
| UI freeze | 2-5s | <100ms | <100ms |
| Memory growth (8h) | 100-500MB | N/A | <50MB |
| Remote poll waste | 100% | N/A | 5% |
| Security vulns | 1 | 1 | 0 |

---

## Unresolved

- SVN concurrency limits?
- Worker threads for status parsing?
- Progressive status updates (show partial)?
