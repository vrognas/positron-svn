# IMPLEMENTATION PLAN

**Version**: v2.17.51
**Updated**: 2025-11-11
**Status**: Phase 8 ✅ | Next: Phase 9 → Phase 2b

---

## Completed

- Phase 2: 3 services extracted (760 lines), Repository 22% smaller
- Phase 4a: 111 tests, 21-23% coverage
- Phase 4b/4b.1: 60-80% perf gain (debounce, throttle fixes)
- Phase 8: 15 performance bottlenecks ✅ (v2.17.46-50, 70% faster UI)

---

## Phase 9: NEW Performance Bottlenecks ⚡ CRITICAL

**Target**: Fix 3 NEW bottlenecks, 45% user impact
**Effort**: 4-6h
**Impact**: CRITICAL - Extension freeze during activation
**Priority**: HIGHEST

### Bottleneck 1: Unbounded Parallel File Ops (CRITICAL)
**File**: `source_control_manager.ts:326-342`
**Issue**: `Promise.all()` spawns unlimited concurrent `stat()` calls during workspace scan. 1000+ files = 1000+ concurrent ops, file descriptor exhaustion.
**Impact**: 45% users - Extension freeze during activation, system load spike
**Fix**: Concurrency queue (pQueue), limit 8-16 parallel ops
**Effort**: 2-3h

### Bottleneck 2: Uncached Remote Changes Config
**File**: `repository.ts:402-417`
**Issue**: `remoteChanges.checkFrequency` config uncached, 5+ lookups per branch/merge + periodic polling
**Impact**: 12% users - Config lookup overhead during branch/merge
**Fix**: Extend `_configCache` to include `remoteChangesCheckFrequency`
**Effort**: 30min

### Bottleneck 3: Expensive Repo Lookup
**File**: `source_control_manager.ts:415-436`
**Issue**: `getRepositoryFromUri()` sequentially calls `repository.info()` (SVN command) on each repo until match. 5+ repos = 5+ network-bound SVN commands.
**Impact**: 8% users - UI lag during changelist ops on slow networks
**Fix**: Extend excludedPathsCache to include all repo paths, skip info() call
**Effort**: 1-2h

**Success Criteria**:
- [ ] Workspace scan with 1000+ files completes without freeze
- [ ] Config lookups cached (zero repeated calls)
- [ ] Changelist ops <50ms (multi-repo)

---

## Phase 2b: Complete Service Architecture 🏗️ MEDIUM

**Target**: Repository < 860 lines, 4 services extracted
**Effort**: 6-8h
**Impact**: MEDIUM - Code quality, maintainability
**Priority**: HIGH (after Phase 9)

### 2b.1: AuthService Extraction (4h)
Extract auth logic from `repository.ts:735-806` (70 lines):
- Credential storage (SecretStorage API)
- Retry flow with auth
- Multiple accounts per repo
- Zero Repository dependencies

**Tests** (3 TDD):
1. Credential storage/retrieval
2. Retry flow with auth
3. Multiple accounts handling

**Files**:
- New: `src/services/authService.ts`
- Modified: `src/repository.ts`

### 2b.2: Code Quality Quick Wins (2h)
- Remove redundant null guards (15 files, 30 lines)
- Fix constructor if/if redundancy (command.ts, 8 lines)
- Extract duplicate selection logic (7 commands, 21 lines)
**Total**: 59 lines removed

### 2b.3: Documentation Update (2h)
Update all core docs:
- ARCHITECTURE_ANALYSIS.md (final stats)
- CLAUDE.md (service pattern)
- DEV_WORKFLOW.md (testing guidelines)
- CHANGELOG.md (version entry)

**Success Criteria**:
- [ ] AuthService extracted (70 lines)
- [ ] 3 TDD tests passing
- [ ] Repository < 860 lines
- [ ] Code bloat reduced 59 lines
- [ ] Docs updated

---

## Deferred Work

**Phase 10: Additional Code Bloat** (123 lines, 3-4h):
- Duplicate show()/showBuffer() logic (35 lines)
- Command wrapper boilerplate (42 lines)
- Revert duplicate logic (14 lines)
- Plainlog variants pattern (24 lines)
- Validation pattern duplication (8 lines)

**Phase 11: Security**:
- Password exposure fix (stdin refactor, 8-12h)

**Phase 12: Testing**:
- Integration tests (Phase 4a.2 deferred)
- Target: 30% coverage

---

## Metrics

| Metric | Current | Phase 9 Target | Phase 2b Target |
|--------|---------|----------------|-----------------|
| Workspace scan (1000 files) | Freezes | <2s | - |
| Config cache coverage | 4 keys | 5 keys | - |
| Changelist ops (multi-repo) | 50-300ms | <50ms | - |
| Repository LOC | 923 | - | <860 |
| Services extracted | 3 | - | 4 |
| Code bloat removed | 0 | - | 59 lines |

---

## Execution Order

**Recommended**: Phase 9 → Phase 2b

**Rationale**:
1. Phase 9: Fix extension freeze (CRITICAL, 45% users)
2. Phase 2b: Complete architecture vision (quality)

**Total Effort**: 10-14h (1-2 days)

---

## Unresolved Questions

Phase 9:
- Optimal concurrency limit for stat() ops (8/16/32)?
- Queue strategy (FIFO vs priority)?

Phase 2b:
- AuthService coupling to SecretStorage?
- Service disposal order on extension deactivate?
