# Security Quick Reference Guide

**For:** v2.17.231 Critical Security Fixes
**Time Estimate:** 4 hours to completion
**Difficulty:** Easy (safe pattern substitutions)

---

## One-Minute Summary

| Issue | Severity | Root Cause | Fix | Files | Time |
|:---:|:---:|:---:|:---:|:---:|:---:|
| Command Injection | CRITICAL | cp.exec() | → execFile() | svnFinder.ts | 30m |
| Credential Exposure | HIGH | --password arg | + env var | svn.ts | 2h |
| Dependency Vulns | HIGH | glob, semver | npm update | package.json | 10m |

**Total Effort:** 4 hours | **Risk:** LOW | **Impact:** CRITICAL fixes

---

## CRITICAL FIX #1: Command Injection (30 minutes)

### What's Wrong
```typescript
// VULNERABLE - shell interprets command string
cp.exec("which svn", (err, stdout) => { ... });
```

Shell can execute injection payloads:
```bash
cp.exec("which svn; rm -rf /tmp/*")  # Malicious command executes
```

### What to Fix
```typescript
// SAFE - no shell, args as array
cp.execFile("which", ["svn"], (err, stdout) => { ... });
```

No shell interpretation:
```bash
cp.execFile("which", ["svn; rm -rf /tmp/*"])  # Treated as literal string
```

### Where to Fix

**File:** `/home/user/positron-svn/src/svnFinder.ts`

**Location 1 (Line 56):** Find which svn
```typescript
// BEFORE:
cp.exec("which svn", (err, svnPathBuffer) => {

// AFTER:
cp.execFile("which", ["svn"], (err, svnPathBuffer) => {
```

**Location 2 (Line 65):** Get SVN version
```typescript
// BEFORE:
cp.exec("svn --version --quiet", (err, stdout) => {

// AFTER:
cp.execFile("svn", ["--version", "--quiet"], (err, stdout) => {
```

**Location 3 (Line 79):** Check XCode
```typescript
// BEFORE:
cp.exec("xcode-select -p", (err: any) => {

// AFTER:
cp.execFile("xcode-select", ["-p"], (err: any) => {
```

### Why It's Safe

- Same callback signature ✅
- Same error handling ✅
- Same stdout/stderr streams ✅
- Same return codes ✅
- **Only difference:** No shell, args array ✅

### Verification

```bash
# Unit tests should still pass
npm test src/test/unit/svnFinder.test.ts

# No behavior changes
npm test
```

---

## CRITICAL FIX #2: Credential Exposure (2 hours)

### What's Wrong

```typescript
// VULNERABLE - password visible in process list
if (options.password) {
  args.push("--password", options.password);  // ps aux shows this!
}
```

Attacker sees:
```bash
$ ps aux | grep svn
user 12345 ... svn update --password MySecretPass123
```

### What to Fix

**Add warning and environment variable support:**

```typescript
// NEW: Support secure environment variable
const password = options.password || process.env.SVN_PASSWORD;

if (password) {
  if (options.password) {
    // User passed via API (less secure)
    if (options.log !== false) {
      this.logOutput(
        "WARNING: Password in CLI args visible in process list.\n" +
        "         Use SVN_PASSWORD environment variable for better security.\n"
      );
    }
    args.push("--password", options.password);
  } else {
    // User set via environment variable (more secure)
    if (options.log !== false) {
      this.logOutput(
        "Using SVN_PASSWORD environment variable for authentication.\n"
      );
    }
    // Don't add to args - SVN reads from environment automatically
  }
}
```

### Where to Fix

**File:** `/home/user/positron-svn/src/svn.ts` (around line 110-114)

### Additional Changes

**Update README.md** - Add authentication section:

```markdown
## Authentication

### Best Practice: SSH Keys (Recommended)
```bash
# SSH keys never exposed in process list
export SVN_SSH="ssh -i ~/.ssh/id_rsa"
svn checkout svn+ssh://server/repo
```

### Secure: Environment Variables
```bash
# Credentials passed via environment, not CLI args
export SVN_USERNAME=myuser
export SVN_PASSWORD=mypass
```

### Legacy: SVN Auth Cache
```bash
# SVN stores credentials securely on first use
svn checkout https://server/repo
# (Enter password once)
```

### Not Recommended: CLI Arguments
```bash
# WARNING: Password visible in ps output
svn checkout --username u --password p https://server/repo
```
```

**Create SECURITY.md:**
```markdown
# Security Policy

## Reporting Vulnerabilities

Email: security@example.com (not GitHub issues)

## Authentication Security

- **SSH keys:** Most secure, no credential exposure
- **Environment variables:** SVN_PASSWORD (secure alternative)
- **Config file:** ~/.subversion/auth (SVN default caching)
- **CLI args:** NOT recommended (visible in process list)

## XML Parsing

XXE and entity expansion attacks are mitigated:
- External entities disabled
- Entity expansion limits enforced
- Nesting depth limits
- Size limits

See SAFE_QUICK_WINS.md for other security improvements.
```

### Verification

```bash
# Log output should show credential warning
# Environment variable should be used if set
npm test src/test/unit/security/credentialSafety.test.ts
```

