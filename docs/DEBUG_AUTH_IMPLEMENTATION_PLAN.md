# Debug-Friendly Secure Authentication - Implementation Plan

**Goal:** Maintain excellent debugging while removing credential exposure

**Approach:** Show authentication INTENT, not CONTENT

---

## 3 Immediate Recommendations (2-3 hours total)

### 1. Auth Method Indicators (30 min) - HIGHEST PRIORITY

**Change:** Add `[auth: <method>]` to command logs

**Implementation:**
```typescript
// In src/svn.ts, around line 110:

function getAuthMethodLabel(options: ICpOptions): string {
  if (options.credentialFile) {
    return `[auth: credential file ${options.credentialFile}]`;
  }
  if (process.env.SVN_PASSWORD && options.username) {
    return `[auth: SVN_PASSWORD environment variable]`;
  }
  if (options.password && options.username) {
    return `[auth: password provided]`;
  }
  if (options.username) {
    return `[auth: username only]`;
  }
  return `[auth: none - will prompt if needed]`;
}

// Modify logging (line 111-113):
if (options.log !== false) {
  const argsOut = args.map(arg => (/ |^$/.test(arg) ? `'${arg}'` : arg));
  const authLabel = getAuthMethodLabel(options);
  this.logOutput(
    `[${this.lastCwd.split(PATH_SEPARATOR_PATTERN).pop()}]$ svn ${argsOut.join(" ")} ${authLabel}\n`
  );
}
```

**Before:**
```
[repo]$ svn update --username john
```

**After:**
```
[repo]$ svn update --username john [auth: password provided]
```

**Impact:**
- Users can see what auth method is active
- Debug "credentials not being used" issues instantly
- Zero security impact (shows method, not content)
- No configuration changes needed

**Files Modified:**
- /home/user/positron-svn/src/svn.ts (lines ~109-114, ~293-296)

**Test Cases:**
```typescript
it("logs auth method without exposing password", () => {
  const spy = sinon.spy(svn, "logOutput");
  svn.exec("/repo", ["update"], { username: "john", password: "secret" });
  
  assert(spy.calledWith(sinon.match(/\[auth: password provided\]/)));
  assert(!spy.calledWith(sinon.match(/secret/)));
});
```

---

### 2. Debug Mode Warning (30 min)

**Change:** Show prominent warning when `debug.disableSanitization` enabled

**Implementation:**
```typescript
// In src/extension.ts, around line 115:

const showOutput = configuration.get<boolean>("showOutput");
if (showOutput) {
  outputChannel.show();
}

// Add this:
if (configuration.get<boolean>("debug.disableSanitization", false)) {
  outputChannel.appendLine("");
  outputChannel.appendLine("⚠️⚠️⚠️ SECURITY WARNING ⚠️⚠️⚠️");
  outputChannel.appendLine("Error sanitization is DISABLED");
  outputChannel.appendLine("Credentials WILL BE VISIBLE in logs");
  outputChannel.appendLine("Disable: svn.debug.disableSanitization = false");
  outputChannel.appendLine("⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️");
  outputChannel.appendLine("");
  outputChannel.show(); // Force show
  
  window.showWarningMessage(
    "⚠️ SVN: Error sanitization disabled. Credentials visible in logs. " +
    "Disable svn.debug.disableSanitization after debugging.",
    "Disable Now",
    "OK"
  ).then(choice => {
    if (choice === "Disable Now") {
      configuration.update("debug.disableSanitization", false, true);
    }
  });
}
```

**Impact:**
- Prevents users from forgetting debug mode is on
- Clear visual warning in Output Channel
- One-click disable option
- Helps prevent accidental credential exposure

**Files Modified:**
- /home/user/positron-svn/src/extension.ts (~line 115)

---

### 3. Enhanced Auth Error Messages (1 hour)

**Change:** Add context to authentication failures

