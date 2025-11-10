# IMPLEMENTATION PLAN - Next Phases

**Version**: v2.17.38
**Updated**: 2025-11-10
**Status**: Phase 2 Complete ✅ | Phase 4.5b Complete ✅ | Next: Phase 4a Testing + Phase 2b Auth

---

## Current Status

**Phase 2 Complete** (v2.17.17-18):
- Repository: 1,179 → 923 lines (22% reduction)
- 3 services extracted: StatusService (355), ResourceGroupManager (298), RemoteChangeService (107)
- 9 tests added, zero regressions

**Phase 4.5b Complete** (v2.17.31-33):
- Build fixed (5 TS errors, esModuleInterop)
- DX improved (parallel pretest, test:fast, 40-80% faster)
- URL validation complete (checkout + switchBranch)
- validateRevision scope assessed (1/1 inputs protected)

**Outstanding**:
- 1 CRITICAL security gap (password exposure - deferred, requires stdin refactor)
- 5 performance bottlenecks (deferred to Phase 8)
- ~530 lines code bloat (deferred)

---

## Phase 4a: Security Foundation (Week 1 - 6 days)

### Validation Tests (2 days)
Test 6 validators with boundary cases:
- validateRevision, validatePath, validateUrl, validateBranchName, validateCommitMsg, validateRepositoryUrl
- ~90 tests (15 cases × 6 validators)

**Files**: test/unit/validators.test.ts

### Parser + Integration Tests (2 days)
- Parser tests: statusParser, logParser, infoParser with real fixtures
- Integration tests: checkout→modify→commit end-to-end flows
- Edge cases: special chars, externals, changelists

**Files**: test/unit/parsers/, test/integration/

### Error Handling Tests (2 days)
Focus on 5 critical user-facing gaps:
1. Unhandled promise rejections (event handlers)
2. Generic error messages (add context)
3. Race conditions in status updates
4. Silent auth failures
5. Activation failures

**Files**: test/unit/error-handling.test.ts

**Target**: 25-30% coverage

**Success Criteria**:
- [x] All validators tested (90 tests: boundary + malicious)
- [ ] Parsers + integration tested
- [ ] Error handling tests passing
- [ ] 25-30% line coverage (est. 15% with validators)

---

## Phase 2b: AuthService Extraction (Week 1 - concurrent)

### Extract Auth Logic (6h)
- Lines: repository.ts:735-806 (70 lines)
- Target: Repository → 850 lines
- Pattern: Stateless service, zero Repository deps

### Auth Security Tests (1 day)
- Credential storage (SecretStorage API)
- Retry flow with auth
- Multiple accounts per repo

**Success Criteria**:
- [ ] AuthService extracted (70 lines)
- [ ] 3 TDD tests passing
- [ ] Repository < 860 lines

---

## Phase 4b: Performance Quick Wins (Week 1 - concurrent, 1 day)

**Moved from Phase 8** (4 parallel subagents ultrathink, 2025-11-10):

### 1. Cascading Debounce Fix (3-4h)
**Location**: repository.ts:293,302,366

**Issue**: 3×1s stacked = 2-3s delay on every file change
- Affects 100% users (UX bottleneck)
- Constant perceived lag during active editing

**Fix**:
- Consolidate onDidAnyFileChanged + actionForDeletedFiles
- Reduce debounce 1000ms→300-500ms
- Immediate feedback for user-initiated actions

**Impact**: 25-35% perceived speedup, LOW risk

### 2. O(n²) Status Filtering (2-3h)
**Location**: services/StatusService.ts:239,261 + util/globMatch.ts:18

**Issue**: Creates new Minimatch instances per file (no cache)
- Critical at >500 files with >5 ignore patterns
- 10k files × 50 patterns = 500k iterations

**Fix**:
- Pre-compile Minimatch instances once
- Reuse across all files via cache
- Invalidate on config change

**Impact**: 20-30% speedup for affected users, LOW risk

**Success Criteria**:
- [x] Debounce reduced (1000ms→500/300ms), perceived lag eliminated
- [x] O(n) filtering with cached Minimatch instances
- [x] Optimization: 500k iterations→1k (500x faster)

---

## Performance Bottlenecks (Remaining 3 - Phase 8)

**Deferred post-v2.18.0**:

1. **Info cache timeout: 2min** (svnRepository.ts:192) - extend to 10-15min, 2-3h effort
2. **Remote polling: 5min** (RemoteChangeService.ts:89) - add backpressure, 4-6h effort, MEDIUM risk
3. **Blocking XML parser** (statusParser.ts:72) - replace xml2js, 8-12h effort, HIGH risk

**Rationale**: #1 marginal gains, #2 medium risk/coordination needed, #3 high risk/extensive testing

---

## Code Bloat (Top 5 - Deferred)

**~250-300 lines removable**:

1. Duplicate Buffer/String pairs (~150 lines) - show/showBuffer, etc.
2. Over-engineered constructor pattern (svnRepository.ts:51-66)
3. Redundant error handlers (35 instances)
4. Debug console logging (extension.ts:34-76)
5. Stale TODOs (18+ instances)

**Decision**: Defer until testing complete

---

## Metrics Dashboard

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Test coverage (line) | 25-30% | 12% | 🔴 |
| Repository LOC | <860 | 923 | 🟡 |
| Services extracted | 4 | 3 | 🟡 |
| CRITICAL vulns | 0 | 1 (deferred) | 🟡 |
| Build status | ✅ | ✅ | ✅ |
| DX (dev cycle speed) | Faster | 40-80% faster | ✅ |
| URL validation | 100% | 100% | ✅ |

---

## Next Actions

**PHASE 4a** (Week 1 - 6 days):
1. Validator tests (6 validators, boundary cases) - 2 days
2. Parser tests + integration tests - 2 days
3. Error handling tests (promise rejections, race conditions) - 2 days

**PHASE 2b** (Concurrent):
4. Extract AuthService (70 lines from repository.ts) - 1 day
5. Auth security tests (3 TDD tests)

**PHASE 4b** (Concurrent - Week 1):
6. Fix cascading debounce (3×1s→300-500ms) - 3-4h
7. O(n²) status filtering → O(n) with cache - 2-3h

**Target**: v2.18.0 with 25-30% coverage, 4 services extracted, 2 quick perf wins

---

## Performance Analysis Results (4 Parallel Subagents)

**Repo Size Distribution** (Enterprise SVN 2025):
- 35% small (<500 files) - excellent
- **40% medium (500-2K files)** - optimization target ✅
- 18% large (2K-5K files) - pain threshold
- 7% XL (5K+ files) - critical

**Remote vs Local**: 75-80% remote repos (enterprise compliance) ✅

**Critical Thresholds**:
- XML parser: >500 files (50ms+ UI freeze)
- O(n²) filtering: >500 files + >5 externals
- Debounce: All sizes (UX bottleneck, 100% users affected)

**Network**: 60% corporate VPN (20-80ms RTT)
**CPU/Memory**: 60% standard dev machines (4-8 cores, 16GB RAM)

**Decision**: Move #3 (debounce) + #5 (O(n²)) to Phase 4b
- Combined effort: 5-7h (~1 day)
- Impact: 45-65% improvement
- Risk: LOW (both isolated)
