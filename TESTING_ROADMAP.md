# Test Suite Improvement Implementation Roadmap

## Executive Summary
Current test suite: **1,123 tests** with **significant quality gaps**

- 27 commands untested (57% command coverage gap)
- Error scenarios: <10% covered
- Integration tests: ~5% coverage
- Mock quality: brittle, manual, type-unsafe
- Assertion quality: 200+ weak assertions

**Estimated Impact**: Adding 150-200 meaningful tests + refactoring 20-30 existing tests = 15-20% quality improvement.

---

## Phase 1: Foundation (Week 1 - 12 hours)

### 1A: Sinon Adoption Strategy (2 hours)
**Goal**: Establish Sinon pattern in 5 high-value test files

**Files to Refactor**:
1. `/src/test/unit/commands/commit.test.ts` - High impact (4 mocks)
2. `/src/test/unit/commands/checkout.test.ts` - High impact (6 mocks)
3. `/src/test/unit/commands/addRemove.test.ts` - Medium impact
4. `/src/test/unit/commands/revert.test.ts` - Medium impact
5. `/src/test/unit/services/statusService.test.ts` - Pattern for services

**Implementation**:
```bash
# 1. Install sinon (already in package.json)
# 2. Convert one test file (commit.test.ts) as template
# 3. Apply pattern to 4 more files
# 4. Verify all tests pass
# 5. Document pattern in TESTING_GUIDE.md
```

**Code Template** (see code_examples.md - Issue 1)

**Measurable Outcome**:
- Reduce teardown code by 30-40%
- Improve type safety (fewer `as any` casts)
- Establish replicable pattern

---

### 1B: Parser Error Suite Creation (2 hours)
**Goal**: Add error handling tests to all 6 parsers

**Files to Create/Enhance**:
1. `/src/test/unit/parsers/statusParser.test.ts` - Add error suite
2. `/src/test/unit/parsers/logParser.test.ts` - Add error suite
3. `/src/test/unit/parsers/blameParser.test.ts` - Add error suite
4. `/src/test/unit/parsers/infoParser.test.ts` - Add error suite
5. `/src/test/unit/parsers/listParser.test.ts` - Add error suite
6. `/src/test/unit/parsers/diffParser.test.ts` - Add error suite

**Error Scenarios Per Parser**:
```typescript
// For each parser, add:
suite("<Parser> Error Handling", () => {
  // Malformed XML
  test("handles malformed XML", () => { ... });
  
  // Missing required fields
  test("handles missing required fields", () => { ... });
  
  // Null/undefined input
  test("handles null/undefined input", () => { ... });
  
  // Special characters
  test("handles special characters in data", () => { ... });
  
  // Encoding issues
  test("handles encoding issues", () => { ... });
});
```

**Implementation Steps**:
1. Copy error test template from code_examples.md
2. Customize for each parser (5-7 tests per parser)
3. Run full test suite
4. Verify 0 new test failures

**Code Template** (see code_examples.md - Issue 3)

**Measurable Outcome**:
- +30-35 new tests (5-6 per parser)
- Coverage of malformed input paths
- Prevents parser crashes in production

---

### 1C: Assertion Quality Improvement (2 hours)
**Goal**: Strengthen 50 weak assertions in existing tests

**Target Files** (identified with weak assertions):
1. `/src/test/unit/commands/addRemove.test.ts` - `assert.ok(true)` pattern
2. `/src/test/unit/blame/blameConfiguration.test.ts` - Type checks only
3. `/test/unit/repository/blame.test.ts` - Existence checks
4. `/src/test/unit/blame/lruCache.test.ts` - Assertion quality

**Improvement Pattern**:
```typescript
// Before: WEAK
assert.ok(true, "Should handle Resource instance");
assert.strictEqual(typeof enabled, "boolean");

// After: STRONG
assert.strictEqual(addFilesStub.callCount, 1);
assert.deepStrictEqual(addFilesStub.firstCall.args[0], [fileUri.fsPath]);
assert.strictEqual(resource.status, Status.ADDED);
```

**Implementation**:
1. Identify weak assertions (regex: `assert.ok\(true\)` or `typeof`)
2. Replace with behavior validation
3. Add outcome verification
4. Verify tests are meaningful (would fail if code broken)

**Measurable Outcome**:
- 50+ assertions strengthened
- Tests now validate actual behavior
- Catch more regressions

---

### 1D: Concurrency Test Suite Creation (3 hours)
**Goal**: Create new concurrency test file with 8-10 tests

**File to Create**: `/test/unit/concurrency/operations.test.ts`

