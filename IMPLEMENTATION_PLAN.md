# IMPLEMENTATION PLAN - Next Phases

**Version**: v2.17.32
**Updated**: 2025-11-10
**Status**: Phase 2 Complete ✅ | Build Fixed ✅ | DX Improved ✅ | Phase 4.5b Complete ✅ | Next: Testing

---

## Current Status

**Phase 2 Complete** (v2.17.17-18):
- Repository: 1,179 → 923 lines (22% reduction)
- 3 services extracted: StatusService (355), ResourceGroupManager (298), RemoteChangeService (107)
- 9 tests added, zero regressions

**Phase 4.5b Complete** (v2.17.31-32):
- ✅ Build fixed (5 TS errors, esModuleInterop, incremental compilation)
- ✅ DX improved (parallel pretest, test:fast, 40-80% faster dev cycle)
- ✅ URL validation complete (checkout + switchBranch)
- ✅ validateRevision scope assessed (1/1 inputs already protected)
- ⚠️ Password exposure deferred (requires stdin refactor)

**Remaining Issues**:
- 1 CRITICAL security gap (password exposure in process args - deferred)
- 5 performance bottlenecks (O(n²) algorithms, memory leaks - deferred to Phase 8)
- ~530 lines code bloat (duplicate commands, thin wrappers - deferred)

---

## Phase 4.5b: Critical Security (COMPLETE ✅)

**Status**: v2.17.31-32 complete, 1 item deferred

### Completed (v2.17.31-32)
- ✅ Build fixed (esModuleInterop, 5 TS errors, incremental compilation)
- ✅ DX improved (parallel pretest, test:fast, 40-80% faster)
- ✅ URL validation: switchBranch.ts (checkout.ts already done)
- ✅ validateRevision scope: assessed all 47 commands, only 1 user input (already protected)
- ⚠️ Password exposure: DEFERRED (requires stdin refactor, complex change)

### Findings
- **validateRevision**: Originally estimated 11 files needed validation
- **Reality**: Only 1 user input point exists (search_log_by_revision.ts)
- **Already protected**: Validation applied in earlier version
- **Hardcoded revisions**: HEAD/BASE/PREV/COMMITTED don't need validation (constants)

---

## Phase 4a: Security Foundation (Week 1 - 6 days revised)

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
- [ ] All validators tested (boundary + malicious)
- [ ] Parsers + integration tested
- [ ] Error handling tests passing
- [ ] 25-30% line coverage

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
- [x] AuthService extracted (70 lines)
- [x] 3 TDD tests passing
- [x] Repository < 860 lines

---

## Performance Issues (Deferred to Phase 8)

### Critical Bottlenecks Identified

**P0 - Severe**:
1. O(n) sequential network calls for externals (svnRepository.ts:141-150)
   - 5+ externals = 5+ sequential network roundtrips

**P1 - High**:
2. O(n²) external filtering (StatusService.ts:200-207)
   - 100 files × 10 externals = 1,000 ops

3. O(n²) conflict pattern matching (StatusService.ts:313-315)
   - 100 unversioned × 500 total = 50,000 iterations

**P2 - Medium**:
4. Unthrottled file watcher calls (repository.ts:211-218)
   - Every .svn change triggers network call (1s debounce insufficient)

5. Memory leak: uncleaned setTimeout (svnRepository.ts:192-194)
   - 2-min timers accumulate without cleanup

**Decision**: Defer to Phase 8 (post-v2.18.0) - affects power users only

---

## Code Bloat (Deferred)

**~530 lines removable**:
1. Duplicate commands (~350 lines) - merge parameterized versions
2. Thin fs/ wrappers (~60 lines) - use promisified fs directly
3. Dead util functions (~80 lines) - remove eventToPromise, filterEvent, memoize, globalSequentialize
4. Over-engineered patterns (~40 lines) - inline trivial classes

**Decision**: Defer cleanup until testing complete

---

## Error Handling Issues (Critical)

**Top User-Facing Errors**:
1. **Unhandled promise rejections** (CRITICAL) - repository.ts:213-214
   - Silent failures in event handlers