**Implementation:**
```typescript
// In src/services/authService.ts or src/commands/command.ts:

function getAuthFailureContext(
  error: ISvnErrorData,
  options: ICpOptions
): string {
  if (error.svnErrorCode !== svnErrorCodes.AuthorizationFailed) {
    return "";
  }
  
  const lines: string[] = [];
  
  // What was attempted
  if (options.credentialFile) {
    lines.push("✗ Authentication failed using credential file");
    lines.push(`  File: ${options.credentialFile}`);
    lines.push("  The file was read but credentials were rejected");
  } else if (process.env.SVN_PASSWORD) {
    lines.push("✗ Authentication failed using SVN_PASSWORD environment variable");
    lines.push("  The password was provided but rejected");
  } else if (options.password) {
    lines.push("✗ Authentication failed using provided password");
    lines.push("  Credentials were sent but rejected by server");
  } else {
    lines.push("ℹ Authentication required but no credentials configured");
    lines.push("  Extension will prompt for credentials");
    return lines.join("\n");
  }
  
  // Common causes
  lines.push("");
  lines.push("Possible causes:");
  lines.push("  - Password incorrect or expired");
  lines.push("  - Username doesn't have repository access");
  lines.push("  - Account locked or disabled");
  
  return lines.join("\n");
}

// Use in error handlers:
catch (err) {
  const svnError = err as ISvnErrorData;
  
  if (this.authService.isAuthError(svnError)) {
    const context = getAuthFailureContext(svnError, options);
    if (context) {
      this.logOutput(`\n${context}\n\n`);
    }
  }
  
  throw err;
}
```

**Before:**
```
svn: E170001: Authentication failed
```

**After:**
```
svn: E170001: Authentication failed
✗ Authentication failed using provided password
  Credentials were sent but rejected by server

Possible causes:
  - Password incorrect or expired
  - Username doesn't have repository access
  - Account locked or disabled
```

**Impact:**
- Users know if credentials were provided
- Clear distinction between "wrong password" and "no credentials"
- Actionable guidance
- Reduces support requests

**Files Modified:**
- /home/user/positron-svn/src/services/authService.ts (add helper)
- /home/user/positron-svn/src/commands/command.ts (use in error handlers)
- /home/user/positron-svn/src/svnRepository.ts (use in retry logic)

---

## Optional Enhancement: Verbose Retry Logging (30 min)

**Change:** Show credential cycling during auth retries

**Implementation:**
```typescript
// In src/services/authService.ts retryWithAuth() method:

while (attempt < maxAttempts) {
  attempt++;
  
  // Add this before try:
  if (attempt > 1 && configuration.get<boolean>("debug.verboseAuth", false)) {
    if (attempt <= storedAccounts.length) {
      this.logOutput(`→ Trying stored credential ${attempt} of ${storedAccounts.length}...\n`);
    } else {
      this.logOutput(`→ Prompting for credentials (attempt ${attempt - storedAccounts.length} of 3)...\n`);
    }
  }
  
  try {
    const result = await operation();
    
    // Add success log:
    if (attempt > 1 && configuration.get<boolean>("debug.verboseAuth", false)) {
      this.logOutput(`✓ Authentication successful\n`);
    }
    
    await this.saveCredentials();
    return result;
  }
  // ... rest of retry logic
}
```

**Output:**
```
[repo]$ svn update --username john [auth: password provided]
svn: E170001: Authentication failed
→ Trying stored credential 1 of 2...
[repo]$ svn update --username john [auth: stored credentials]
svn: E170001: Authentication failed
→ Trying stored credential 2 of 2...
[repo]$ svn update --username admin [auth: stored credentials]
✓ Authentication successful
```

**Files Modified:**
- /home/user/positron-svn/src/services/authService.ts (lines ~149-198)

**Config Addition:**
```json
{
  "svn.debug.verboseAuth": {
    "type": "boolean",
    "default": false,
    "description": "Show detailed authentication retry flow in logs"
  }
}
```

---

## Testing Strategy

### Unit Tests (New File: test/unit/svn/auth-logging.test.ts)

```typescript
import { assert } from "chai";
import * as sinon from "sinon";
import { Svn } from "../../../src/svn";

describe("SVN Authentication Logging", () => {
  let svn: Svn;
  let logSpy: sinon.SinonSpy;
  
  beforeEach(() => {
    svn = new Svn({ svnPath: "/usr/bin/svn", version: "1.14.0" });
    logSpy = sinon.spy(svn, "logOutput");
  });
  
  it("shows 'password provided' without exposing password", async () => {
    await svn.exec("/repo", ["update"], {
      username: "john",
      password: "secret123"
    });
    
    assert(logSpy.calledWith(sinon.match(/\[auth: password provided\]/)));
    assert(!logSpy.calledWith(sinon.match(/secret123/)));
  });
  
  it("shows SVN_PASSWORD env var without exposing value", async () => {
    process.env.SVN_PASSWORD = "test_pass";
    
    await svn.exec("/repo", ["update"], { username: "john" });
    
    assert(logSpy.calledWith(sinon.match(/\[auth: SVN_PASSWORD environment variable\]/)));
    assert(!logSpy.calledWith(sinon.match(/test_pass/)));
    
    delete process.env.SVN_PASSWORD;
  });
  
  it("shows credential file path without exposing contents", async () => {
    await svn.exec("/repo", ["update"], {
      username: "john",
      credentialFile: "~/.svn-credentials"
    });
    
    assert(logSpy.calledWith(sinon.match(/\[auth: credential file ~\/.svn-credentials\]/)));
  });
  
  it("shows 'none' when no auth provided", async () => {
    await svn.exec("/repo", ["info"], {});
    
    assert(logSpy.calledWith(sinon.match(/\[auth: none - will prompt if needed\]/)));
  });
});
```

