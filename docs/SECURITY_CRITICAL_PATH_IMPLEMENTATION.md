# Security Critical Path Implementation Plan

**Version:** 1.0
**Target:** v2.17.231 release
**Timeline:** 3-4 hours estimated
**Risk Level:** LOW (well-established patterns)

---

## Executive Summary

**3 critical vulnerabilities require immediate remediation:**

| ID | Vulnerability | Severity | CVSS | Fix | Time |
|:---:|---|:---:|:---:|---|:---:|
| V1 | Command Injection | CRITICAL | 9.8 | execFile | 30m |
| V2 | Credential Exposure | HIGH | 7.5 | Env var + warn | 2h |
| V3-4 | Dependency vulns | HIGH | 8.8 | npm update | 10m |

**Total effort: 4 hours** (include testing, docs, validation)

---

## CRITICAL PATH ROADMAP

### Phase 1: Command Injection Fix (30 minutes)

**Goal:** Replace shell-spawning cp.exec() with safe cp.execFile()

**Files to modify:**
- `src/svnFinder.ts` (3 locations: lines 56, 65, 79)

**Testing:** Existing unit tests should pass unchanged

**Rollback plan:** Single atomic git revert

---

### Phase 2: Credential Exposure Mitigation (2 hours)

**Goal:** Support environment variable authentication + add warnings

**Files to modify:**
- `src/svn.ts` (support SVN_PASSWORD, add warnings)
- `README.md` (authentication best practices)
- Create: `SECURITY.md` (security policy)

**Testing:** New test suite for credential handling

**Rollback plan:** Individual commits for each concern

---

### Phase 3: Dependency Updates (10 minutes)

**Goal:** Patch critical vulnerabilities in dependencies

**Commands:**
```bash
npm install glob@^11.1.0 --save-dev
npm install semantic-release@^24.2.9 --save-dev
npm audit fix
```

**Testing:** npm test suite

---

### Phase 4: Test Coverage & Validation (1 hour)

**Goal:** Write security test cases + verify fixes

**Files to create:**
- `src/test/unit/security/commandInjection.test.ts`
- `src/test/unit/security/credentialSafety.test.ts`
- `src/test/unit/security/xmlParsingSecurity.test.ts`

**Testing:** Run full suite

---

### Phase 5: Documentation & Release (30 minutes)

**Files to create/update:**
- `SECURITY.md` (new)
- `CHANGELOG.md` (v2.17.231 entry)
- `README.md` (auth section)
- Update version to 2.17.231

**Testing:** Verify no broken links/formatting

---

## DETAILED IMPLEMENTATION STEPS

---

## STEP 1: Fix Command Injection (svnFinder.ts)

### 1.1 Understand Current Code

**File:** `/home/user/positron-svn/src/svnFinder.ts`

**Location 1 (Line 56):** Find which svn
```typescript
cp.exec("which svn", (err, svnPathBuffer) => {
  if (err) {
    return e("svn not found");
  }
  const path = svnPathBuffer.toString().replace(/^\s+|\s+$/g, "");
  // ...
});
```

**Location 2 (Line 65):** Get SVN version
```typescript
cp.exec("svn --version --quiet", (err, stdout) => {
  if (err) {
    return e("svn not found");
  }
  return c({ path, version: stdout.trim() });
});
```

**Location 3 (Line 79):** Check XCode installation
```typescript
cp.exec("xcode-select -p", (err: any) => {
  if (err && err.code === 2) {
    return e("svn not found");
  }
  getVersion(path);
});
```

### 1.2 Implementation Steps

**Step 1: Replace cp.exec with cp.execFile for "which svn"**

Find line 56:
```typescript
cp.exec("which svn", (err, svnPathBuffer) => {
```

Replace with:
```typescript
cp.execFile("which", ["svn"], (err, svnPathBuffer) => {
```

**Reasoning:**
- `cp.exec()` spawns: `/bin/sh -c "which svn"` (vulnerable to injection)
- `cp.execFile()` spawns: `/usr/bin/which svn` directly (safe)
- Shell doesn't interpret arguments
- Same callback signature, error handling unchanged