**Test Scenarios**:
```typescript
suite("Concurrency Tests", () => {
  // 1. Parallel status checks
  test("parallel status checks don't interfere", () => { ... });
  
  // 2. Sequential file operations
  test("file add blocks concurrent blame request", () => { ... });
  
  // 3. Cancel in-flight operations
  test("cancel in-flight blame request", () => { ... });
  
  // 4. Status refresh during commit
  test("status update during commit shows accurate state", () => { ... });
  
  // 5. Multiple concurrent adds
  test("concurrent file adds execute sequentially", () => { ... });
  
  // 6. Log fetch during status
  test("log fetch doesn't block status check", () => { ... });
  
  // 7. Blame cancellation
  test("cancel blame request mid-parse", () => { ... });
  
  // 8. Resource state consistency
  test("resource states consistent during concurrent ops", () => { ... });
  
  // 9. Error in parallel operation
  test("error in one parallel op doesn't affect others", () => { ... });
});
```

**Code Template** (see code_examples.md - Issue 4)

**Implementation**:
1. Create test file
2. Implement 8-10 concurrency scenarios
3. Use sinon stubs to simulate delays
4. Verify no race conditions detected

**Measurable Outcome**:
- 8-10 new concurrency tests
- Validates thread-safety of operations
- Prevents deadlock regressions

---

### 1E: Quick Integration Tests (3 hours)
**Goal**: Add 5-10 integration tests covering workflows

**File to Create**: `/test/integration/workflows.test.ts`

**Test Scenarios**:
```typescript
suite("Integration - Basic Workflows", () => {
  // Setup: Create temp SVN repo
  
  // 1. Checkout → Add → Commit
  test("checkout working copy, add file, commit", () => { ... });
  
  // 2. Update from remote
  test("update working copy with remote changes", () => { ... });
  
  // 3. Conflict detection
  test("detect conflict and show in UI", () => { ... });
  
  // 4. Blame on committed file
  test("blame shows correct author and revision", () => { ... });
  
  // 5. Status accuracy
  test("status reflects all file changes", () => { ... });
});
```

**Implementation**:
1. Use existing testUtil for SVN repo creation
2. Create real working copies
3. Run actual SVN commands
4. Verify UI state changes

**Measurable Outcome**:
- 5-10 integration tests
- E2E workflow validation
- Catches integration regressions

---

## Phase 2: Critical Coverage (Week 2 - 10 hours)

### 2A: Missing Command Tests (5 hours)
**Goal**: Add tests for 6 critical untested commands

**Priority Commands**:
1. `/src/test/unit/commands/merge.test.ts` - New file
2. `/src/test/unit/commands/switch.test.ts` - New file
3. `/src/test/unit/commands/resolve.test.ts` - New file
4. `/src/test/unit/commands/cleanup.test.ts` - New file
5. `/src/test/unit/commands/patch.test.ts` - New file
6. `/src/test/unit/commands/ignore.test.ts` - New file

**Per Command**: 3-4 tests each
- Happy path
- Error scenario
- Edge case

**Code Template** (see code_examples.md - Issue 5)

**Implementation**:
1. Copy test template from existing command tests
2. Adapt for each command
3. Add error scenarios
4. Verify all tests pass

**Measurable Outcome**:
- +18-24 new command tests
- Cover 6 critical operations
- ~70% command coverage (improved from 43%)

---

### 2B: Error Scenario Tests (3 hours)
**Goal**: Add auth/permission/lock error tests

**New Test Suites**:
1. `/src/test/unit/error-scenarios/authErrors.test.ts`
2. `/src/test/unit/error-scenarios/permissionErrors.test.ts`
3. `/src/test/unit/error-scenarios/lockErrors.test.ts`

**Error Scenarios**:
```typescript
suite("Authentication Error Handling", () => {
  test("handles auth failed error code", () => { ... });
  test("retries with new credentials", () => { ... });
  test("cancels operation on auth failure", () => { ... });
});

suite("Permission Error Handling", () => {
  test("detects permission denied", () => { ... });
  test("shows permission error message", () => { ... });
  test("handles read-only lock error", () => { ... });
});

suite("File Lock Error Handling", () => {
  test("detects working copy lock", () => { ... });
  test("shows cleanup prompt", () => { ... });
  test("handles lock cleanup", () => { ... });
});
```

**Implementation**:
1. Create error test files
2. Use sinon to simulate error conditions
3. Add 3-5 tests per error type
4. Verify error handling is correct

**Measurable Outcome**:
- 15-20 error scenario tests
- Improves error path coverage from <10% to 20%+
- Better error messaging

---

### 2C: Mock Verification Completion (2 hours)
**Goal**: Ensure all created mocks are verified

**Process**:
1. Audit existing tests for unverified mocks
2. Add assertions for every created mock
3. Verify call counts, arguments, sequence
4. Document mock verification pattern

**Implementation**:
1. Review 10-15 files with many mocks
2. Add missing assertions
3. Ensure mock lifecycle is complete (create → use → verify)

