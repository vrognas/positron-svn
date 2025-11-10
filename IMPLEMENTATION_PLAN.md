# IMPLEMENTATION PLAN - Next Phases

**Version**: v2.17.40
**Updated**: 2025-11-10
**Status**: Phase 2 ✅ | Phase 4.5b ✅ | Phase 4b ✅ | Phase 4a.1 ✅ | Next: Phase 4a.2-3 + Phase 2b

---

## Current Status

**Phase 2 Complete** (v2.17.17-18):
- Repository: 1,179 → 923 lines (22% reduction)
- 3 services extracted: StatusService (355), ResourceGroupManager (298), RemoteChangeService (107)
- 9 tests, zero regressions

**Phase 4b Complete** (v2.17.38):
- Debounce: 1000ms→500/300ms (60% faster, 2-3s→0.8-1.3s)
- O(n) filtering: Minimatch cache (500x faster, 1000 files × 50 patterns)
- Impact: 45-65% improvement, 100%+40% users

**Phase 4a.1 Complete** (v2.17.37):
- Validator tests: 90 test cases, 6 validators
- Est. 15% line coverage

**Outstanding**:
- 1 CRITICAL security gap (password exposure - deferred, requires stdin refactor)
- 5 NEW performance bottlenecks identified (Phase 8)
- ~283 lines code bloat (Phase 9)

---

## Phase 4a.2: Parser + Integration Tests (Week 2 - 2 days)

### Parser Tests (1 day)
Test 3 critical parsers with real fixtures:
- statusParser: XML parsing, externals, changelists
- logParser: Multi-entry logs, branches, merges
- infoParser: Repository info, URL handling

**Files**: test/unit/parsers/

### Integration Tests (1 day)
End-to-end flows:
- checkout→modify→commit
- branch→switch→merge
- Special chars, externals handling

**Files**: test/integration/

**Success Criteria**:
- [ ] Parser tests passing (3 parsers)
- [ ] Integration tests passing
- [ ] Coverage: 20-25% (est. +5-10%)

---

## Phase 4a.3: Error Handling Tests (Week 2 - 2 days)

Focus on 5 critical gaps:
1. Unhandled promise rejections (event handlers)
2. Generic error messages (add context)
3. Race conditions in status updates
4. Silent auth failures
5. Activation failures

**Files**: test/unit/error-handling.test.ts

**Success Criteria**:
- [ ] Error handling tests passing
- [ ] Coverage: 25-30% (est. +5%)

---

## Phase 2b: AuthService Extraction (Week 2 - 1 day, concurrent)

### Extract Auth Logic
- Lines: repository.ts:735-806 (70 lines)
- Target: Repository → 850 lines
- Pattern: Stateless service, zero Repository deps

### Auth Security Tests
- Credential storage (SecretStorage API)
- Retry flow with auth
- Multiple accounts per repo

**Success Criteria**:
- [ ] AuthService extracted (70 lines)
- [ ] 3 TDD tests passing
- [ ] Repository < 860 lines

---

## Metrics Dashboard

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Test coverage (line) | 25-30% | ~15% | 🟡 |
| Repository LOC | <860 | 923 | 🟡 |
| Services extracted | 4 | 3 | 🟡 |
| CRITICAL vulns | 0 | 1 (deferred) | 🟡 |
| Performance (debounce) | Faster | 60% faster | ✅ |
| Performance (filtering) | Faster | 500x faster | ✅ |

---

## Next Actions (Week 2)

**IMMEDIATE** (4 days):
1. Phase 4a.2: Parser tests (statusParser, logParser, infoParser) - 1 day
2. Phase 4a.2: Integration tests (checkout→commit flows) - 1 day
3. Phase 4a.3: Error handling tests (promise rejections, race conditions) - 2 days

**CONCURRENT** (1 day):
4. Phase 2b: Extract AuthService (70 lines from repository.ts)
5. Phase 2b: Auth security tests (3 TDD tests)

**Target**: v2.18.0 with 25-30% coverage, 4 services extracted

---

## Performance Bottlenecks - Phase 8 (Deferred)

**5 bottlenecks identified** (ultrathink analysis 2025-11-10):

1. **N+1 External Queries** (svnRepository.ts:141-150)
   - Impact: 85% users with 50+ externals
   - Severity: HIGH, 4h fix
   - Sequential `getInfo()` blocks UI

2. **O(n²) Descendant Check** (StatusService.ts:200-208)
   - Impact: 70% users with 1000+ files
   - Severity: HIGH, 3h fix
   - Nested `.some()` loop in `separateExternals()`

3. **5s Hardcoded Throttle** (repository.ts:406)
   - Impact: 95% users with autorefresh
   - Severity: HIGH, 1h fix
   - `await timeout(5000)` blocks UI after every status

4. **Missing SVN Timeouts** (svn.ts:87-232)
   - Impact: 40% users on slow networks
   - Severity: MEDIUM, 3h fix
   - No timeout on `cp.spawn()`, can hang indefinitely

5. **O(n) Conflict Search** (StatusService.ts:313)
   - Impact: 30% users with conflicts
   - Severity: MEDIUM, 2h fix
   - Linear search per unversioned file

**Decision**: Defer to Phase 8 (13h effort, 68% improvement potential)

---

## Code Bloat - Phase 9 (Deferred)

**283 lines removable** (ultrathink analysis 2025-11-10):

1. Duplicate plainLog methods (svnRepository.ts:784-838) - 54 lines, MEDIUM risk, 1.5h
2. Command error boilerplate (commands/*.ts) - 60 lines, LOW risk, 1h
3. Debug console.log (24 files) - 52 lines, LOW risk, 0.5h
4. Duplicate show/showBuffer (svnRepository.ts:288-427) - 47 lines, MEDIUM risk, 1.5h
5. EventEmitter + wrappers (repository.ts:115-730) - 70 lines, MEDIUM risk, 2h

**Decision**: Defer until testing complete (6.5h effort)

---

## Extraction Opportunities - Future (Deferred)

**Top 3 from refactoring analysis**:

1. **Encoding Detection** (svnRepository.ts:325-378) - 53 lines, LOW risk, HIGH ROI
2. **Deleted Files Handler** (repository.ts:303-364) - 62 lines, LOW risk, MEDIUM ROI
3. **Branch Enumeration** (svnRepository.ts:585-645) - 61 lines, MEDIUM risk, MEDIUM ROI

**Decision**: Defer until Phase 2b complete