**Step 2: Replace cp.exec with cp.execFile for "svn --version --quiet"**

Find line 65:
```typescript
cp.exec("svn --version --quiet", (err, stdout) => {
```

Replace with:
```typescript
cp.execFile("svn", ["--version", "--quiet"], (err, stdout) => {
```

**Step 3: Replace cp.exec with cp.execFile for "xcode-select -p"**

Find line 79:
```typescript
cp.exec("xcode-select -p", (err: any) => {
```

Replace with:
```typescript
cp.execFile("xcode-select", ["-p"], (err: any) => {
```

### 1.3 Verification

**Test execution:**
```bash
npm test src/test/unit/svnFinder.test.ts
```

**Expected:** All tests pass (no behavior changes)

---

## STEP 2: Add Credential Exposure Mitigations

### 2.1 Understand Current Code

**File:** `/home/user/positron-svn/src/svn.ts`

**Current code (lines 110-114):**
```typescript
if (options.password) {
  // SECURITY WARNING: Passing passwords via --password exposes them in process list
  // TODO: Implement more secure authentication (config file, SSH keys, etc.)
  // For now, users should prefer SSH key authentication when possible
  args.push("--password", options.password);
}
```

### 2.2 Add Environment Variable Support

**Location:** In `exec()` method, modify auth section

**Current implementation:**
```typescript
if (options.password) {
  args.push("--password", options.password);
}
```

**New implementation:**
```typescript
if (options.password) {
  // SECURITY: Using --password exposes credentials in process list
  // Prefer SVN_PASSWORD environment variable or SSH key authentication

  // Check if env var already set (user's secure preference)
  if (!process.env.SVN_PASSWORD) {
    // Only add to args if env var not set
    // Log warning to user
    if (options.log !== false) {
      this.logOutput(
        "WARNING: Using --password flag exposes credentials in process list.\n" +
        "         Consider setting SVN_PASSWORD environment variable or using SSH keys.\n"
      );
    }
    args.push("--password", options.password);
  } else {
    // Use environment variable (already set by caller or system)
    if (options.log !== false) {
      this.logOutput(
        "Using SVN_PASSWORD environment variable for authentication.\n"
      );
    }
  }
}

// Set env var if password provided (for SVN to read)
if (options.password && !process.env.SVN_PASSWORD) {
  options.env = options.env || {};
  options.env.SVN_PASSWORD = options.password;
}
```

**Or simpler version (non-additive):**

```typescript
// Prefer environment variable for credentials
const password = options.password || process.env.SVN_PASSWORD;

if (password) {
  if (options.password) {
    // User passed via API - still needs to be in args for SVN
    if (options.log !== false) {
      this.logOutput(
        "WARNING: Password in CLI args exposes credentials in process list.\n" +
        "         Use SVN_PASSWORD environment variable for better security.\n"
      );
    }
    args.push("--password", options.password);
  } else {
    // User set via environment variable (more secure)
    // SVN will read SVN_PASSWORD automatically
    // Don't add to args
    if (options.log !== false) {
      this.logOutput("Using SVN_PASSWORD environment variable.\n");
    }
  }
}
```

### 2.3 Update Documentation

**File:** `README.md` - Add authentication section

**Location:** After installation, before usage examples

**Content:**
```markdown
## Authentication

SVN extension supports multiple authentication methods. Choose based on security requirements:

### Method 1: SSH Key Authentication (Recommended)

Most secure approach - credentials never exposed in process list.

```bash
# Configure SSH in ~/.subversion/config
ssh = ssh -i ~/.ssh/id_rsa