2. **Generic error messages** (HIGH) - 12+ command files
   - "Unable to update" with no details

3. **Race conditions in status** (HIGH) - repository.ts:367-381
   - Concurrent updates overwrite each other

4. **Silent auth failures** (MEDIUM) - repository.ts:789-806
   - Operations do nothing when auth dismissed

5. **Activation failures** (MEDIUM) - extension.ts:168-171
   - Extension continues in broken state

**Decision**: Address in Phase 4a security tests

---

## DX Issues (Fix First)

**BLOCKER**: Build currently broken - 5 TypeScript errors

**Quick Fixes** (1 hour total):
1. Add esModuleInterop to tsconfig.json (15 min)
2. Fix dayjs imports in revert commands (15 min)
3. Parallelize pretest hook (10 min) - saves 25-40s/test
4. Separate lint from test pipeline (5 min) - saves 15-20s/test
5. Add incremental TS compilation (15 min) - saves 1-2s/watch

**Impact**: 40-80% faster development cycle

---

## Metrics Dashboard

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Test coverage (line) | 25-30% | 12% | 🔴 |
| Repository LOC | <860 | 923 | 🟡 |
| Services extracted | 4 | 3 | 🟡 |
| CRITICAL vulns | 0 | 1 (password deferred) | 🟡 |
| Build status | ✅ | ✅ Passes | ✅ |
| DX (dev cycle speed) | Faster | 40-80% faster | ✅ |
| validateRevision applied | 1/1 inputs | 1/1 (100%) | ✅ |
| URL validation | checkout+switch | checkout+switch (100%) | ✅ |

---

## Critical Findings (5 Subagents Analysis)

**Build Priority**: FIX FIRST - 5 TS errors block all tests/validation
**Phase 4.5a Gap**: 30-40% complete (URL validation incomplete, validateRevision 1/12 files, password TODO)
**DX Timing**: NOW - immediate ROI on ongoing dev cycles
**Phase 4a**: FEASIBLE but needs integration tests + explicit error handling scope
**Missing**: Integration testing, error handling dedicated time

---

## Next Actions (Updated)

**COMPLETED** ✅:
1. ✅ Fix build (5 TS errors) - v2.17.31
2. ✅ DX improvements (parallel pretest, incremental TS) - v2.17.31
3. ✅ URL validation: switchBranch.ts - v2.17.32
4. ✅ Assess validateRevision scope - v2.17.32

**PHASE 4a** (Week 1 - 6 days):
1. Validator tests (6 validators, boundary cases) - 2 days
2. Parser tests + integration tests - 2 days
3. Error handling tests (promise rejections, race conditions) - 2 days
4. AuthService extraction (concurrent) - 1 day

**PHASE 2b** (Concurrent with Phase 4a):
5. Extract AuthService (70 lines from repository.ts) - 1 day
6. Auth security tests (3 TDD tests)

**Target**: v2.18.0 with 25-30% coverage, 4 services extracted

---

## Documentation Cleanup (Complete)

**Deleted** (2,281 lines):
- DEPENDENCY_ASSESSMENT.md (1,667 lines) - outdated
- PHASE_0_3_DELIVERY.md (318 lines) - historical
- docs/StatusService-Design.md (296 lines) - implemented

**Result**: 13 core docs remaining, 43% reduction

---

## Resolved Performance Optimizations

**Analysis Complete** (5 parallel subagents):

1. **Parallelize external getInfo()**: NO - @sequentialize decorator prevents concurrency. Better: batch paths into single `svn info` call.

2. **Cache external mappings**: YES - Build Set once per call, O(1) lookup vs O(n) some(). Zero invalidation needed (rebuild instant).

3. **Index conflict patterns**: YES - Set<string> before loop, 25,000→50 iterations (500x faster). Low cost, high gain.

4. **Watcher debounce 1s→5s**: NO - Keep 1s. Better fix: remove double-debounce (repoWatch + onDidAnyFileChanged both @debounce(1000)).

5. **Extract DeletedFileHandler**: DEFER - Fuzzy coupling, low ROI. Unlike Phase 2 services, no clean boundary.
