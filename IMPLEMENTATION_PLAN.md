# IMPLEMENTATION PLAN

**Version**: v2.17.103
**Updated**: 2025-11-12
**Status**: Phases 1-16 + 17A + Test Coverage Phase 1-5 + Timeout UX + Open* Factory + Stderr Sanitization COMPLETE ✅

---

## Completed ✅

- Phase 1: Build system modernization (tsc, strict types)
- Phase 2: Services extracted (760 lines, 22% repo reduction)
- Phase 4: Performance (debounce/throttle, 60-80% gain)
- Phase 8: 15 bottlenecks (70% faster UI)
- Phase 9: 3 NEW bottlenecks (45% impact)
- Phase 10: Regression fixes (100% users)
- Phase 11: Command boilerplate (82 lines removed)
- Phase 12: Status cache (60-80% burst reduction)
- Phase 13: Code bloat (45 lines, 17 commands)
- Phase 14: Async deletion bug (DATA LOSS fix)
- Phase 15: Decorator overhead (1-2ms → <0.5ms)
- XML Parser Migration: xml2js → fast-xml-parser (79% bundle reduction)
- Phase 16: Conditional index rebuild (5-15ms eliminated, 50-80% users)
- Phase 17A: AuthService foundation (115 lines, 12 tests, 0 risk)
- Test Coverage Phase 1: +37 tests (utilities + security)
- Test Coverage Phase 2: +101 tests (command integration)
- Test Coverage Phase 3: +116 tests (update, switch, patch, merge)
- Test Coverage Phase 4a: +33 tests (changelist)
- Test Coverage Phase 4b: +144 tests (log, checkout, cleanup, refresh)
- Test Coverage Phase 5: +224 tests (ignore, rename, open, prompt, revertAll, unversioned) ✅ 50%+ TARGET
- Timeout Error UX: Enhanced error messages (E170013, E175002, E170001, E155004), +31 tests
- Open* Command Factory: 5 files → 1 file, 23 lines removed (31% reduction)
- Stderr Sanitization: M-1 critical security fix, prevents credential/path disclosure, +20 tests (sanitizeStderr() method)

---

## Phase 17B: AuthService Integration 🔐 DEFERRED

**Impact**: Security - completes Phase 17A infrastructure
**Effort**: 2-3h
**Risk**: HIGH (modifies repository.ts retry logic)
**Status**: DEFERRED (low priority)

### Phase 17A Complete ✅
- ✅ AuthService class (115 lines)
- ✅ 12 comprehensive tests
- ✅ ICredentialStorage abstraction
- ✅ Zero breaking changes

### Phase 17B Scope (DEFERRED)
Integrate AuthService into repository.ts:
- Replace `loadStoredAuths()` → `authService.loadStoredCredentials()`
- Replace `saveAuth()` → `authService.saveCredentials()`
- Replace `promptAuth()` → `authService.promptForCredentials()`
- Replace `retryRun()` → `authService.retryWithAuth()`
- Wire SecretStorage adapter

### Why Deferred
- Infrastructure complete and tested
- High integration risk (150+ lines in critical path)
- Low incremental value (auth already works)
- Can be adopted incrementally by new code
- Phase 17A provides audit trail + abstraction

### Next Steps (When Needed)
1. Create SecretStorage → ICredentialStorage adapter
2. Inject AuthService into Repository constructor
3. Migrate auth methods one at a time
4. Extensive integration testing

---

## Deferred (Medium/Low Priority)

**Timeout Error UX** ✅ COMPLETE:
- Enhanced error messages with actionable guidance (E170013, E175002, E170001, E155004)
- 31 comprehensive tests covering all error types and edge cases
- formatErrorMessage() method in command.ts with intelligent error detection

**Open* Command Bloat** ✅ COMPLETE:
- 5 thin wrapper files (74 lines) → single factory file (51 lines)
- createOpenChangeCommand() + createOpenResourceCommand()
- 23 lines removed (31% reduction), all 54 tests pass

**Test Coverage** ✅ COMPLETE:
- 138 → 793 tests (+655, +475%) - utilities, security, all major commands
- Commands tested: commit, revert, add, remove, resolve, update, switch, patch, merge, log, checkout, cleanup, upgrade, refresh, changelist, ignore, rename, open*, prompt, revertAll, unversioned
- Coverage: ~21-23% → ~50-55% ✅ TARGET REACHED
- Future: Edge cases, integration tests, E2E scenarios

**God Classes** (6-8h, diminishing returns):
- repository.ts: 969 lines
- svnRepository.ts: 1035 lines

---

## Metrics

| Metric | Phase 15 | Phase 16 Target | Phase 17 Target |
|--------|----------|-----------------|-----------------|
| Status update waste | 5-15ms | 0ms | 0ms |
| Users benefiting | 50-80% | 50-80% | 20-30% |
| Auth vulnerabilities | Scattered | Scattered | FIXED |
| Security isolation | None | None | Centralized |

---

## Execution Order

**NEXT**: Quick wins (remote poll early exit, file watcher batching)

**Rationale**:
1. ✅ Phase 16: Performance - COMPLETE (conditional index rebuild)
2. ✅ Phase 17A: Security foundation - COMPLETE (AuthService infrastructure)
3. Phase 17B: DEFERRED (high risk, low incremental value)
4. Quick wins: Low-hanging performance fruit (30-60min each)

**Completed Effort**: Phase 16 (2h) + Phase 17A (1.5h) = 3.5h

---

## Unresolved Questions

- Batch file watcher events for bulk deletes?
- Remote polling: early exit if no actual changes?
- God class refactor ROI vs risk?