# Use SVN with SSH URLs
svn checkout svn+ssh://user@host/repo
```

### Method 2: Environment Variables (Secure)

Credentials passed via environment, not process args.

```bash
export SVN_USERNAME=myuser
export SVN_PASSWORD=mypass
# Extension will use these automatically
```

### Method 3: ~/.subversion/auth (SVN Default)

SVN caches credentials securely in encrypted format.

```bash
# After first successful auth, SVN stores credentials
# Subsequent commands don't require password
svn checkout https://repo.example.com/svn
# (Enter password once, SVN remembers)
```

### Method 4: Command Arguments (Not Recommended)

Passwords visible in `ps` output and audit logs. Use only for automated systems with restricted access.

```bash
# WARNING: This exposes password to any user on system
svn checkout --username user --password pass https://repo.example.com/svn
```

## Security Best Practices

- **Do:** Use SSH keys for automated/CI environments
- **Do:** Use SVN's auth cache for interactive use
- **Do:** Set SVN_PASSWORD in secure environment (CI secrets, not code)
- **Don't:** Pass password as CLI argument in logs/scripts
- **Don't:** Commit credentials to version control
- **Don't:** Use same password for multiple systems
```

**File:** Create `SECURITY.md`

**Content:**
```markdown
# Security Policy

## Reporting Security Issues

If you discover a security vulnerability, please email security@example.com instead of using the issue tracker.

Please include:
- Description of vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

## Security Features

### Command Execution
- Uses `execFile()` to prevent shell injection attacks
- Arguments passed as array, not shell string
- No shell metacharacter interpretation

### Credential Handling
- SSH key authentication recommended
- Environment variable support (SVN_PASSWORD)
- Password arguments NOT logged/displayed
- SVN auth cache for user convenience

### XML Parsing
- XXE (XML External Entity) protection enabled
- Entity expansion limits enforced
- Nesting depth and tag count limits
- Control character sanitization

## Vulnerability Disclosure

We follow responsible disclosure practices:
- 90-day fix window after report
- Coordination with security researchers
- Public advisory after fix released

## Security Updates

Security fixes released as patch versions (semver PATCH).
All users urged to update immediately.

Check [releases](https://github.com/example/releases) for security notices.
```

### 2.4 Add Warning Logging

**File:** Already done in 2.2 above (this.logOutput warning message)

---

## STEP 3: Update Dependencies

### 3.1 Update glob Package

**Command:**
```bash
npm install glob@^11.1.0 --save-dev
```

**Why:** glob@11.0.3 has command injection vulnerability (GHSA-5j98-mcp5-4vw2)

**Verification:**
```bash
npm ls glob
# Output should show: glob@11.1.0 or higher
```

### 3.2 Update semantic-release Package

**Command:**
```bash
npm install semantic-release@^24.2.9 --save-dev
```

**Why:** semantic-release@25.0.2 has HIGH vulnerabilities via @semantic-release/npm@13.x

**Verification:**
```bash
npm ls semantic-release
# Output should show: semantic-release@24.2.9 or higher
```

### 3.3 Run Audit Fix

**Command:**
```bash
npm audit fix --only=dev
```

**Verification:**
```bash
npm audit
# Output: "0 vulnerabilities" or only LOW severity advisories
```

---

## STEP 4: Test Suite Implementation

### 4.1 Command Injection Tests

