# Test Suite - Detailed File References

## Files with High-Impact Issues

### 1. BRITTLE MOCK PATTERNS - Files to Refactor

**Priority 1: Commands Tests**
- `/src/test/unit/commands/commit.test.ts` (lines 12-91)
  - Issue: 4 global mocks manually restored
  - Size: ~200 lines, 30 lines boilerplate
  - Impact: High (used pattern throughout)

- `/src/test/unit/commands/checkout.test.ts` (lines 14-130)
  - Issue: 6 global mocks manually restored
  - Size: ~250 lines, 40 lines boilerplate
  - Impact: High

- `/src/test/unit/commands/addRemove.test.ts` (lines 20-32)
  - Issue: Mock repository setup
  - Size: Manual object mocks

- `/src/test/unit/commands/revert.test.ts`
  - Issue: Manual mock pattern

- `/src/test/unit/services/statusService.test.ts` (lines 15-49)
  - Issue: Workspace config mocked manually
  - Size: 35 lines boilerplate

### 2. MISSING ERROR HANDLING TESTS

**Parser Files (0 error tests each)**
- `/src/test/unit/parsers/statusParser.test.ts` - Add error suite
- `/src/test/unit/parsers/logParser.test.ts` - Add error suite
- `/src/test/unit/parsers/blameParser.test.ts` - Add error suite
- `/src/test/unit/parsers/infoParser.test.ts` - Add error suite
- `/src/test/unit/parsers/listParser.test.ts` - Add error suite
- `/src/test/unit/parsers/diffParser.test.ts` - Add error suite

**Error Scenarios Missing**:
- Auth failures (0 tests)
- Permission errors (0 tests)
- File locks (0 tests)
- Network timeouts (0 tests)

### 3. WEAK ASSERTIONS - Files to Strengthen

- `/src/test/unit/commands/addRemove.test.ts` (line 39)
  - Pattern: `assert.ok(true, "Should handle Resource instance");`
  - Should validate actual method calls

- `/src/test/unit/blame/blameConfiguration.test.ts` (lines 14-46)
  - Pattern: Type checks only `assert.strictEqual(typeof enabled, "boolean")`
  - Should verify impact of configuration

- `/test/unit/repository/blame.test.ts` (lines 37-59)
  - Pattern: Trivial assertions on cache keys
  - Should test actual caching behavior

- `/src/test/unit/blame/lruCache.test.ts`
  - Pattern: Existence checks
  - Should test eviction behavior

### 4. MISSING INTEGRATION TESTS

Current integration tests:
- `/src/test/repository.test.ts` - Uses temp SVN repos (good)
- `/src/test/svnRepository.test.ts` - Partial coverage

Missing workflows:
- [ ] Checkout → Add → Commit flow
- [ ] Update with remote changes
- [ ] Conflict detection and resolution
- [ ] Blame on committed files
- [ ] Status accuracy across operations
- [ ] SVN externals handling

### 5. MISSING COMMAND TESTS (27 Total)

**High Priority (Error-Prone)**:
- [ ] `/src/test/unit/commands/merge.test.ts` - **MISSING**
- [ ] `/src/test/unit/commands/switch.test.ts` - **MISSING**
- [ ] `/src/test/unit/commands/resolve.test.ts` - **MISSING**
- [ ] `/src/test/unit/commands/cleanup.test.ts` - **MISSING**
- [ ] `/src/test/unit/commands/patch.test.ts` - **MISSING**
- [ ] `/src/test/unit/commands/ignore.test.ts` - **MISSING**

**Medium Priority**:
- [ ] `/src/test/unit/commands/promptRemove.test.ts` - **MISSING**
- [ ] `/src/test/unit/commands/searchLog.test.ts` - **MISSING**
- [ ] `/src/test/unit/commands/openCommands.test.ts` - **MISSING** (multiple variants)

**Low Priority**:
- 15+ other command files without tests

### 6. MISSING CONCURRENCY TESTS

**File to Create**: `/test/unit/concurrency/operations.test.ts` (8-10 tests)

Test scenarios:
- [ ] Parallel status checks don't interfere
- [ ] File add blocks concurrent blame request
- [ ] Cancel in-flight blame request
- [ ] Status refresh during commit
- [ ] Concurrent file adds execute sequentially
- [ ] Log fetch doesn't block status
- [ ] Blame cancellation mid-parse
- [ ] Resource state consistency during concurrent ops
- [ ] Error in one parallel op doesn't affect others

### 7. TIMEOUT INCONSISTENCIES

Files with timeout handling:
- `/src/test/repository.test.ts` (line 80) - 60000ms timeout
- `/src/test/extension.test.ts` (line 20) - 60000ms timeout
- 8 other files scattered

**Issue**: No consistent strategy
- Unit tests should timeout at 5000ms
- Integration tests at 30000ms
- Missing timeout/retry logic for SVN commands

### 8. INCOMPLETE MOCK VERIFICATION