---

## CRITICAL FIX #3: Update Dependencies (10 minutes)

### What's Wrong

```json
{
  "devDependencies": {
    "glob": "11.0.3",           // ← HIGH vuln (command injection)
    "semantic-release": "25.0.2" // ← HIGH vulns (transitive)
  }
}
```

### What to Fix

```bash
# Update glob to patched version
npm install glob@^11.1.0 --save-dev

# Downgrade semantic-release to stable
npm install semantic-release@^24.2.9 --save-dev

# Fix any other vulnerabilities
npm audit fix --only=dev

# Verify clean audit
npm audit
```

### Verification

```bash
$ npm audit
# Should show: 0 vulnerabilities (or only LOW severity)

$ npm ls glob
glob@11.1.0

$ npm ls semantic-release
semantic-release@24.2.9
```

---

## TEST SUITE (1 hour)

### Test File 1: Command Injection Prevention

**Create:** `/home/user/positron-svn/src/test/unit/security/commandInjection.test.ts`

```typescript
import * as assert from "assert";
import * as sinon from "sinon";
import * as cp from "child_process";
import { SvnFinder } from "../../../svnFinder";

describe("Security - Command Injection Prevention", () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("should use execFile instead of exec (no shell injection)", async () => {
    const finder = new SvnFinder();
    const execSpy = sandbox.spy(cp, "exec");
    const execFileSpy = sandbox.spy(cp, "execFile");

    try {
      await finder.findSvnDarwin();
    } catch (e) {
      // Expected (no SVN in test env)
    }

    // CRITICAL: exec() must NEVER be called
    assert(!execSpy.called, "exec() should never be used - shell injection risk");

    // execFile should be used for safe execution
    assert(execFileSpy.called, "execFile() must be used");
  });

  it("should pass arguments as array (no shell interpretation)", async () => {
    const finder = new SvnFinder();
    const execFileSpy = sandbox.spy(cp, "execFile");

    try {
      await finder.findSvnDarwin();
    } catch (e) {
      // Expected
    }

    // Verify all execFile calls have array arguments
    execFileSpy.getCalls().forEach((call) => {
      const [cmd, args] = call.args;
      assert(Array.isArray(args), `Args should be array for ${cmd}`);

      // No dangerous characters in args
      args.forEach((arg: string) => {
        assert(!arg.includes(";"), `Args should not contain shell metacharacters`);
        assert(!arg.includes("|"), `Args should not contain pipe operators`);
      });
    });
  });
});
```

### Test File 2: Credential Safety

**Create:** `/home/user/positron-svn/src/test/unit/security/credentialSafety.test.ts`

```typescript
import * as assert from "assert";
import * as sinon from "sinon";
import * as cp from "child_process";
import { Svn } from "../../../svn";

describe("Security - Credential Safety", () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("should not expose password in spawn arguments", async () => {
    const svn = new Svn({ svnPath: "/usr/bin/svn", version: "1.14.2" });
    const spawnSpy = sandbox.spy(cp, "spawn");

    try {
      await svn.exec("/tmp/repo", ["update"], {
        password: "SECRET123",
        log: false
      });
    } catch (e) {
      // Expected
    }

    const [, args] = spawnSpy.firstCall.args;
    const argsStr = args.join(" ");

    // CRITICAL: Password must not be in args
    assert(!argsStr.includes("SECRET123"), "Password must not appear in args");
    assert(!argsStr.includes("--password"), "Flag should not be exposed");
  });

  it("should use SVN_PASSWORD environment variable when available", async () => {
    const originalEnv = process.env.SVN_PASSWORD;
    process.env.SVN_PASSWORD = "ENV_PASSWORD";

    const svn = new Svn({ svnPath: "/usr/bin/svn", version: "1.14.2" });
    const spawnSpy = sandbox.spy(cp, "spawn");

    try {
      await svn.exec("/tmp/repo", ["update"]);
    } catch (e) {
      // Expected
    }

    const [, , options] = spawnSpy.firstCall.args;
    assert.equal(options?.env?.SVN_PASSWORD, "ENV_PASSWORD");

    process.env.SVN_PASSWORD = originalEnv;
  });
});
```

### Run Tests

```bash
npm test src/test/unit/security/*.test.ts

# Expected output:
# ✓ should use execFile instead of exec
# ✓ should not expose password in spawn arguments
# ✓ should use SVN_PASSWORD environment variable
# ... (more tests)
#
# [security tests summary]: X passing
```

---

## IMPLEMENTATION CHECKLIST

### Phase 1: Code Changes (1.5 hours)

- [ ] Fix svnFinder.ts (3 locations, 30 min)
  - [ ] Line 56: cp.exec → cp.execFile for "which"
  - [ ] Line 65: cp.exec → cp.execFile for "svn"
  - [ ] Line 79: cp.exec → cp.execFile for "xcode-select"

- [ ] Update svn.ts (1 hour)
  - [ ] Add environment variable support
  - [ ] Add warning logs
  - [ ] Document in comments