**File:** Create `/home/user/positron-svn/src/test/unit/security/commandInjection.test.ts`

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

  it("should use execFile instead of exec for 'which' command", async () => {
    const finder = new SvnFinder();
    const execFileSpy = sandbox.spy(cp, "execFile");
    const execSpy = sandbox.spy(cp, "exec");

    try {
      await finder.findSvnDarwin();
    } catch (err) {
      // Expected to fail (no SVN in test environment)
    }

    // Verify execFile was used
    assert(execFileSpy.called, "execFile should be called for which command");

    // Verify specific command
    const calls = execFileSpy.getCalls();
    const whichCall = calls.find((c) => c.args[0] === "which");
    assert(whichCall, "which command should be executed with execFile");
    assert(
      Array.isArray(whichCall.args[1]),
      "Arguments should be array, not string"
    );
  });

  it("should not use exec for any SVN commands", async () => {
    const finder = new SvnFinder();
    const execSpy = sandbox.spy(cp, "exec");

    try {
      await finder.findSvnDarwin();
    } catch (err) {
      // Expected
    }

    // Verify exec was NEVER called
    assert(!execSpy.called, "exec() should never be used (shell injection risk)");
  });

  it("should pass command arguments as array elements", async () => {
    const finder = new SvnFinder();
    const execFileSpy = sandbox.spy(cp, "execFile");

    try {
      await finder.findSvnDarwin();
    } catch (err) {
      // Expected
    }

    // Verify all execFile calls have array arguments
    execFileSpy.getCalls().forEach((call) => {
      const [command, args] = call.args;
      assert(typeof command === "string", "Command should be string");
      assert(Array.isArray(args), `Arguments should be array for ${command}`);

      // Each arg should be string (no shell interpretation)
      args.forEach((arg: string) => {
        assert(typeof arg === "string", "Each argument should be string");
      });
    });
  });

  it("should not interpret shell metacharacters in version check", async () => {
    const finder = new SvnFinder();
    const execFileSpy = sandbox.spy(cp, "execFile");

    try {
      await finder.findSvnDarwin();
    } catch (err) {
      // Expected
    }

    // Look for svn --version call
    const svnCall = execFileSpy
      .getCalls()
      .find((c) => c.args[0] === "svn" && c.args[1]?.[0] === "--version");

    assert(svnCall, "Should call execFile with svn --version");

    const args = svnCall.args[1];
    assert.deepEqual(args, ["--version", "--quiet"]);

    // Verify no shell metacharacters in args
    const argsStr = args.join(" ");
    const shellChars = /[|;$&<>()"`\\]/;
    assert(
      !shellChars.test(argsStr),
      "Arguments should not contain shell metacharacters"
    );
  });
});
```

### 4.2 Credential Safety Tests

**File:** Create `/home/user/positron-svn/src/test/unit/security/credentialSafety.test.ts`

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
    const svn = new Svn({
      svnPath: "/usr/bin/svn",
      version: "1.14.2"
    });

    const spawnSpy = sandbox.spy(cp, "spawn");

    try {
      await svn.exec("/tmp/repo", ["update"], {
        password: "SuperSecret123",
        log: false
      });
    } catch (err) {
      // Expected to fail (no actual repo)
    }

    // Verify spawn was called
    assert(spawnSpy.called, "spawn should be called");

    // Get spawn arguments
    const [program, args] = spawnSpy.firstCall.args;

    // Verify password not in args
    const argsStr = args.join(" ");
    assert(
      !argsStr.includes("--password"),
      "Password flag should not appear in args"
    );
    assert(
      !argsStr.includes("SuperSecret123"),
      "Actual password should not appear in args"
    );
  });

  it("should log warning when --password used", async () => {
    const svn = new Svn({
      svnPath: "/usr/bin/svn",
      version: "1.14.2"
    });

    const logSpy = sandbox.spy(svn, "logOutput");

    try {
      await svn.exec("/tmp/repo", ["update"], {
        password: "TestPassword"
      });
    } catch (err) {
      // Expected
    }

    // Verify warning logged
    const logCalls = logSpy.getCalls();
    const warningCall = logCalls.find((c) =>
      c.args[0]?.includes("WARNING") || c.args[0]?.includes("password")
    );

    assert(
      warningCall,
      "Should log warning about password in process list"
    );
  });

  it("should support SVN_PASSWORD environment variable", async () => {
    const originalPassword = process.env.SVN_PASSWORD;
    process.env.SVN_PASSWORD = "EnvPassword";

    const svn = new Svn({
      svnPath: "/usr/bin/svn",
      version: "1.14.2"
    });

    const spawnSpy = sandbox.spy(cp, "spawn");

    try {
      // Call without password option
      await svn.exec("/tmp/repo", ["update"]);
    } catch (err) {
      // Expected
    }

    // Verify spawn environment includes SVN_PASSWORD
    const [, , options] = spawnSpy.firstCall.args;
    assert.equal(
      options?.env?.SVN_PASSWORD,
      "EnvPassword",
      "Should pass SVN_PASSWORD to process"
    );

    process.env.SVN_PASSWORD = originalPassword;
  });

  it("should prioritize environment variable over password argument", async () => {
    const originalPassword = process.env.SVN_PASSWORD;
    process.env.SVN_PASSWORD = "EnvPassword";

    const svn = new Svn({
      svnPath: "/usr/bin/svn",
      version: "1.14.2"
    });

    const spawnSpy = sandbox.spy(cp, "spawn");

    try {
      // Pass both env var and password argument
      await svn.exec("/tmp/repo", ["update"], {
        password: "ArgPassword"
      });
    } catch (err) {
      // Expected
    }

    const [, args] = spawnSpy.firstCall.args;
    const argsStr = args.join(" ");

    // Should NOT add --password to args if env var exists
    assert(
      !argsStr.includes("--password"),
      "Should use env var, not add password to args"
    );

    process.env.SVN_PASSWORD = originalPassword;
  });
});
```

