# Lessons Learned

**Version**: v2.17.107
**Updated**: 2025-11-12

---

## Core Patterns

### 1. Build System: tsc over webpack
**Lesson**: Direct TypeScript compilation provides better type safety and debugging than bundling.

**Benefits**:
- Full strict mode enforcement (found 21 hidden bugs)
- Individual modules easier to debug
- 20% faster builds

**Trade-offs**:
- Larger package size (+250KB acceptable)
- Runtime dependencies must be in `dependencies` not `devDependencies`
- `.vscodeignore` must include all compiled modules

**Rule**: Use tsc for extensions unless bundling truly needed.

---

### 2. Service Extraction Pattern
**Lesson**: Extract stateless services from god classes incrementally.

**Approach**:
1. Write 3 TDD tests first (core scenarios)
2. Create stateless service with parameter objects
3. Extract verbatim (preserve behavior)
4. Move decorators to caller
5. Refactor incrementally after tests pass

**Results** (Phase 2):
- 760 lines extracted (StatusService, ResourceGroupManager, RemoteChangeService)
- Repository.ts: 1,179 → 923 lines (22% reduction)
- Zero breaking changes

**Rule**: Multiple small extractions beat one big refactor.

---

### 3. Dependency Migration: Adapter Pattern
**Lesson**: Abstract old API behind compatibility layer when migrating dependencies.

**Pattern** (xml2js → fast-xml-parser):
1. Create adapter abstracting parser API
2. Add compatibility tests before migration
3. Migrate simplest parser first
4. Validate pattern, then migrate complex parsers

**Results**:
- 79% bundle reduction (45KB → 9.55KB)
- Zero functionality changes
- Can swap parser again in future

**Rule**: De-risk migrations with adapters + incremental rollout.

---

### 4. Type Safety: No Bypasses
**Lesson**: transpileOnly and `any` types hide bugs. Fix types, don't disable checker.

**Found**:
- 21 TypeScript errors masked by webpack transpileOnly
- 248 `any` types across 25 files compromise safety

**Impact**:
- 10× unknown error types
- 4× null/undefined checks missing
- Array/readonly violations

**Rule**: Enable strict mode from start. No `any` without explicit justification.

---

### 5. Performance: Measure User Impact
**Lesson**: Prioritize optimizations by end-user impact, not code elegance.

**High-impact fixes** (Phases 8-16):
- Debounce/throttle: 60-80% burst reduction
- Config cache: 100% users, -10ms per command
- Conditional index rebuild: 50-80% users, 5-15ms saved
- Decorator removal: 1-2ms → <0.5ms

**Low-ROI efforts**:
- God class refactoring: 6-8h effort, minimal user benefit
- Over-optimization: Diminishing returns after P0/P1 fixes

**Rule**: Profile real usage. Fix P0 bottlenecks before refactoring.

---

### 6. Error Handling: Descriptive Messages
**Lesson**: Silent error handling is debugging nightmare.

**Anti-pattern**:
```typescript
if (err) { reject(); } // ❌ No error message
```

**Best practice**:
```typescript
catch (err) {
  console.error("parseInfoXml error:", err);
  reject(new Error(`Failed to parse: ${err.message}`));
}
```

**Impact**: Previous migration failures debuggable only after adding logging.

**Rule**: Always include context in error messages.

---

### 7. Testing: TDD + 3 End-to-End Tests
**Lesson**: Write tests before implementation. 3 core scenarios sufficient per feature.

**Coverage progress**:
- 138 → 844 tests (+706, +512%)
- 21-23% → 50-55% coverage ✅ TARGET

**Pattern**:
1. 3 end-to-end tests (happy path + 2 edge cases)
2. Unit tests for critical logic only
3. Don't overtest implementation details

**Rule**: Test behavior, not implementation. Stop at 50-60% coverage.

---

### 8. Incremental Commits
**Lesson**: Small focused commits enable easy review, revert, cherry-pick.

**Examples**:
- Phase 1: 13 commits (10 lines avg)
- Phase 2: 1 commit per service extraction
- XML migration: 9 commits (one per parser)

**Benefits**:
- Clear version history
- Bisectable (find regressions fast)
- Low review overhead

**Rule**: Version bump per commit. One concern per commit.

---

### 9. Critical Path Mapping
**Lesson**: Map failure cascades before refactoring critical code.

**Found**: Extension activation depends on `parseInfoXml()` in 2 places:
- `source_control_manager.ts:295` - workspace scan
- `svnRepository.ts:86` - repository init

**Risk**: Parse failure = silent repository failure (no error shown to user).

**Mitigation**: Test critical paths extensively. Add diagnostic logging.

**Rule**: Know where failures cascade before touching critical code.

---

### 10. Code Review: Type Safety Checks
**Lesson**: Code review catches gaps missed during extraction.

**Blockers found** (Phase 2):
1. Unsafe cast: `groups as any as ResourceGroup[]`
2. Encapsulation leak: Exposed internal `_groups` Map
3. Incomplete interfaces: Missing config types

**Rule**: Review for type safety, encapsulation, performance after extraction.

---

## Quick Reference

**Starting extension**: tsc + strict mode + Positron template
**Migrating deps**: Adapter pattern + TDD + incremental
**Extracting services**: Stateless + parameter objects + decorators at caller
**Optimizing**: Profile user impact, fix P0 first
**Testing**: 3 E2E tests per feature, 50-60% coverage target
**Committing**: Small focused commits, version bump each

---

## Anti-Patterns to Avoid

❌ transpileOnly (bypasses type checking)
❌ Silent error handling (no context)
❌ Big bang refactors (high risk)
❌ Premature optimization (fix bottlenecks first)
❌ Over-testing (diminishing returns >60%)
❌ God commits (hard to review/revert)

---

**Document Version**: 2.0 (condensed from 892 → 185 lines)
**Last Updated**: 2025-11-12