- [ ] Update dependencies (10 min)
  - [ ] npm install glob@^11.1.0 --save-dev
  - [ ] npm install semantic-release@^24.2.9 --save-dev
  - [ ] npm audit fix --only=dev

### Phase 2: Testing (1 hour)

- [ ] Create security test suite (30 min)
  - [ ] commandInjection.test.ts
  - [ ] credentialSafety.test.ts

- [ ] Run tests (30 min)
  - [ ] npm test (all tests)
  - [ ] npm audit (zero HIGH/CRITICAL)

### Phase 3: Documentation (1 hour)

- [ ] Update README.md (30 min)
  - [ ] Add authentication section
  - [ ] Document best practices

- [ ] Create SECURITY.md (30 min)
  - [ ] Vulnerability policy
  - [ ] Reporting guidelines
  - [ ] Security practices

### Phase 4: Release (30 min)

- [ ] Update CHANGELOG.md
- [ ] Bump version to 2.17.231
- [ ] Verify no build errors
- [ ] Commit and tag

---

## COMMON PITFALLS (Avoid!)

### ❌ Pitfall 1: Forgetting Error Handling

```typescript
// WRONG - ignoring possible error on args[1]
cp.execFile(cmd, args); // args could be undefined

// RIGHT - always provide args array
cp.execFile(cmd, [], callback);  // Even if empty
cp.execFile(cmd, ["arg1"], callback);  // With args
```

### ❌ Pitfall 2: Mixing exec and execFile

```typescript
// WRONG - inconsistent
if (platform === "darwin") {
  cp.exec("which svn", ...);  // Vulnerable!
} else {
  cp.execFile("which", ["svn"], ...);  // Safe
}

// RIGHT - always execFile
cp.execFile("which", ["svn"], ...);  // All platforms
```

### ❌ Pitfall 3: Not Testing Password Handling

```typescript
// WRONG - assumes password works without testing
args.push("--password", options.password);

// RIGHT - test environment variable path too
const password = options.password || process.env.SVN_PASSWORD;
if (password && options.password) {
  args.push("--password", options.password);
}
```

### ❌ Pitfall 4: Incomplete Documentation

```typescript
// WRONG - no warning for users
if (options.password) {
  args.push("--password", options.password);  // Silent risk
}

// RIGHT - document and warn
if (options.password) {
  logWarning("Password in args exposes credentials");
  args.push("--password", options.password);
}
```

---

## VALIDATION COMMANDS

### Quick Validation

```bash
# 1. Check fixes applied
grep -n "execFile" src/svnFinder.ts | wc -l
# Expected: 3 occurrences

# 2. Check dependencies updated
npm ls glob | head -1
# Expected: glob@11.1.0

# 3. Check tests pass
npm test 2>&1 | tail -5
# Expected: X passing, 0 failing

# 4. Check no vulnerabilities
npm audit --json | jq '.metadata.vulnerabilities | keys'
# Expected: [] (empty) or only ["low"]
```

### Full Validation

```bash
# Complete security check
npm test
npm audit
npm run compile
npm run build
```

---

## ROLLBACK PROCEDURES

### If Something Breaks

```bash
# Option 1: Revert single file
git checkout HEAD -- src/svnFinder.ts

# Option 2: Revert all changes
git reset --hard HEAD~1

# Option 3: Create emergency tag
git tag v2.17.230-rollback-emergency
```

---

## TIME BREAKDOWN

| Task | Time | Owner |
|:---:|:---:|:---:|
| Code changes (svnFinder.ts) | 30m | Dev |
| Code changes (svn.ts + deps) | 1h 10m | Dev |
| Create security tests | 45m | QA/Dev |
| Run full test suite | 20m | QA |
| Documentation updates | 30m | Tech Lead |
| Review and sign-off | 15m | Lead |
| **TOTAL** | **4h** | |

---

## SUCCESS CHECKLIST

Before release:

- [ ] All code changes committed
- [ ] All tests passing (npm test)
- [ ] No vulnerabilities (npm audit)
- [ ] No TypeScript errors
- [ ] README updated
- [ ] SECURITY.md created
- [ ] CHANGELOG.md updated
- [ ] Version bumped to 2.17.231
- [ ] Code reviewed
- [ ] Manual testing completed

---

## SUPPORT & QUESTIONS

**Q: Will this break existing users?**
A: No. Changes are internal only. No API changes, same behavior.

**Q: Can users opt-out of the security fixes?**
A: The fixes are mandatory (especially command injection). Environment variable support is optional.

**Q: What about older SVN versions?**
A: No compatibility issues. execFile works with SVN 1.6.0+ (already required).

**Q: How should we announce this?**
A: Security advisory in release notes. Encourage all users to update.

---

## REFERENCES

- Full threat model: `docs/SECURITY_THREAT_MODEL.md`
- Implementation plan: `docs/SECURITY_CRITICAL_PATH_IMPLEMENTATION.md`
- Executive summary: `docs/SECURITY_EXECUTIVE_SUMMARY.md`
- Safety analysis: `docs/SAFE_QUICK_WINS.md`

---

**Last Updated:** 2025-11-20
**Version:** 1.0
**Status:** Ready for Implementation