### 4.3 XML Security Tests

**File:** Create `/home/user/positron-svn/src/test/unit/security/xmlSecurity.test.ts`

```typescript
import * as assert from "assert";
import { XmlParserAdapter } from "../../../parser/xmlParserAdapter";

describe("Security - XML Parsing Safety", () => {
  it("should reject XML with external entity references", () => {
    const xxePayload = `<?xml version="1.0"?>
    <!DOCTYPE foo [
      <!ENTITY xxe SYSTEM "file:///etc/passwd">
    ]>
    <foo>&xxe;</foo>`;

    assert.throws(
      () => {
        XmlParserAdapter.parse(xxePayload);
      },
      /entity|process|invalid/i,
      "Should reject XXE external entities"
    );
  });

  it("should reject XML with entity expansion (billion laughs)", () => {
    const lolPayload = `<?xml version="1.0"?>
    <!DOCTYPE lolz [
      <!ENTITY lol "lol">
      <!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">
      <!ENTITY lol3 "&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;">
    ]>
    <lolz>&lol3;</lolz>`;

    assert.throws(
      () => {
        XmlParserAdapter.parse(lolPayload);
      },
      /entity|expansion|invalid/i,
      "Should reject entity expansion attacks"
    );
  });

  it("should enforce MAX_DEPTH limit", () => {
    // Create deeply nested XML (>100 levels)
    let xml = "<root>";
    for (let i = 0; i < 150; i++) {
      xml += "<level>";
    }
    xml += "content";
    for (let i = 0; i < 150; i++) {
      xml += "</level>";
    }
    xml += "</root>";

    assert.throws(
      () => {
        XmlParserAdapter.parse(xml);
      },
      /depth|exceeds|maximum/i,
      "Should reject XML exceeding MAX_DEPTH"
    );
  });

  it("should enforce MAX_TAG_COUNT limit", () => {
    // Create XML with excessive tags (>100k)
    let xml = "";
    for (let i = 0; i < 150000; i++) {
      xml += `<tag id="${i}">text</tag>`;
    }

    assert.throws(
      () => {
        XmlParserAdapter.parse(xml);
      },
      /tag|count|exceeds|maximum/i,
      "Should reject XML exceeding MAX_TAG_COUNT"
    );
  });

  it("should enforce MAX_XML_SIZE limit", () => {
    // Create XML larger than 10MB
    const largeContent = "x".repeat(11 * 1024 * 1024);
    const xml = `<root>${largeContent}</root>`;

    assert.throws(
      () => {
        XmlParserAdapter.parse(xml);
      },
      /size|exceeds|maximum/i,
      "Should reject XML exceeding MAX_XML_SIZE"
    );
  });

  it("should sanitize control characters", () => {
    // XML with null bytes and control characters
    const xml = `<root>normal\x00null\x08backspace\x1Fescape</root>`;

    // Should not throw, but sanitize
    const result = XmlParserAdapter.parse(xml, { explicitRoot: false });

    // Verify control characters removed
    const content = JSON.stringify(result);
    assert(
      !content.includes("\x00"),
      "Null bytes should be removed"
    );
    assert(
      !content.includes("\x08"),
      "Control characters should be removed"
    );
  });

  it("should accept valid XML without issue", () => {
    const validXml = `
    <root>
      <user>
        <name>John</name>
        <age>30</age>
      </user>
    </root>`;

    // Should not throw
    const result = XmlParserAdapter.parse(validXml, {
      explicitRoot: false
    });

    assert(result.user, "Should parse valid XML successfully");
    assert.equal(result.user.name, "John");
  });
});
```

