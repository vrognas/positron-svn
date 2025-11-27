# Lessons Learned

**Version**: v2.17.241
**Updated**: 2025-11-27

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

**Critical Fix** (v2.17.137):

- Bug: Revision expansion failed - `textNodeName` was `#text` not `_`
- Root cause: fast-xml-parser uses different defaults than xml2js
- xml2js: text nodes → `_` (when mergeAttrs: true)
- fast-xml-parser: text nodes → configurable via `textNodeName`
- Fix: Set `textNodeName: "_"` to match xml2js behavior
- Test gap: No test verified `_` property, only attributes

**Rule**: De-risk migrations with adapters + incremental rollout.
**Rule**: Test text content extraction, not just attributes.

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
if (err) {
  reject();
} // ❌ No error message
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

- 138 → 844 → 930+ tests (+792, +574%)
- 21-23% → 50-55% → 60-65% coverage ✅ EXCEEDED TARGET
- Phase 22 (v2.17.235): +41 e2e tests covering critical gaps

**Pattern**:

1. 3 end-to-end tests (happy path + 2 edge cases)
2. Unit tests for critical logic only
3. Don't overtest implementation details
4. Real SVN/file system for e2e (no mocks)

**Coverage additions** (v2.17.235):

- Core layer: svn.ts (3), svnFinder (3), resource.ts (3)
- Services: StatusService (3), ResourceGroupManager (3), RemoteChangeService (3)
- Commands: add (3), remove (3), commitAll (3), upgrade (3), pullIncomingChange (3)
- File system: mkdir (2), write_file (2), read_file (2), stat (2)

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

### 11. Batch Operations: Trade Bandwidth for Latency

**Lesson**: Fetching extra data is faster than multiple network calls.

**Example** (v2.17.210 - Batch SVN log):

- Before: 50 sequential `svn log -r REV:REV` commands = 5-10s
- After: 1 command `svn log -r MIN:MAX` = 0.1-0.2s
- Trade-off: 2x bandwidth for 50x speed

**Pattern**:

1. Find min/max range of requested items
2. Fetch entire range in single call
3. Filter results to requested items
4. Cache all fetched data for future use

**When to use**:

- ✅ High latency operations (network calls)
- ✅ Cheap filtering on client side
- ✅ Sparse data across small range
- ❌ Huge ranges (>1000x requested items)

**Rule**: For N network calls, consider single batch + filter if latency >> bandwidth.

---

### 7. Cache Eviction: LRU Policy

**Lesson**: Unbounded caches cause memory leaks; use LRU eviction to cap growth.

**Example** (v2.17.215 - Blame cache):

- Before: Unlimited blameCache + messageCache = 700KB+ per 100 files
- After: MAX_CACHE_SIZE=20, MAX_MESSAGE_CACHE_SIZE=500 = bounded memory
- Implementation: cacheAccessOrder Map tracks access time, evictOldestCache()

**Pattern**:

1. Add Map<key, timestamp> to track access order
2. Update timestamp on cache hit/miss
3. Evict oldest entry when size exceeds limit
4. For immutable caches, simple FIFO eviction works (batch 25%)

**When to use**:

- ✅ Long-running sessions (editors, servers)
- ✅ Large cache entries (>1KB per item)
- ✅ Unpredictable access patterns
- ❌ Short-lived processes (startup scripts)

**Rule**: Cache without eviction = eventual memory leak. Set explicit limits.

---

### 12. VS Code Dynamic Icons: No Static Icon in Command

**Lesson**: For context-based dynamic icons, remove icon from command definition.

**Issue**: Static icon in command definition overrides dynamic menu icons.

**Example** (v2.17.222 - Blame toggle icon):

- Before: `"command": "svn.blame.toggleBlame", "icon": "$(eye)"` (static)
- After: Removed icon from command, only in menu contributions with `when` clauses
- Result: Icon changes based on context (eye → eye-closed → circle-slash)

**Pattern**:

1. Command definition: NO icon property
2. Menu contributions: Multiple entries with same command, different when clauses
3. Each menu entry has different icon based on context variables

**Anti-pattern**:

```json
"commands": [
  {"command": "foo", "icon": "$(eye)"}  // ❌ Overrides dynamic icons
]
```

**Best practice**:

```json
"menus": {
  "editor/title": [
    {"command": "foo", "when": "ctx == true", "icon": "$(eye)"},
    {"command": "foo", "when": "ctx == false", "icon": "$(eye-closed)"}
  ]
}
```

**Rule**: Dynamic icons require context-based menu entries, no command icon.

---

### 13. Remote Development: extensionKind Required

**Lesson**: SCM extensions must declare `extensionKind: ["workspace"]` for remote development.

**Issue** (v2.17.237):

- Extension activated on both local and remote in SSH sessions
- Caused "command already exists" error, breaking all functionality
- Silent failure: no error shown to user

**Fix**:

```json
"extensionKind": ["workspace"]
```

**Why**:

- SCM extensions need access to file system and CLI on remote
- `workspace` = run only on remote, not local
- Prevents duplicate command registration

**Rule**: Always add `extensionKind: ["workspace"]` for extensions needing remote file/CLI access.

---

### 14. Error Detection: Check Specific Patterns First

**Lesson**: When detecting error types, check specific patterns before generic ones.

**Issue** (v2.17.238):

- SVN returns E170013 (network) with E215004 (no credentials) on auth failure
- `getSvnErrorCode()` loop found E170013 first, returned "network error"
- Auth retry logic never triggered because error wasn't detected as auth error
- Users saw "Network error" when issue was actually missing credentials

**Fix**:

```typescript
// BEFORE: Generic loop finds E170013 first
for (const code of errorCodes) {
  if (stderr.includes(code)) return code; // E170013 wins
}
if (stderr.includes("No more credentials")) return "E170001"; // Never reached!

// AFTER: Check specific patterns FIRST
if (stderr.includes("E215004") || stderr.includes("No more credentials")) {
  return "E170001"; // Auth error takes priority
}
for (const code of errorCodes) { ... } // Generic codes
```

**Why**:

- SVN errors can have multiple codes in same stderr output
- Generic patterns (E170013) may mask specific ones (E215004)
- User action depends on correct error classification

**Rule**: Order error checks by specificity - specific patterns before generic ones.

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

**Document Version**: 2.2
**Last Updated**: 2025-11-27
