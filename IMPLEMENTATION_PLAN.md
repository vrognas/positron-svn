# IMPLEMENTATION PLAN - Next Phases

**Version**: v2.17.29
**Updated**: 2025-11-10
**Status**: Phase 2 Complete ✅ | Audit Complete | Next: Security & Testing

---

## Current Status

**Phase 2 Complete** (v2.17.17-18):
- Repository: 1,179 → 923 lines (22% reduction)
- 3 services extracted: StatusService (355), ResourceGroupManager (298), RemoteChangeService (107)
- 9 tests added, zero regressions

**Critical Issues Identified**:
- 2 CRITICAL security gaps (password exposure, URL validation)
- 5 performance bottlenecks (O(n²) algorithms, memory leaks)
- ~530 lines code bloat (duplicate commands, thin wrappers)
- Build system currently broken (TS compilation errors)

---

## Phase 4.5a: Critical Security (IMMEDIATE - 4 hours)

**Priority**: BLOCKER - must fix before any other work

### Security Fixes
1. **Password exposure in process args** (2h)
   - File: svn.ts - use stdin for credentials
   - Impact: CRITICAL - trivial exploit

2. **URL validation missing** (1h)
   - Files: checkout, switch commands
   - Impact: CRITICAL - SSRF/command injection

3. **Apply validateRevision()** (1h)
   - Locations: 12+ command files
   - Impact: HIGH - input sanitization

**Success Criteria**:
- [x] Zero password leaks in process args
- [x] URL validation on all checkout/switch
- [x] validateRevision applied everywhere

---

## Phase 4a: Security Foundation (Week 1 - 5 days)

### Validation Tests (3 days)
Test all 5 validators with boundary cases:
- validateRevision, validatePath, validateUrl, validateBranchName, validateCommitMsg

**Files**: test/unit/validators.test.ts

### Parser Tests (2 days)
Test with real SVN fixtures:
- statusParser, logParser, infoParser
- Edge cases: special chars, externals, changelists

**Files**: test/unit/parsers/

**Target**: 25-30% coverage

**Success Criteria**:
- [x] All validators tested (boundary + malicious input)
- [x] Parsers tested with real fixtures
- [x] 25-30% line coverage

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
| CRITICAL vulns | 0 | 2 | 🔴 |
| Build status | ✅ | 🔴 Broken | 🔴 |

---

## Next Actions (Priority Order)

**TODAY**:
1. Fix build (TS compilation errors) - 15 min
2. Fix critical security (passwords + URL) - 4h
3. DX improvements (parallel pretest, incremental TS) - 45 min

**WEEK 1**:
4. Security foundation tests - 3 days
5. Parser tests - 2 days
6. AuthService extraction - 1 day (concurrent)

**Target**: v2.18.0 with security-first foundation

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
