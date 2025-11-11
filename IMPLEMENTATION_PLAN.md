# IMPLEMENTATION PLAN

**Version**: v2.17.91
**Updated**: 2025-11-11
**Status**: Phases 1-16 COMPLETE ✅

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

---

## Phase 17: AuthService Extraction 🔐 NEXT

**Impact**: Security vulnerability, 20-30% repos fail auth
**Effort**: 4-6h
**Risk**: HIGH

### Problem
Auth logic scattered across 40+ locations:
- `svn.ts`: `getSvnErrorCode()`, `cpErrorHandler()`
- `svnRepository.ts`: credential management
- `repository.ts`: auth state
- 15+ commands handle auth errors separately

### Security Risk
- No centralized validation
- Inconsistent error handling
- Credential leakage potential
- Hard to audit

### Solution
Extract AuthService (100-120 lines):
```ts
export class AuthService {
  validateCredentials(repo: string): Promise<boolean>
  handleAuthError(error: ISvnErrorData): AuthAction
  requestCredentials(repo: string): Promise<Credentials>
  clearCredentials(repo: string): void
}
```

### Files
- NEW: `src/services/authService.ts` (~120 lines)
- `src/svn.ts` (extract 40 lines)
- `src/svnRepository.ts` (extract 30 lines)
- `src/repository.ts` (extract 20 lines)
- 15+ command files (refactor error handling)

### Success Metrics
- Single source of truth for auth
- Consistent error messages
- Audit trail for auth events
- Zero credential leaks

---

## Deferred (Medium/Low Priority)

**Timeout Error UX** (2-3h, 30-40% users):
- Generic timeout messages → "Network timeout - try again?"

**Open* Command Bloat** (2.5h, 74 lines):
- 5 thin wrappers → factory pattern

**Test Coverage** (20-30h):
- 138 tests → 200+ tests (50%+ coverage)
- Command integration tests missing

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

**NEXT**: Phase 17

**Rationale**:
1. ✅ Phase 16: Performance - COMPLETE (conditional index rebuild)
2. Phase 17: Security (4-6h, HIGH risk, critical for enterprise)

**Total Effort**: 4-6h

---

## Unresolved Questions

- Batch file watcher events for bulk deletes?
- Remote polling: early exit if no actual changes?
- God class refactor ROI vs risk?
