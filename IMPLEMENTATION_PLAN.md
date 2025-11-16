# IMPLEMENTATION PLAN

**Version**: v2.17.155
**Updated**: 2025-11-16
**Status**: Phases 1-21 complete ✅. Focus on 2 critical architecture phases.

---

## Phase 22: Type Safety Audit 🔴 CRITICAL

**Target**: v2.17.156-160
**Effort**: 8-12h
**Impact**: 100% codebase - foundation for all future work
**Priority**: P0 - Technical debt elimination

### Problem
- **248+ `any` types** across 25 files (up to 1003 in test files)
- Type safety compromised, runtime errors
- ESLint rule `@typescript-eslint/no-explicit-any: 'warn'` too permissive
- Unsafe casts: `groups as any as ResourceGroup[]`
- Missing guards on external data

### Tasks

**A. ESLint Enforcement** (1h) [FIRST - Prevents regression]
- Change `no-explicit-any` to `'error'`
- Whitelist existing violations (gradual fix)
- CI blocks new `any` types
- Files: `.eslintrc.json`

**B. Core Infrastructure** (3-4h)
- Fix decorators.ts (18 `any` instances)
- Fix util.ts (9 instances)
- Fix xmlParserAdapter.ts (9 instances)
- Type event handlers properly
- Pattern: Use generics, discriminated unions, type guards

**C. Command Layer** (2-3h)
- Fix command.ts type unsafety
- Remove unsafe casts in repository resolution
- Add runtime validation with type guards
- Pattern: `isRepositoryArgs(args): args is RepositoryArgs`

**D. Test Files** (2-3h)
- Reduce test `any` usage (369 instances)
- Use proper mock types
- Type assertion cleanup

**E. Documentation** (0.5-1h)
- Type safety guidelines
- When `any` acceptable (rare cases)
- Type guard patterns

**Order**: A → B → C → D → E (ESLint enforces immediately)

| Task | Effort | Priority |
|------|--------|----------|
| ESLint enforcement | 1h | P0 |
| Core infrastructure | 3-4h | P0 |
| Command layer | 2-3h | P0 |
| Test files | 2-3h | P1 |
| Documentation | 0.5-1h | P2 |

**ROI**: 50% fewer runtime errors, 10× better refactoring confidence

---

## Phase 23: Architecture Refactoring 🔴 CRITICAL

**Target**: v2.17.161-170
**Effort**: 10-15h
**Impact**: All future features - maintainability foundation
**Priority**: P0 - God class elimination

### Problem
- **Repository.ts**: 923 lines (god class)
  - UI coordination, domain logic, infrastructure, config, auth
  - 40-50% of changes touch this file
  - Testing requires full stack

- **Command.ts**: 492 lines (god base class)
  - Repository resolution, diff infrastructure, error handling, helpers
  - Every command inherits 492 lines

- **Decorators.ts**: Global state (memory leak, race conditions)
- **Util.ts**: 336 lines (dumping ground)

### Tasks

**A. Extract Repository Services** (4-5h) [P0]
- AuthenticationService (50 lines)
  - canSaveAuth, username/password, secrets API
- ConfigurationService (80 lines)
  - Centralize _configCache pattern
- FileWatcherCoordinator (100 lines)
  - Separate FS concerns
- Keep DomainRepository ~200 lines (pure domain)
- Pattern: Service extraction from Phase 2 (StatusService, etc.)

**B. Split Command Base Class** (3-4h) [P0]
- Mixins or composition over inheritance
- CommandBase (registration, execute() only, ~50 lines)
- RepositoryCommandMixin (repo resolution)
- DiffCommandMixin (diff operations)
- ResourceCommandMixin (SCM resource handling)
- Centralized ErrorHandler (composition)

**C. Fix Global Decorator State** (2-3h) [P0]
- Per-instance OperationQueue (not global `_seqList`)
- WeakMap for automatic cleanup
- Prevent memory leaks (keys never cleaned)
- Support 100+ repos without crashes
- Files: decorators.ts

**D. Split util.ts** (1-2h) [P1]
- util/events.ts (event utilities)
- util/async.ts (timeout, processConcurrently)
- util/svn.ts (SVN-specific helpers)
- util/disposable.ts (IDisposable, toDisposable)

**E. Deduplicate show/showBuffer** (1h) [P1]
- 136 lines duplicate code
- Single generic implementation
- Type-safe: `_show<T extends "string" | "buffer">`

**Order**: A → B → C → D → E

| Task | Effort | Priority |
|------|--------|----------|
| Extract Repository services | 4-5h | P0 |
| Split Command base | 3-4h | P0 |
| Fix decorator state | 2-3h | P0 |
| Split util.ts | 1-2h | P1 |
| Deduplicate show/showBuffer | 1h | P1 |

**ROI**: 40% faster feature development, 30% less boilerplate, 0 memory leaks

---

## Deferred Phases

### Phase 24: Performance Optimization (Deferred to v2.18.x)
**Issues identified**:
- XML parsing synchronous (50-200ms UI freeze)
- File watcher flooding (CPU spikes)
- Encoding detection overhead (5-20ms/cmd)
- Info cache timer accumulation (500 active timers)

**Effort**: 6-8h
**Reason**: P1 bottlenecks already fixed (Phases 8-19). Remaining issues affect <30% users.

### Phase 25: Positron Integration (HIGH RISK - Blocked)
**Status**: ⚠️ DEFER until API stability confirmed
**Blocker**: @posit-dev/positron v0.1.x experimental, 35% chance API methods don't exist
**Effort**: 8-15h
**Recommendation**: Prototype-first (2-3h spike) before full commitment

### Phase 26: Code Bloat Cleanup (P2 - Nice to have)
**Issues**:
- 42 console.log statements (remove)
- 18 TODO comments (track in todos/)
- Unused dependencies (tmp, dayjs limited use)
- temp_svn_fs.ts unnecessary abstraction

**Effort**: 2-3h
**ROI**: Code quality, not functional

---

## Summary

**Phase 22 (Type Safety)**: 8-12h, CRITICAL - Foundation for all future work
**Phase 23 (Architecture)**: 10-15h, CRITICAL - Maintainability foundation
**Total**: 18-27h for both phases

**Deferred**: Performance (P1), Positron (HIGH RISK), Code cleanup (P2)

---

## Strategic Decisions

### Why Type Safety First?
- Blocks all future safe refactoring
- 248+ `any` types = 248+ potential runtime errors
- ESLint enforcement prevents new violations
- Quick wins in decorators.ts, util.ts

### Why Architecture Second?
- Builds on type safety improvements
- Service extraction pattern proven (Phase 2)
- 40% faster feature development
- Repository god class biggest pain point

### Why Defer Performance?
- P0/P1 bottlenecks already fixed (Phases 8-19)
- Remaining issues affect <30% users
- Architecture work enables better perf work later

### Why Defer Positron?
- API experimental, 35% chance methods don't exist
- High risk of breaking changes
- Need prototype-first validation (2-3h)
- Can revisit when API stabilizes (v0.5.0+)

---

## Unresolved Questions

### Phase 22
- Gradual whitelist or big bang fix for `any` types?
- Target <100 or <50 `any` instances?
- Enable strictNullChecks incrementally?

### Phase 23
- Hexagonal architecture refactor vs incremental extraction?
- DI container (InversifyJS/tsyringe) worth complexity?
- Command registry pattern ROI justify effort?
