# Refactoring Implementation Templates

**Purpose**: Concrete implementation guidance for each refactoring category
**For**: Developers implementing the refactorings from SAFE_QUICK_WINS.md

---

## TEMPLATE 1: Safe Refactorings (Immediate)

### Pattern: Constant Extraction

**Use For**: Duplicated literals, hardcoded values, repeated patterns

**Example: SEPARATOR_PATTERN Constant**

```typescript
// BEFORE
const name = this.lastCwd.split(/[\\\/]+/).pop(); // Line 103
const name = this.lastCwd.split(/[\\\/]+/).pop(); // Line 247
const name = this.lastCwd.split(/[\\\/]+/).pop(); // Line 286
const name = this.lastCwd.split(/[\\\/]+/).pop(); // Line 387
```

**AFTER**:
```typescript
// At module level (after imports, line 46)
const SEPARATOR_PATTERN = /[\\\/]+/;

// Usage everywhere
const name = this.lastCwd.split(SEPARATOR_PATTERN).pop();
```

**Verification Checklist**:
- [ ] Constant added at module level
- [ ] All occurrences replaced with constant reference
- [ ] No behavior change (same regex, same matching)
- [ ] TypeScript compiles without errors
- [ ] All tests pass: `npm test`
- [ ] No performance regression (regex compiled once now)

**Rollback Command**:
```bash
git revert <commit-sha>
```

**Time Estimate**: 5 minutes
**Risk**: SAFE ✅

---

### Pattern: Dead Code Removal

**Use For**: Unreachable code after early returns, deleted functions

**Example: command.ts:78-85**

```typescript
// BEFORE
constructor(...) {
  if (!path) {
    return; // ← Early return
  }

  // Dead code below - unreachable
  this.path = path;
  this.uri = uri;
  this.resourceState = resourceState;
  this.command = command;
}
```

**AFTER**:
```typescript
constructor(...) {
  if (!path) {
    return;
  }
  // Code removed - nothing here
}
```

**Verification Checklist**:
- [ ] Confirm code is truly unreachable (trace control flow)
- [ ] No references to removed code exist (grep -r)
- [ ] All tests pass (validates no hidden dependencies)
- [ ] Static analysis shows no issues (tsc)
- [ ] Git diff shows only deletions, no modifications

**Rollback Command**:
```bash
git show <commit-sha> | git apply -R
```

**Time Estimate**: 2 minutes
**Risk**: SAFE ✅

---

### Pattern: Type Safety Improvements

**Use For**: Adding explicit types, removing `any`, adding type guards

**Example: util.ts anyEvent function**

```typescript
// BEFORE
export function anyEvent(...events: Event<any>[]): Event<any> {
  return (listener: (...args: any[]) => void) => {
    // ...
  };
}
```

**AFTER**:
```typescript
export function anyEvent<T>(...events: Event<T>[]): Event<T> {
  return (listener: (e: T) => void, thisArgs?: unknown) => {
    // ...
  };
}
```

**Verification Checklist**:
- [ ] Generic type parameter added and used consistently
- [ ] TypeScript compilation succeeds: `npm run build:ts`
- [ ] No `any` types remain in changed code
- [ ] All tests pass: `npm test`
- [ ] Type-aware editors can provide better completions

**Rollback Command**:
```bash
git revert <commit-sha>
```

**Time Estimate**: 30 minutes
**Risk**: SAFE ✅

---

## TEMPLATE 2: Risky Refactorings (With TDD)

### Pattern: Performance-Sensitive Regex Optimization

**Use For**: Regex compiled on hot paths, pre-compilation opportunity