Files with unverified mocks:
- `/src/test/unit/commands/checkout.test.ts`
  - Creates 8 call tracking arrays but doesn't verify all

- `/src/test/unit/commands/commit.test.ts`
  - Lines 21-25: Arrays created but not fully used

- `/src/test/unit/commands/addRemove.test.ts`
  - Mock repository has methods but verification is incomplete

### 9. WEAK PERFORMANCE TESTS

Files with trivial tests:
- `/test/unit/performance/repo-lookup.test.ts`
  - Lines 13-56: Tests logic without timing
  - Should measure actual performance

- `/test/unit/performance/glob-matching.test.ts`
  - Verifies optimization exists but no measurements

- `/test/unit/performance/status-check.test.ts`
  - Cache optimization tested without measurement

- `/test/unit/performance/blame-*.test.ts` (multiple)
  - Rendering tests without actual timing

### 10. MISSING LARGE FILE TESTS

**Untested features**:
- Blame file limit config: `svn.blame.largeFileLimit` (3000 lines)
  - Configuration exists but no tests

- Blame warning setting: `svn.blame.largeFileWarning`
  - No tests for warning display

- Status check on large repos
  - No tests for performance

---

## Test Statistics by Category

### Command Tests
```
Total Commands: 47
Tested: 20
Untested: 27
Coverage: 43%

Tested Files:
- add.test.ts
- addRemove.test.ts
- changelist.test.ts
- checkout.test.ts
- cleanup.test.ts (listed but verify)
- commit.test.ts
- ignore.test.ts
- log.test.ts
- merge.test.ts (listed but verify)
- open.test.ts
- patch.test.ts (listed but verify)
- prompt.test.ts
- rename.test.ts
- resolve.test.ts (listed but verify)
- revert.test.ts
- revertAll.test.ts
- switch.test.ts (listed but verify)
- unversioned.test.ts
- update.test.ts
- (and 1 more)
```

### Parser Tests
```
Total Parsers: 6
Tested: All 6 have basic tests
Error Handling: 0

Files:
- blameParser.test.ts (6 tests)
- diffParser.test.ts (5 tests)
- infoParser.test.ts (4 tests)
- listParser.test.ts (4 tests)
- logParser.test.ts (5 tests)
- statusParser.test.ts (3 tests)
```

### Service Tests
```
Services: 5
- authService.test.ts (6 tests)
- remoteChangeService.test.ts (limited)
- statusService.test.ts (3 tests)
- fileOperations.test.ts (partial)
- resourceGroupManager.test.ts (basic)
```

### Blame Feature Tests
```
Files: 15+ test files
Actual behavior tests: ~40% (mostly trivial)
Real rendering tests: ~10%

Test files:
- blameCommands.test.ts
- blameConfiguration.test.ts
- blameProvider.test.ts
- blameStateManager.test.ts
- colorHashing.test.ts
- documentChangeFlicker.test.ts
- gutterIcons.test.ts
- inlineCursor.test.ts
- lruCache.test.ts
- messageFetching.test.ts
- progressiveRendering.test.ts
- svgGeneration.test.ts
- svgUriFormats.test.ts
- templateCompiler.test.ts
- textFormatting.test.ts
```

### Performance Tests
```
Files: 11
Actual measurements: 0
Trivial tests: 11

Files:
- batch-operations.test.ts
- commit-traversal.test.ts
- concurrency-limit.test.ts
- config-cache.test.ts
- decorator-overhead.test.ts
- descendant-resolution.test.ts
- glob-matching.test.ts
- model-state-cache.test.ts
- repo-lookup.test.ts
- ui-blocking.test.ts
(and more)
```

---

## Recommended Implementation Order

### Week 1 Tasks (Priority: HIGH)
1. **commit.test.ts** - Refactor to Sinon (template)
2. **statusParser.test.ts** - Add error suite
3. **addRemove.test.ts** - Fix weak assertions
4. Create `/test/unit/concurrency/operations.test.ts`
5. Create `/test/integration/workflows.test.ts`

### Week 2 Tasks (Priority: MEDIUM)
1. **merge.test.ts** - Create new (high priority command)
2. **switch.test.ts** - Create new (high priority command)
3. **resolve.test.ts** - Create new (high priority command)
4. Create error scenario suites (auth, permissions, locks)

### Week 3 Tasks (Priority: LOW)
1. Enhance performance tests with measurements
2. Add encoding/character tests
3. Create remaining command tests

---

## File Path Quick Reference

```
Main Test Directories:
/src/test/ - Integration/legacy tests
/test/unit/ - Newer unit tests

Organization:
/src/test/
  - repository.test.ts (integration)
  - extension.test.ts
  - unit/
    - blame/
    - commands/
    - parsers/
    - security/
    - services/
    - util/
    - validation/
    - watchers/

/test/unit/
  - commands/
  - decorators/
  - historyView/
  - parsers/
  - performance/
  - positron/
  - security/
  - util/
```