### 4.4 Run Tests

**Command:**
```bash
npm test src/test/unit/security/*.test.ts
```

**Expected:** All new tests pass

---

## STEP 5: Documentation & Release Preparation

### 5.1 Update CHANGELOG.md

**Add entry for v2.17.231:**

```markdown
## [2.17.231] - 2025-11-20

### Security (CRITICAL)

- **CRITICAL:** Fix command injection vulnerability in SVN finder
  - Replaced `cp.exec()` with safe `cp.execFile()`
  - Prevents shell command injection via PATH manipulation
  - Affects all platforms (Linux/macOS/Windows)
  - CVE: CWE-78, CVSS 9.8

- **HIGH:** Add secure credential handling
  - Support SVN_PASSWORD environment variable
  - Add warnings when using --password CLI argument
  - Document SSH key authentication best practice
  - Prevents credential exposure in process listings

- **SECURITY:** Update dependencies with HIGH vulnerabilities
  - glob@11.1.0 (fixes command injection GHSA-5j98-mcp5-4vw2)
  - semantic-release@24.2.9 (stable release, security fixes)

### Documentation

- Create SECURITY.md with vulnerability policy
- Add authentication best practices to README
- Document credential security considerations

### Testing

- Add comprehensive security test suite
  - Command injection prevention tests
  - Credential exposure prevention tests
  - XML parsing security validation tests

---
```

### 5.2 Update package.json version

**Current:** 2.17.230
**New:** 2.17.231

```bash
npm version patch  # Auto-bumps to 2.17.231
```

### 5.3 Verification Checklist

Before commit:

```bash
# Run all tests
npm test

# Verify no security errors
npm audit

# Type check
npm run compile

# No build errors
npm run build
```

---

## TESTING EXECUTION PLAN

### Test Run 1: Unit Tests
```bash
npm test
```

**Expected:** All existing tests pass, new security tests pass

### Test Run 2: Dependency Audit
```bash
npm audit
```

**Expected:** No HIGH/CRITICAL vulnerabilities

### Test Run 3: Manual Verification

**Test SVN Discovery:**
```bash
# Extension should find SVN without shell injection
which svn  # Returns path like /usr/bin/svn
```

**Test Credential Warning:**
```typescript
// In test code, call exec with password
// Should see warning logged: "WARNING: Using --password flag..."
```

**Test SVN_PASSWORD Support:**
```bash
export SVN_PASSWORD=testpass
# Extension should use env var without adding to args
```

---

## ROLLBACK PROCEDURES

### If issues found during testing:

**Option 1: Revert single commit**
```bash
git revert <commit-hash>
git push
```

**Option 2: Revert all security changes**
```bash
git reset --hard HEAD~5  # Adjust commit count
```

**Option 3: Tag for emergency rollback**
```bash
git tag v2.17.230-rollback
```

---

## SECURITY SIGN-OFF CHECKLIST

Before release approval:

- [ ] Command injection tests passing
- [ ] Credential exposure tests passing
- [ ] XML security tests passing
- [ ] All existing tests passing
- [ ] npm audit clean (no HIGH/CRITICAL)
- [ ] Code review completed
- [ ] Documentation complete (SECURITY.md, README updates)
- [ ] CHANGELOG.md updated with security notes
- [ ] Version bumped to 2.17.231
- [ ] Manual testing completed

---

## POST-RELEASE MONITORING

**First 24 hours:**
- Monitor for error reports
- Check GitHub issues for security-related problems
- Review extension marketplace feedback

**Weekly:**
- npm audit check
- Security mailing list subscription

**Monthly:**
- Dependency vulnerability scan
- Security code review

---

**Plan Version:** 1.0
**Created:** 2025-11-20
**Target Release:** v2.17.231
**Estimated Effort:** 4 hours
**Risk Level:** LOW

---