### Manual Testing Checklist

- [ ] Password auth shows `[auth: password provided]`
- [ ] Password value never appears in logs
- [ ] SVN_PASSWORD env var shows `[auth: SVN_PASSWORD environment variable]`
- [ ] Env var value never appears in logs
- [ ] No auth shows `[auth: none - will prompt if needed]`
- [ ] Debug mode warning appears when enabled
- [ ] Debug mode warning includes "Disable Now" button
- [ ] "Disable Now" actually disables the setting
- [ ] Auth error shows context message
- [ ] Context distinguishes "wrong password" from "no credentials"

---

## Rollout Plan

### Phase 1: Core Implementation (1 day)
1. Implement auth method indicators
2. Add debug mode warning
3. Write unit tests
4. Manual testing

### Phase 2: Enhanced Errors (1 day)
1. Implement auth error context
2. Test all error scenarios
3. Verify messages are helpful

### Phase 3: Documentation (1 day)
1. Update CHANGELOG.md
2. Add to LESSONS_LEARNED.md
3. Update package.json descriptions
4. Create user documentation

### Phase 4: Release
1. Bump version (2.17.230 → 2.18.0)
2. Create release notes highlighting debugging improvements
3. Deploy

---

## Success Criteria

### Must Have (for v2.18)
- [x] Auth method visible in command logs
- [x] Passwords never exposed (except debug mode)
- [x] Debug mode shows warning
- [x] No breaking changes
- [x] Tests pass

### Should Have (for v2.18)
- [ ] Enhanced auth error messages
- [ ] Clear "wrong password" vs "no credentials" distinction
- [ ] Documentation updated

### Nice to Have (for v2.19)
- [ ] Verbose retry logging
- [ ] Credential source tracking
- [ ] Debug log export command

---

## Files to Modify

### Primary Changes
1. **/home/user/positron-svn/src/svn.ts** (~30 lines)
   - Add `getAuthMethodLabel()` function
   - Modify `logOutput()` calls in `exec()` and `execBuffer()`

2. **/home/user/positron-svn/src/extension.ts** (~20 lines)
   - Add debug mode warning check
   - Show warning in Output Channel and dialog

3. **/home/user/positron-svn/src/services/authService.ts** (~40 lines)
   - Add `getAuthFailureContext()` helper
   - Use in error handlers

### Test Files
4. **/home/user/positron-svn/test/unit/svn/auth-logging.test.ts** (new file)
   - Test auth method logging
   - Verify password sanitization

### Documentation
5. **/home/user/positron-svn/CHANGELOG.md**
6. **/home/user/positron-svn/docs/LESSONS_LEARNED.md**

---

## Risk Assessment

### Low Risk
- Auth method indicators (pure addition, no logic change)
- Debug mode warning (pure UX addition)
- Unit tests (no production impact)

### Medium Risk
- Auth error messages (changes error handling flow)
  - Mitigation: Make context optional, preserve existing errors

### No Risk
- Documentation updates

---

## Alternative Approaches Considered

### ❌ Show password length
```
[auth: password provided (8 characters)]
```
**Rejected:** Gives attackers information

### ❌ Show password hash
```
[auth: password hash abc123...]
```
**Rejected:** Unnecessary, confusing to users

### ✓ Show method + source (CHOSEN)
```
[auth: password provided]
[auth: credential file ~/.svn-credentials]
[auth: SVN_PASSWORD environment variable]
```
**Selected:** Clear, secure, actionable

---

## Key Insight

**Users debugging auth don't need to see passwords.**

**They need to see:**
1. ✓ What auth method is being used
2. ✓ Whether credentials were provided
3. ✓ What went wrong
4. ✓ How to fix it

**The solution provides all of this without exposing credentials.**

---

## Next Steps

1. Review this plan
2. Implement Phase 1 (auth method indicators)
3. Write tests
4. Manual testing
5. Commit and deploy

**Estimated Total Effort:** 2-3 hours for core functionality

**Expected Outcome:** Dramatically improved debugging without compromising security