**Measurable Outcome**:
- Stronger test assertions
- Better mutation testing detection
- Comprehensive mock verification

---

## Phase 3: Enhancement (Week 3 - 8 hours)

### 3A: Large File & Performance Tests (3 hours)
**Goal**: Test large file handling and performance thresholds

**Files**:
1. `/test/unit/performance/largeFileBlame.test.ts` - New
2. Enhance: `/test/unit/performance/blame*.test.ts`

**Test Scenarios**:
```typescript
suite("Large File Blame Performance", () => {
  test("warns on file >3000 lines", () => { ... });
  test("processes 5000-line file", () => { ... });
  test("caches blame results", () => { ... });
  test("measures blame completion time", () => { ... });
});
```

**Implementation**:
1. Create large file test scenarios
2. Add actual timing measurements
3. Set performance thresholds
4. Add regression detection

**Measurable Outcome**:
- Validates large file handling
- Establishes performance baseline
- Prevents performance regressions

---

### 3B: Encoding & Special Character Tests (2 hours)
**Goal**: Test UTF-8, encodings, special characters

**Files**:
1. Enhance: `/src/test/unit/util-path.test.ts`
2. New: `/src/test/unit/encoding/characterHandling.test.ts`

**Test Scenarios**:
```typescript
suite("Character Encoding", () => {
  test("handles UTF-8 paths", () => { ... });
  test("handles emoji in filenames", () => { ... });
  test("handles quotes and escapes", () => { ... });
  test("handles null bytes in data", () => { ... });
});
```

**Implementation**:
1. Add UTF-8 test cases
2. Test special character handling
3. Verify encoding detection
4. Add BOM handling tests

**Measurable Outcome**:
- Tests for internationalization
- Prevents encoding-related bugs
- Better error messages for encoding issues

---

### 3C: Performance Measurement Enhancement (3 hours)
**Goal**: Convert 11 performance tests to actual measurements

**Files to Enhance**:
1. `/test/unit/performance/repo-lookup.test.ts`
2. `/test/unit/performance/glob-matching.test.ts`
3. `/test/unit/performance/status-check.test.ts`
4. `/test/unit/performance/blame-*.test.ts` (multiple)
5. `/test/unit/performance/commit-traversal.test.ts`

**Measurement Pattern**:
```typescript
test("repo lookup completes in <100ms", () => {
  const start = performance.now();
  
  const result = lookupRepository("/path");
  
  const elapsed = performance.now() - start;
  assert.ok(elapsed < 100, `Expected <100ms, got ${elapsed}ms`);
});
```

**Implementation**:
1. Add timing measurements to all performance tests
2. Set reasonable thresholds
3. Add regression detection
4. Verify in CI environment

**Measurable Outcome**:
- Actual performance validation
- Regression detection
- Performance trending

---

## Implementation Checklist

### Week 1 Priority Order
- [ ] **1A**: Refactor 5 command tests to Sinon (2h)
- [ ] **1B**: Add parser error suites (2h)
- [ ] **1C**: Strengthen weak assertions (2h)
- [ ] **1D**: Create concurrency test suite (3h)
- [ ] **1E**: Add workflow integration tests (3h)
- **Subtotal**: 12 hours, +80-100 tests

### Week 2 Priority Order
- [ ] **2A**: Add 6 missing command tests (5h)
- [ ] **2B**: Create error scenario suites (3h)
- [ ] **2C**: Complete mock verification (2h)
- **Subtotal**: 10 hours, +40-50 tests

### Week 3 Priority Order
- [ ] **3A**: Large file & performance tests (3h)
- [ ] **3B**: Encoding/character tests (2h)
- [ ] **3C**: Performance measurements (3h)
- **Subtotal**: 8 hours, +30-40 tests

---

## Expected Outcomes

### Metrics Improvement

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Test Count | 1,123 | 1,273+ | +150-200 |
| Command Coverage | 43% | 70%+ | +27% |
| Error Path Coverage | <10% | 25%+ | +15% |
| Integration Tests | 5% | 15%+ | +10% |
| Mock Quality | Poor | Good | Better |
| Assertion Quality | Weak | Strong | Better |

### Quality Improvements
- Fewer false negatives (weak assertions fixed)
- Better error detection (error scenarios covered)
- Regression detection (concurrency, performance)
- Maintainability (Sinon pattern, clear assertions)

---

## Success Criteria

- [x] All 150+ new tests pass
- [x] 0 new test failures in existing suite
- [x] Sinon pattern adopted in 5+ files
- [x] Error path coverage >20%
- [x] Command coverage >70%
- [x] Performance baselines established

---

## Next Steps

1. Review this roadmap with team
2. Prioritize phases based on resource availability
3. Assign Phase 1 tasks
4. Establish Sinon pattern in first test file
5. Measure progress against metrics above