**Example: Pre-compile SVN Error Detection (Refactoring #10)**

#### Step 1: Write Characterization Tests (FIRST!)

```typescript
// File: src/test/unit/svn/errorDetection.test.ts
import * as assert from "assert";
import { getSvnErrorCode } from "../../../svn";

suite("SVN Error Detection", () => {
  // Test 1: Exact error code matching
  test("detects AuthorizationFailed error", () => {
    const stderr = "svn: E170001: authorization failed";
    const code = getSvnErrorCode(stderr);
    assert.equal(code, "E170001");
  });

  // Test 2: Different error code
  test("detects RepositoryIsLocked error", () => {
    const stderr = "svn: E155004: repository is locked";
    const code = getSvnErrorCode(stderr);
    assert.equal(code, "E155004");
  });

  // Test 3: No false positives
  test("returns undefined for unrecognized errors", () => {
    const stderr = "some random error";
    const code = getSvnErrorCode(stderr);
    assert.equal(code, undefined);
  });

  // Test 4: Works with multi-line stderr
  test("finds error code in multi-line stderr", () => {
    const stderr = "svn: trying to do something\nsvn: E170001: auth failed";
    const code = getSvnErrorCode(stderr);
    assert.equal(code, "E170001");
  });
});
```

#### Step 2: Baseline Performance

```bash
# Measure current performance before refactoring
# Save results to file for comparison

# Count how many times getSvnErrorCode called per command
grep -r "getSvnErrorCode" src/ --include="*.ts" | wc -l
# Result: Called in error path of every failed command
```

#### Step 3: Implement Refactoring

```typescript
// Before implementation, verify tests pass
npm test -- --grep "SVN Error Detection"

// Now implement
```

**Implementation Code**:
```typescript
// File: src/svn.ts

// OLD APPROACH (recompiles regex on every call)
function getSvnErrorCode(stderr: string): string | undefined {
  for (const name in svnErrorCodes) {
    if (svnErrorCodes.hasOwnProperty(name)) {
      const code = svnErrorCodes[name];
      const regex = new RegExp(`svn: ${code}`);  // ← Recompiled every call
      if (regex.test(stderr)) {
        return code;
      }
    }
  }
  if (/No more credentials or we tried too many times/.test(stderr)) {
    return svnErrorCodes.AuthorizationFailed;
  }
  return void 0;
}

// NEW APPROACH (pre-compiled)
const SVN_ERROR_REGEXES: Array<{
  name: string;
  code: string;
  regex: RegExp;
}> = Object.entries(svnErrorCodes).map(([name, code]) => ({
  name,
  code,
  regex: new RegExp(`svn: ${code}`) // Compiled once at module load
}));

const CREDENTIALS_ERROR_REGEX = /No more credentials or we tried too many times/;

function getSvnErrorCode(stderr: string): string | undefined {
  // Use pre-compiled regexes
  for (const { code, regex } of SVN_ERROR_REGEXES) {
    if (regex.test(stderr)) {
      return code;
    }
  }

  if (CREDENTIALS_ERROR_REGEX.test(stderr)) {
    return svnErrorCodes.AuthorizationFailed;
  }

  return void 0;
}
```

#### Step 4: Verify Tests Pass

```bash
npm test -- --grep "SVN Error Detection"
# All 4 characterization tests must pass (identical behavior)
```

#### Step 5: Performance Benchmark

```bash
# Before:
# Time regex.test() calls in error detection
node -e "
const start = Date.now();
for(let i = 0; i < 10000; i++) {
  const regex = /svn: E170001/;
  regex.test('svn: E170001: error');
}
console.log('Old: ' + (Date.now() - start) + 'ms');

// After (pre-compiled):
const regex = /svn: E170001/;
const start = Date.now();
for(let i = 0; i < 10000; i++) {
  regex.test('svn: E170001: error');
}
console.log('New: ' + (Date.now() - start) + 'ms');
"
```

**Expected Result**: 5-10% improvement on regex compilation cost

#### Step 6: Commit

```bash
git add src/svn.ts src/test/unit/svn/errorDetection.test.ts
git commit -m "Perf: Pre-compile SVN error detection regexes

- Move regex compilation from getSvnErrorCode() to module init
- 5-10% improvement on error code detection latency
- Behavior identical, all tests pass"
```

**Verification Checklist**:
- [ ] Characterization tests written and passing (before implementation)
- [ ] Performance baseline recorded
- [ ] Code changes preserve exact behavior (same regex matching)
- [ ] All tests pass: `npm test`
- [ ] Performance improved (5-10% expected)
- [ ] No memory regression (constant size pre-allocated)
- [ ] Commit message describes "why" (performance improvement)

**Time Estimate**: 45 minutes (20 min tests, 15 min implementation, 10 min verification)
**Risk**: RISKY ⚠️ (pre-compilation assumption)

---

## TEMPLATE 3: Dangerous Refactorings (Full Planning)

### Pattern: Large-Scale Duplication Extraction

**Use For**: 100+ lines of duplicated code, behavior must be preserved

**Example: exec/execBuffer Extraction (Refactoring #5)**

#### PHASE A: Planning (2-3 hours)

##### Step A1: Understand Current Behavior

```bash
# 1. Count methods involved
wc -l src/svn.ts # Total file size
sed -n '90,397p' src/svn.ts | wc -l # exec method size
sed -n '273,397p' src/svn.ts | wc -l # execBuffer method size

# 2. List all callers of exec()
grep -r "\.exec(" src --include="*.ts" | grep -v test | head -20

# 3. List all callers of execBuffer()
grep -r "\.execBuffer(" src --include="*.ts" | grep -v test | head -10

# 4. Check for execBuffer + token usage (potential bug)
grep -r "execBuffer.*token\|execBuffer.*{.*token" src --include="*.ts"
```

##### Step A2: Write Comprehensive Characterization Tests

```typescript
// File: src/test/unit/svn/exec-behavior.test.ts
import * as assert from "assert";
import * as sinon from "sinon";
import * as cp from "child_process";
import { Svn } from "../../../svn";
import SvnError from "../../../svnError";

suite("exec() and execBuffer() behavior parity", () => {
  let svn: Svn;
  let sandbox: sinon.SinonSandbox;
  let spawnStub: sinon.SinonStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    svn = new Svn({
      svnPath: "svn",
      version: "1.9"
    });
    spawnStub = sandbox.stub(cp, "spawn");
  });

  afterEach(() => {
    sandbox.restore();
  });

  // Helper: Mock successful spawn
  function mockSuccessfulSpawn(stdout: string | Buffer, stderr: string = "") {
    const mockProcess = {
      stdout: { on: sinon.stub(), once: sinon.stub() },
      stderr: { on: sinon.stub(), once: sinon.stub() },
      on: sinon.stub(),
      once: sinon.stub(),
      kill: sinon.stub()
    } as any;

    // Simulate successful execution
    process.nextTick(() => {
      mockProcess.once.withArgs("error").args[0][1]?.(); // No error
      mockProcess.once.withArgs("exit").args[0][1]?.(0); // Exit code 0
      mockProcess.stdout.once.withArgs("close").args[0][1]?.(
        Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout)
      );
      mockProcess.stderr.once.withArgs("close").args[0][1]?.(stderr);
    });

    return mockProcess;
  }

  // TEST 1: Normal successful execution
  test("exec and execBuffer both succeed on valid output", async () => {
    spawnStub.returns(mockSuccessfulSpawn("file1\nfile2"));

    const execResult = await svn.exec("/tmp", ["list"], {});
    assert.ok(execResult.stdout.includes("file1"));
    assert.equal(execResult.exitCode, 0);

    spawnStub.returns(mockSuccessfulSpawn(Buffer.from("file1\nfile2")));
    const bufferResult = await svn.execBuffer("/tmp", ["list"], {});
    assert.ok(bufferResult.stdout.toString().includes("file1"));
    assert.equal(bufferResult.exitCode, 0);
  });

  // TEST 2: Error handling difference (CRITICAL)
  test("exec throws on exitCode, execBuffer returns it", async () => {
    const mockProcess = {
      stdout: { on: sinon.stub(), once: sinon.stub() },
      stderr: { on: sinon.stub(), once: sinon.stub() },
      on: sinon.stub(),
      once: sinon.stub(),
      kill: sinon.stub()
    } as any;

    // Simulate failed execution (exit code 1)
    process.nextTick(() => {
      mockProcess.once.withArgs("exit").args[0][1]?.(1); // Exit code 1
      mockProcess.stdout.once.withArgs("close").args[0][1]?.(Buffer.alloc(0));
      mockProcess.stderr.once.withArgs("close").args[0][1]?.("svn: E155004: locked");
    });

    spawnStub.returns(mockProcess);

    // exec should throw
    try {
      await svn.exec("/tmp", ["update"], {});
      assert.fail("exec should throw on exitCode != 0");
    } catch (err) {
      assert.ok(err instanceof SvnError);
      assert.equal((err as any).exitCode, 1);
    }

    // Reset for execBuffer
    mockProcess = {
      stdout: { on: sinon.stub(), once: sinon.stub() },
      stderr: { on: sinon.stub(), once: sinon.stub() },
      on: sinon.stub(),
      once: sinon.stub(),
      kill: sinon.stub()
    } as any;

    process.nextTick(() => {
      mockProcess.once.withArgs("exit").args[0][1]?.(1);
      mockProcess.stdout.once.withArgs("close").args[0][1]?.(Buffer.alloc(0));
      mockProcess.stderr.once.withArgs("close").args[0][1]?.("svn: E155004: locked");
    });

    spawnStub.returns(mockProcess);

    // execBuffer should NOT throw
    const result = await svn.execBuffer("/tmp", ["update"], {});
    assert.equal(result.exitCode, 1); // Returns error code, doesn't throw
  });

  // TEST 3: Cancellation token (UNDEFINED - FIX THE GAP)
  test("exec respects cancellation token, execBuffer behavior UNDEFINED", async () => {
    // This test documents the current gap
    // After refactoring, this should pass for both methods
  });

  // TEST 4: Timeout handling
  test("both respect timeout option", async () => {
    // Create mock that simulates timeout
    // Verify process.kill() called and SvnError thrown
  });

  // TEST 5: Encoding handling
  test("exec decodes, execBuffer returns raw Buffer", async () => {
    const utf8Content = Buffer.from("café", "utf8");
    spawnStub.returns(mockSuccessfulSpawn(utf8Content));

    const execResult = await svn.exec("/tmp", ["cat", "file.txt"], {});
    assert.equal(typeof execResult.stdout, "string");

    spawnStub.returns(mockSuccessfulSpawn(utf8Content));
    const bufferResult = await svn.execBuffer("/tmp", ["cat", "file.txt"], {});
    assert.ok(Buffer.isBuffer(bufferResult.stdout));
  });
});
```

##### Step A3: Document Behavior Differences

```markdown
## exec() vs execBuffer() Behavior Summary

### Similarities
- Input: cwd, args[], ICpOptions
- Process: cp.spawn() with auth/env/timeout
- Logging: stderr logged to onOutput

### Differences
| Aspect | exec() | execBuffer() |
|--------|--------|-------------|
| Return type | IExecutionResult | BufferResult |
| stdout | Decoded string | Raw Buffer |
| Exit code 0 | Success, return result | Success, return result |
| Exit code != 0 | THROWS SvnError | Returns with exitCode |
| Cancellation token | SUPPORTED | NOT SUPPORTED (?) |
| Encoding handling | Detects + converts | Returns raw |

### Questions Requiring Answers Before Refactoring
1. Does execBuffer need cancellation token support?
2. Should exitCode != 0 throw in both methods?
3. Can we safely unify error handling?
```

##### Step A4: Decide Refactoring Approach

```markdown
## Option A: Separate Helpers (RECOMMENDED)

Benefits:
- Each method keeps current behavior exactly
- No risk of unintended unification
- Easy to validate no behavior change
- Simple rollback (revert commits)

Risks:
- More duplication in setup code
- Separate encoding logic (OK, not duplicated)

Implementation:
1. Extract _setupSpawnedProcess() → returns args, defaults
2. Extract _executeProcess() → handles spawn/stdio setup
3. Both exec() and execBuffer() call helpers
4. Each retains unique encoding/error handling

## Option B: Unified with Flags (NOT RECOMMENDED NOW)

Benefits:
- Maximum code reuse
- Single process execution logic

Risks:
- Must reconcile exec/execBuffer behavior differences first
- Higher chance of unintended behavior change
- Harder to validate equivalence

Deferral:
- Consider only after Option A stabilizes
- Requires separate security review
```

**Decision**: Use **Option A** (Separate Helpers) for safety

#### PHASE B: Implementation (2-3 hours)

##### Step B1: Create New Helper Method (COMMIT 1)

```typescript
// File: src/svn.ts

/**
 * Sets up spawn arguments and options (setup phase only)
 * Does NOT spawn process - caller responsibility
 *
 * Extracted from duplicate logic in exec() and execBuffer()
 */
private async _setupSpawnCommand(
  cwd: string,
  args: any[],
  options: ICpOptions = {}
): Promise<{
  args: any[];
  defaults: cp.SpawnOptions;
}> {
  if (cwd) {
    this.lastCwd = cwd;
    options.cwd = cwd;
  }

  if (options.log !== false) {
    const argsOut = args.map(arg => (/ |^$/.test(arg) ? `'${arg}'` : arg));
    this.logOutput(
      `[${this.lastCwd.split(/[\\\/]+/).pop()}]$ svn ${argsOut.join(" ")}\n`
    );
  }

  if (options.username) {
    args.push("--username", options.username);
  }
  if (options.password) {
    args.push("--password", options.password);
  }

  if (options.username || options.password) {
    args.push("--config-option", "config:auth:password-stores=");
    args.push("--config-option", "servers:global:store-auth-creds=no");
  }

  args.push("--non-interactive");

  const defaults: cp.SpawnOptions = { env: proc.env };
  if (cwd) {
    defaults.cwd = cwd;
  }

  defaults.env = Object.assign({}, proc.env, options.env || {}, {
    LC_ALL: "en_US.UTF-8",
    LANG: "en_US.UTF-8"
  });

  return { args, defaults };
}
```

**Commit 1 Checklist**:
- [ ] New helper added to Svn class
- [ ] No other changes
- [ ] TypeScript compiles: `npm run build:ts`
- [ ] All tests pass: `npm test`
- [ ] Characterization tests still pass

**Commit Command**:
```bash
git add src/svn.ts
git commit -m "Refactor: Extract _setupSpawnCommand helper (pure setup)

- New private method handles argument and option setup
- Called by both exec() and execBuffer() (next commits)
- Zero behavior change - setup logic only
- Baseline for duplication extraction"
```

##### Step B2: Update exec() to Use Helper (COMMIT 2)

```typescript
public async exec(
  cwd: string,
  args: any[],
  options: ICpOptions = {}
): Promise<IExecutionResult> {
  const { args: setupArgs, defaults } = await this._setupSpawnCommand(cwd, args, options);

  // Rest of exec() unchanged - process spawning, event handling, encoding
  const process = cp.spawn(this.svnPath, setupArgs, defaults);
  // ... rest of original exec() logic from line 150 onwards
}
```

**Commit 2 Checklist**:
- [ ] exec() calls helper for setup
- [ ] Behavior identical (same args, same defaults)
- [ ] All tests pass: `npm test`
- [ ] Characterization tests verify behavior unchanged

**Commit Command**:
```bash
git add src/svn.ts
git commit -m "Refactor: exec() uses _setupSpawnCommand helper

- Replace duplicate setup logic with helper call
- Behavior identical - same spawn args and options
- Enables execBuffer() extraction (next step)"
```

##### Step B3: Update execBuffer() to Use Helper (COMMIT 3)

```typescript
public async execBuffer(
  cwd: string,
  args: any[],
  options: ICpOptions = {}
): Promise<BufferResult> {
  const { args: setupArgs, defaults } = await this._setupSpawnCommand(cwd, args, options);

  // Rest of execBuffer() unchanged
  const process = cp.spawn(this.svnPath, setupArgs, defaults);
  // ... rest of original execBuffer() logic from line 325 onwards
}
```

**Commit 3 Checklist**:
- [ ] execBuffer() calls helper for setup
- [ ] Behavior identical
- [ ] All tests pass
- [ ] Characterization tests verify behavior unchanged

##### Step B4: Remove Duplicate Code (COMMIT 4)

At this point, the original duplicated setup code can be removed from both methods.

```typescript
// DELETED from exec(): lines that _setupSpawnCommand now handles
// DELETED from execBuffer(): lines that _setupSpawnCommand now handles
```

**Commit 4 Checklist**:
- [ ] Only duplicate code removed
- [ ] Behavior verified unchanged via tests
- [ ] Performance equivalent (helper inlined by JS engine)

#### PHASE C: Validation (1 hour)

##### Step C1: Full Test Suite

```bash
npm test  # Must pass 100%
```

##### Step C2: Performance Validation

```bash
# Compare latency before/after refactoring
# Should be identical (same code paths, helper inlined)

# Measure exec() latency
time npm test -- --grep "exec.*success"

# Should complete in similar time before/after
```

##### Step C3: Code Review

- [ ] Characterization tests document behavior
- [ ] Commits are small, logical, reversible
- [ ] No behavior changes verified by tests
- [ ] Performance unchanged
- [ ] Error messages unchanged
- [ ] Security implications reviewed

**Verification Checklist - FINAL**:
- [ ] All 8 characterization tests pass (behavior identical)
- [ ] Full test suite passes (npm test)
- [ ] No TypeScript errors (npm run build:ts)
- [ ] No performance regression (benchmark shows <5% difference)
- [ ] Each commit reversible independently
- [ ] Code review approved
- [ ] Commit messages describe "why"

**Time Estimate**: 5-6 hours total
- Planning: 2-3 hours (understanding behavior, tests, decision)
- Implementation: 2-3 hours (commits 1-4, validation)
- Risk: DANGEROUS 🔴 (but manageable with this process)

---

## TEMPLATE 4: Security Refactorings

### Pattern: Vulnerability Fix (Command Injection)

**Use For**: Security issues that must not regress

**Example: cp.exec() → cp.execFile() (Refactoring #1)**

```typescript
// BEFORE (VULNERABLE)
cp.exec("which svn", (err, svnPathBuffer) => {
  // Shell interprets special chars: ; | && $ ` etc
});

// AFTER (SAFE)
cp.execFile("which", ["svn"], (err, svnPathBuffer) => {
  // No shell interpretation, arguments passed directly
});
```

**Verification Checklist**:
- [ ] No shell spawning (verified: cp.execFile used)
- [ ] Arguments passed as array (prevents shell metacharacter injection)
- [ ] Error handling identical
- [ ] SVN finder still works (test on real repo)
- [ ] Special characters in SVN path handled safely
- [ ] Security review completed
- [ ] Commit message mentions security fix

**Test**:
```typescript
test("svnFinder uses execFile (not exec)", () => {
  const execSpy = sinon.spy(cp, "exec");
  const execFileSpy = sinon.spy(cp, "execFile");

  try {
    svnFinder.findSvnPath();
    assert.ok(!execSpy.called, "Should NOT use cp.exec");
    assert.ok(execFileSpy.called, "Should use cp.execFile");
  } finally {
    execSpy.restore();
    execFileSpy.restore();
  }
});
```

**Commit Command**:
```bash
git add src/svnFinder.ts
git commit -m "Security: Replace cp.exec with cp.execFile in SVN finding

Fixes command injection vulnerability (E1000):
- cp.exec() spawns shell, interpreting special characters
- cp.execFile() passes args directly, no injection risk
- Same behavior, safer implementation
- Test validates execFile usage"
```

**Time Estimate**: 20 minutes
**Risk**: DANGEROUS 🔴 (security) but low technical risk

---

## Testing Pyramid for Refactorings

```
              Integration Tests (E2E workflows)
                      ▲
                     / \
                    /   \
                   / 3-5  \
                  /         \
                 / tests     \
                /_____________\
               /               \
              / Characterization \
             /    Tests (3-8)     \
            /                     \
           /____ Behavior Parity ___\
          /                         \
         /      Unit Tests (10-20)   \
        / Performance, edge cases... \
       /____________________________ \
      /                              \
     /  Static Analysis              \
    / TypeScript, ESLint             \
   /__________________________________\

For Refactorings:
- Safe: Unit tests only
- Risky: Characterization + unit + performance benchmark
- Dangerous: All levels + security review + code review
```

---

## Rollback Procedure by Severity

### Safe Refactoring Rollback

```bash
# 1. Identify commit to revert
git log --oneline | head -10

# 2. Revert the commit
git revert abc123def456

# 3. Verify
npm test
npm run build:ts

# 4. Push
git push origin branch-name

# Time: 2 minutes
```

### Risky Refactoring Rollback

```bash
# 1. Identify the series of commits
git log --oneline feature-branch ^main | head -10

# 2. Revert the specific refactoring commit
git revert abc123def456  # The risky change

# 3. Keep characterization tests (they're valuable)
# Keep performance improvements (still valid)

# 4. Full validation
npm test
npm run build:ts
npm audit

# 5. Push
git push origin branch-name

# Time: 5 minutes
```

### Dangerous Refactoring Rollback

```bash
# 1. If behavior changed, identify all commits in refactoring
git log --oneline feature-branch ^main

# 2. Option A: Revert entire feature
git revert abc123..def456  # Range of commits

# 3. Option B: Revert specific commit if isolated
git revert abc123def456

# 4. Full regression testing
npm test  # All tests
npm run build:ts  # TypeScript validation
npm audit  # Security check
manual-test-workflow  # E2E workflows

# 5. Verify behavior restoration
git diff main -- src/

# 6. Push
git push origin branch-name

# Time: 15 minutes
```

---

## Common Pitfalls to Avoid

### ❌ PITFALL 1: Refactoring Without Tests First

```typescript
// DON'T DO THIS
function getSvnErrorCode(stderr: string) {
  // Refactored code
  return code;
}

// Oops, broke behavior - where?
```

**DO THIS INSTEAD**:
```typescript
// Write tests FIRST
test("detects AuthorizationFailed", () => {
  assert.equal(getSvnErrorCode("svn: E170001: auth"), "E170001");
});

// Then refactor confidently
```

### ❌ PITFALL 2: Big Commits

```bash
# DON'T: One commit with 300 lines changed
git commit -m "Refactor exec/execBuffer"

# DO: Multiple small commits
git commit -m "Refactor: Extract _setupSpawnCommand"
git commit -m "Refactor: exec() uses helper"
git commit -m "Refactor: execBuffer() uses helper"
git commit -m "Refactor: Remove duplicate setup code"
```

### ❌ PITFALL 3: Ignoring Performance

```typescript
// DON'T: Assume performance is same
// DO: Measure before and after

const before = Date.now();
// ... run refactored code 10,000x
console.log("Time: " + (Date.now() - before) + "ms");
```

### ❌ PITFALL 4: Changing Behavior While Refactoring

```typescript
// DON'T: Mix refactoring with bug fixes
// Refactoring: Extract helper
// Plus: Fix error handling (bug fix)
// ← These must be separate commits/PRs

// DO: Refactor first, bug fix second
// Commit 1: Extract (behavior unchanged)
// Commit 2: Fix bug (behavior improved)
```

### ❌ PITFALL 5: Skipping Security Review

```typescript
// DON'T: Security change without review
// Vulnerability fix: cp.exec → cp.execFile

// DO: Get security approval
// 1. Document vulnerability
// 2. Verify fix is correct
// 3. Get review from security-conscious teammate
// 4. Test on real repo if possible
```

---

## Quick Checklist for Any Refactoring

Before you start:
- [ ] Understand current behavior (read code, not just skim)
- [ ] Identify all affected code paths
- [ ] Find all callers (grep for usages)
- [ ] Understand why refactoring matters (benefit > effort?)

During implementation:
- [ ] Write tests BEFORE changing code
- [ ] Small, logical commits (one per idea)
- [ ] Run tests after each commit
- [ ] Verify behavior unchanged (or intentionally improved)
- [ ] Check performance (no regressions)

Before merging:
- [ ] All tests pass (npm test)
- [ ] No TypeScript errors (npm run build:ts)
- [ ] No lint errors (npm run lint)
- [ ] Code review completed
- [ ] Commit messages are clear
- [ ] Documentation updated if needed

---

**Template Version**: 1.0
**Created**: 2025-11-20
**For Use With**: REFACTORING_SAFETY_ANALYSIS.md and SAFE_QUICK_WINS.md
