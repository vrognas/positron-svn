# IMPLEMENTATION PLAN

**Version**: v2.17.68
**Updated**: 2025-11-11
**Status**: Phases 12-15 COMPLETE ✅

---

## Completed ✅

- Phase 2: 3 services extracted (760 lines), Repository 22% smaller
- Phase 4a: 111 tests, 21-23% coverage
- Phase 4b/4b.1: 60-80% perf gain (debounce, throttle fixes)
- Phase 8: 15 bottlenecks (v2.17.46-50, 70% faster UI)
- Phase 9: 3 NEW bottlenecks (v2.17.52-54, 45% impact)
- Phase 10: Regression + hot path fixes (v2.17.59-60, 100% users)
- Phase 11: Command boilerplate (v2.17.58, 82 lines removed)
- Phase 12: Status update cache (v2.17.63, 60-80% burst reduction)
- Phase 13: Code bloat cleanup (v2.17.64, 45 lines removed, 17 commands)
- Phase 14: Async deletion bug (v2.17.67, DATA LOSS fix)
- Phase 15: Decorator overhead (v2.17.68, 1-2ms → <0.5ms)

---

## Deferred (Medium Priority)

**Resource Index Rebuild** (2-3h, 50-80% users):
- Unconditional rebuildResourceIndex() on every updateGroups()
- 5-15ms waste on large repos

**Timeout Error UX** (2-3h, 30-40% users):
- Generic error messages for network timeouts
- Should show "Network timeout - try again?"

**Open* Command Bloat** (2.5h, 74 lines):
- 5 thin wrapper commands (openChangeHead/Base/Prev, openResourceHead/Base)
- Refactor to factory pattern

**AuthService Extraction** (4-6h, HIGH risk):
- Security isolation, scattered logic
- Defer until stability

**Test Coverage** (20-30h):
- 47 commands untested
- Defer until features stabilize

---

## Metrics

| Metric | Phase 14 Target | Phase 15 Target |
|--------|-----------------|-----------------|
| Directory deletion errors | 0% caught | 100% caught |
| Data loss risk | CRITICAL | FIXED |
| Decorator overhead | 1-2ms | <0.5ms |
| Status operations | 100% affected | 100% faster |

---

## Execution Order

**NEXT**: Phase 14 → Phase 15

**Rationale**:
1. Phase 14: CRITICAL bug fix (data loss, 30min)
2. Phase 15: High-frequency optimization (all operations, 1-2h)

**Total Effort**: 1.5-2.5h
