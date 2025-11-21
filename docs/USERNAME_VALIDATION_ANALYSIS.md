# Username Flow & Validation Strategy Analysis

**Date:** 2025-11-21
**Scope:** Credential handling security - Username validation
**Context:** Shell injection prevention

---

## Executive Summary

**Current State:** NO username validation exists. Usernames flow from UI input → memory → SVN command args without sanitization.

**Risk Level:** MEDIUM
- Main SVN commands use `cp.spawn()` without shell (mitigates shell injection)
- But: No validation allows argument injection, newline injection, and edge cases
- Username appears in credential cache filenames and SVN args

**Recommendation:** Implement allowlist-based validation compatible with SVN spec while blocking injection vectors.

---

## PART 1: USERNAME FLOW ANALYSIS

### 1.1 Entry Points (Where Usernames Come From)

**Source 1: UI Input (Primary)**
```
File: src/commands/promptAuth.ts:11-16
Flow: window.showInputBox() → IAuth.username → return to caller
Validation: NONE
```

**Source 2: Stored Credentials (SecretStorage)**
```
File: src/services/authService.ts:103-105
Flow: storage.load() → IStoredAuth.account → setCredentials()
Validation: NONE (trusted from VS Code SecretStorage)
```

**Source 3: Previously Used Credentials**
```
File: src/services/authService.ts:172-175
Flow: storedAccounts[index].account → setCredentials()
Validation: NONE (cached from previous session)
```

### 1.2 Storage Locations (Where Usernames Are Stored)

**Memory Storage:**
```
File: src/svnRepository.ts
Storage: Repository.username (string property)
Lifetime: Extension session
Access: AuthService via getCredentials/setCredentials
```

**Persistent Storage:**
```
File: VS Code SecretStorage API
Format: IStoredAuth { account: string, password: string }
Encryption: OS keychain (Keychain on macOS, Credential Manager on Windows)
Retrieval: authService.loadStoredCredentials()
```

**Credential Cache Files:**
```
File: ~/.subversion/auth/svn.simple/<MD5_HASH>
Format: SVN K-V format
Fields: username, password, svn:realmstring
Security: File mode 600 (owner only)
Created by: SvnAuthCache.writeCredential()
Username usage: Written to cache file content + used in hash computation
```

### 1.3 Username Usage (Where Usernames Are Used)

**Usage 1: SVN Command Arguments**
```
File: src/svn.ts:140-142, 364
Code: args.push("--username", options.username);
Execution: cp.spawn(svnPath, args, defaults)
Shell: NO (shell option not set, defaults to false)
Risk: Argument injection (if username starts with --)
```

**Usage 2: Credential Cache File Creation**
```
File: src/services/svnAuthCache.ts:44-48
Code: writeCredential(username, password, realmUrl)
Usage: 
  - Filename: MD5(realm) - username NOT in filename
  - File content: K-V format with username value
Format: K 8\nusername\nV ${username.length}\n${username}\n
Risk: None (file content, not parsed as command)
```

**Usage 3: Logging/Display**
```
File: Multiple (error messages, status display)
Risk: Information disclosure if username contains sensitive data
Mitigation: Error sanitization already implemented (v2.17.129)
```

---

## PART 2: CURRENT SECURITY POSTURE

### 2.1 Shell Injection Risk Assessment

**Finding: LOW RISK (but not zero)**

**Why Low Risk:**
1. `cp.spawn()` used WITHOUT shell option
   ```typescript
   // src/svn.ts:191
   const process = cp.spawn(this.svnPath, args, defaults);
   // defaults = { env, cwd } - NO shell: true
   ```

2. Arguments passed as array (not shell string)
   ```typescript
   // Safe pattern:
   args = ["update", "--username", userInput, "--password", "..."]
   cp.spawn("svn", args) // Each arg is separate process argument
   
   // NOT this (vulnerable):
   cp.exec(`svn update --username ${userInput}`) // Shell interprets
   ```

3. No shell metacharacter interpretation
   ```
   Username: "alice; rm -rf /"
   Result: Literal argument to SVN binary
   SVN error: "No such user: alice; rm -rf /"
   Shell: Never invoked, command not executed
   ```

**Why NOT Zero Risk:**
1. Argument injection possible
   ```
   Username: "--config-option=dangerous=value"
   Result: args = ["--username", "--config-option=dangerous=value"]
   SVN may interpret as TWO flags instead of username value
   ```

2. Newline injection
   ```
   Username: "alice\n--password=stolen"
   Result: May break arg parsing depending on SVN implementation
   ```

3. Edge cases in SVN parsing
   ```
   Username: "-alice" (starts with dash)
   Username: "alice=value" (contains equals)
   Username: "alice\x00bob" (null byte)
   ```

### 2.2 Existing Validation (Analysis)

**Result: ZERO VALIDATION**

Files checked:
- ✗ src/commands/promptAuth.ts - No validation on input
- ✗ src/services/authService.ts - No validation on setCredentials
- ✗ src/services/svnAuthCache.ts - No validation on writeCredential
- ✗ src/svn.ts - No validation before args.push

Search results:
```bash
# No username validation found:
grep -r "validate.*username" src/ → 0 results
grep -r "username.*regex\|username.*pattern" src/ → 0 results
grep -r "sanitize.*username" src/ → 0 results
```

**Contrast with password handling:**
- Password: Has sanitization in error logging (logError utility)
- Username: No sanitization anywhere

---

## PART 3: SVN USERNAME SPECIFICATION

### 3.1 SVN Documentation Research

**SVN Username Format (from SVN source & Apache docs):**

1. **No explicit character restrictions in SVN core**
   - SVN accepts any UTF-8 string as username
   - Repository admin can enforce restrictions
   - Common practice: alphanumeric + @.-_

2. **Common patterns observed:**
   ```
   alice                  → Simple username
   alice@example.com      → Email-style username
   DOMAIN\alice           → Windows AD username
   alice.smith            → Dotted username
   alice-dev              → Hyphenated username
   alice_admin            → Underscore username
   ```

3. **Characters known to work:**
   - Letters: a-z, A-Z
   - Numbers: 0-9
   - Special: @ . - _ (universally safe)

4. **Characters that MAY cause issues:**
   - Whitespace: " " (works but unusual)
   - Shell metacharacters: ; | & $ ` ( ) (SVN accepts, shells don't)
   - Control chars: \n \r \t \0 (undefined behavior)
   - Path separators: / \ (may confuse some systems)
   - Quotes: ' " (may break shell contexts)

5. **Restrictions typically enforced by admins:**
   - Length: 1-255 characters (practical limit)
   - No leading/trailing whitespace
   - No control characters
   - ASCII or UTF-8 only

### 3.2 Real-World Username Patterns

**Analysis of test usernames in codebase:**
```typescript
// From src/test/unit/services/svnAuthCache.test.ts:
"alice"              → Simple
"user1"              → Alphanumeric
"user@example.com"   → Email format
```

**Common enterprise patterns:**
- Active Directory: `DOMAIN\username` or `username@domain.com`
- LDAP: `cn=alice,ou=users,dc=example,dc=com` (rare for SVN)
- Email: `alice@example.com`
- Simple: `alice`, `alice.smith`, `alice_dev`

---

## PART 4: THREAT MODEL - USERNAME INJECTION

### 4.1 Argument Injection Attack

**Attack Vector:**
```typescript
// Attacker enters username:
"--config-option=servers:global:http-auth-types=none"

// Resulting SVN command:
svn update \
  --username --config-option=servers:global:http-auth-types=none \
  --password secretpass \
  --non-interactive

// SVN interpretation:
// --username expects a value
// Next arg: --config-option... (starts with --)
// SVN may treat as separate flag, breaking command or changing behavior
```

**Impact:**
- SVN command fails (DoS)
- SVN config options injected (security bypass)
- Username validation bypassed

**Likelihood:** LOW (SVN likely rejects or errors)

### 4.2 Newline Injection Attack

**Attack Vector:**
```typescript
// Attacker enters username with embedded newline:
"alice\n--password=attacker_password"

// Resulting args array:
["update", "--username", "alice\n--password=attacker_password", ...]

// cp.spawn behavior:
// Each array element is separate arg (null-terminated C string)
// Newline is part of arg value, not command separator
// SVN receives literal newline in username
```

**Result:**
```
SVN error: "No such user: alice<newline>--password=attacker_password"
Command fails, no injection occurs
```

**Impact:** DoS only (command fails)

**Likelihood:** VERY LOW (cp.spawn nullifies attack)

### 4.3 Filename Injection (Cache Files)

**Attack Vector:**
```typescript
// Attacker username:
"../../.bashrc"

// Cache file creation:
const realm = computeRealm(realmUrl); // "<https://svn.example.com> Auth Realm"
const hash = crypto.createHash("md5").update(realm).digest("hex");
const filePath = path.join(this.cacheDir, hash);
// Result: /home/user/.subversion/auth/svn.simple/a1b2c3d4...
```

**Analysis:**
- Username NOT used in filename calculation
- Filename = MD5(realm) where realm = computed from URL
- Path traversal not possible

**Impact:** NONE (username not in filename)

### 4.4 Content Injection (Cache Files)

**Attack Vector:**
```typescript
// Attacker username:
"alice\nK 8\npassword\nV 6\nhacked\nEND\n"

// Cache file content:
K 15
svn:realmstring
V 45
<https://svn.example.com> Authentication Realm
K 8
username
V 42
alice
K 8
password
V 6
hacked
END

K 8
password
V 10
actualpass
END
```

**SVN Parser Behavior:**
```python
# SVN reads K-V format line by line:
# 1. Read "K <length>"
# 2. Read next <length> bytes as key
# 3. Read "V <length>"
# 4. Read next <length> bytes as value
# 5. Stop at "END"

# For username with embedded K-V structure:
# Line: "K 8"
# Key: "username" (8 bytes)
# Line: "V 42"
# Value: "alice\nK 8\npassword\nV 6\nhacked\nEND\n" (42 bytes)
# SVN reads ALL 42 bytes as username value (including embedded structure)
# SVN doesn't re-parse username value as K-V
```

**Result:**
```
Username stored: "alice\nK 8\npassword\nV 6\nhacked\nEND\n" (literal)
SVN auth fails: "No such user" (username doesn't match server)
No injection occurs
```

**Impact:** DoS only (auth fails)

### 4.5 icacls Shell Injection (Windows)

**Attack Vector:**
```typescript
// In svnAuthCache.ts:319-330:
const username = process.env.USERNAME || process.env.USER || "%USERNAME%";
const args = [filePath, "/inheritance:r", "/grant:r", `${username}:F`];
const proc = spawn("icacls", args, { shell: true });
```

**Analysis:**
- Uses SYSTEM username (process.env.USERNAME), NOT SVN username
- SVN username never reaches this code path
- System username controlled by OS, not attacker

**Impact:** NONE (SVN username not used here)

---

## PART 5: USERNAME VALIDATION STRATEGY

### 5.1 Design Goals

1. **Security:** Block argument injection, newlines, control chars
2. **Compatibility:** Accept all legitimate SVN usernames
3. **Usability:** Clear error messages for rejected usernames
4. **Performance:** Fast validation (regex-based)

### 5.2 Recommended Validation Pattern

**Strategy: Allowlist + Length + No-Leading-Dash**

**Rationale:**
- Allowlist: Only permit known-safe characters
- Length: Prevent buffer overflows, filesystem limits
- No leading dash: Prevent argument injection

**Implementation:**

```typescript
/**
 * Validate SVN username for security and compatibility
 * 
 * Allowed patterns:
 * - Alphanumeric: a-z A-Z 0-9
 * - Email-safe: @ . - _
 * - UTF-8 letters: \p{L} (Unicode letters)
 * - UTF-8 numbers: \p{N} (Unicode numbers)
 * 
 * Restrictions:
 * - Length: 1-255 characters
 * - No leading dash (prevents argument injection)
 * - No control characters (prevents newline injection)
 * - No null bytes (prevents C-string issues)
 * 
 * @param username - Username to validate
 * @returns true if valid, false otherwise
 * @throws Error with descriptive message if invalid
 */
function validateUsername(username: string): boolean {
  // Check for null/undefined
  if (!username) {
    throw new Error("Username cannot be empty");
  }

  // Check length (1-255 chars)
  if (username.length < 1 || username.length > 255) {
    throw new Error("Username must be 1-255 characters");
  }

  // Check for leading dash (argument injection prevention)
  if (username.startsWith("-")) {
    throw new Error("Username cannot start with dash (-)");
  }

  // Check for control characters (including newlines, tabs, null bytes)
  if (/[\x00-\x1F\x7F]/.test(username)) {
    throw new Error("Username cannot contain control characters");
  }

  // Allowlist: alphanumeric + @ . - _ + Unicode letters/numbers
  // Pattern breakdown:
  //   ^                   - Start of string
  //   [a-zA-Z0-9@._\-]    - ASCII safe chars
  //   |\p{L}              - Unicode letters (for international names)
  //   |\p{N}              - Unicode numbers
  //   +                   - One or more
  //   $                   - End of string
  //   u flag              - Unicode mode
  const allowedPattern = /^[a-zA-Z0-9@._\-\p{L}\p{N}]+$/u;
  
  if (!allowedPattern.test(username)) {
    throw new Error(
      "Username can only contain letters, numbers, and @.-_ characters"
    );
  }

  return true;
}

// Usage:
try {
  validateUsername(userInput);
  // Proceed with authentication
} catch (err) {
  window.showErrorMessage(`Invalid username: ${err.message}`);
  return;
}
```

### 5.3 Alternative Patterns (Trade-offs)

**Option A: Strict ASCII-only (More Secure, Less Compatible)**
```typescript
// Pattern: Only a-zA-Z0-9@.-_
const pattern = /^[a-zA-Z0-9@._\-]+$/;

Pros:
+ Maximum security
+ No Unicode edge cases
+ Fast regex

Cons:
- Breaks international usernames (José, 王明, etc.)
- Incompatible with some LDAP setups
```

**Option B: Relaxed (More Compatible, Less Secure)**
```typescript
// Pattern: Block only dangerous chars
const dangerousPattern = /[\x00-\x1F\x7F;|&$`()<>\\'"]/;
if (dangerousPattern.test(username)) {
  throw new Error("Username contains invalid characters");
}

Pros:
+ Maximum compatibility
+ Accepts most international chars

Cons:
- Harder to maintain (blocklist grows)
- May miss edge cases
- Less predictable
```

**Option C: SVN-Specific (Query SVN for Allowed Chars)**
```typescript
// No validation - let SVN reject
// Rely on SVN's own username parsing

Pros:
+ 100% compatible with SVN
+ No maintenance needed

Cons:
- Exposes extension to injection attempts
- Poor user experience (cryptic SVN errors)
- No early validation
```

**Recommendation: Use Option (Recommended Pattern)**
- Good security/compatibility balance
- Blocks known attack vectors
- Accepts international usernames
- Clear error messages

### 5.4 Where to Apply Validation

**Validation Points (in order of execution):**

1. **UI Input (promptAuth.ts)** ✅ RECOMMENDED
   ```typescript
   const username = await window.showInputBox({
     placeHolder: "SVN username",
     validateInput: (value) => {
       try {
         validateUsername(value);
         return null; // Valid
       } catch (err) {
         return err.message; // Show error
       }
     }
   });
   ```
   
   **Pros:** Immediate user feedback, prevents bad input early
   **Cons:** Doesn't validate stored/cached credentials

2. **AuthService.setCredentials()** ✅ RECOMMENDED
   ```typescript
   public setCredentials(auth: IAuth | null): void {
     if (auth) {
       validateUsername(auth.username);
       this.svnRepository.username = auth.username;
     }
   }
   ```
   
   **Pros:** Validates ALL username sources (UI, cache, storage)
   **Cons:** May reject previously-valid stored credentials

3. **SvnAuthCache.writeCredential()** ⚠️ OPTIONAL
   ```typescript
   async writeCredential(username: string, password: string, realmUrl: string) {
     validateUsername(username);
     // ... rest of function
   }
   ```
   
   **Pros:** Defense in depth
   **Cons:** Redundant if validated earlier

4. **Svn.exec()** ❌ NOT RECOMMENDED
   ```typescript
   if (options.username) {
     validateUsername(options.username);
     args.push("--username", options.username);
   }
   ```
   
   **Pros:** Last line of defense
   **Cons:** Too late, poor error UX, performance overhead

**Recommendation:**
- Validate at UI input (immediate feedback)
- Validate at AuthService.setCredentials (catch all sources)
- Skip validation at execution layer (performance)

---

## PART 6: IMPLEMENTATION PLAN

### Step 1: Create Validation Utility

**File:** `src/util/usernameValidator.ts`

```typescript
/**
 * Username validation utility
 * Prevents injection attacks while maintaining SVN compatibility
 */

export class UsernameValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UsernameValidationError";
  }
}

export function validateUsername(username: string): void {
  if (!username || typeof username !== "string") {
    throw new UsernameValidationError("Username cannot be empty");
  }

  if (username.length < 1 || username.length > 255) {
    throw new UsernameValidationError("Username must be 1-255 characters");
  }

  if (username.startsWith("-")) {
    throw new UsernameValidationError(
      "Username cannot start with dash (-)"
    );
  }

  if (/[\x00-\x1F\x7F]/.test(username)) {
    throw new UsernameValidationError(
      "Username cannot contain control characters"
    );
  }

  const allowedPattern = /^[a-zA-Z0-9@._\-\p{L}\p{N}]+$/u;
  if (!allowedPattern.test(username)) {
    throw new UsernameValidationError(
      "Username can only contain letters, numbers, and @.-_ characters"
    );
  }
}

export function isValidUsername(username: string): boolean {
  try {
    validateUsername(username);
    return true;
  } catch {
    return false;
  }
}
```

### Step 2: Apply to UI Input

**File:** `src/commands/promptAuth.ts`

```typescript
import { validateUsername, UsernameValidationError } from "../util/usernameValidator";

public async execute(prevUsername?: string, prevPassword?: string) {
  const username = await window.showInputBox({
    placeHolder: "SVN username",
    prompt: "Enter your SVN username",
    ignoreFocusOut: true,
    value: prevUsername,
    validateInput: (value: string) => {
      if (!value) {
        return null; // Allow empty during typing
      }
      try {
        validateUsername(value);
        return null; // Valid
      } catch (err) {
        if (err instanceof UsernameValidationError) {
          return err.message;
        }
        return "Invalid username";
      }
    }
  });
  
  if (username === undefined) {
    return; // User cancelled
  }

  // Final validation before proceeding
  try {
    validateUsername(username);
  } catch (err) {
    window.showErrorMessage(`Invalid username: ${err.message}`);
    return;
  }

  // ... rest of function
}
```

### Step 3: Apply to AuthService

**File:** `src/services/authService.ts`

```typescript
import { validateUsername, UsernameValidationError } from "../util/usernameValidator";

public setCredentials(auth: IAuth | null): void {
  if (!auth) {
    this.svnRepository.username = undefined;
    this.svnRepository.password = undefined;
  } else {
    try {
      validateUsername(auth.username);
    } catch (err) {
      if (err instanceof UsernameValidationError) {
        throw new Error(`Invalid SVN username: ${err.message}`);
      }
      throw err;
    }
    
    this.svnRepository.username = auth.username;
    this.svnRepository.password = auth.password;
  }
}
```

### Step 4: Add Tests

**File:** `src/test/unit/util/usernameValidator.test.ts`

```typescript
import * as assert from "assert";
import { validateUsername, UsernameValidationError, isValidUsername } from "../../../util/usernameValidator";

suite("Username Validator", () => {
  suite("Valid usernames", () => {
    test("should accept simple username", () => {
      assert.doesNotThrow(() => validateUsername("alice"));
    });

    test("should accept username with numbers", () => {
      assert.doesNotThrow(() => validateUsername("user123"));
    });

    test("should accept email format", () => {
      assert.doesNotThrow(() => validateUsername("alice@example.com"));
    });

    test("should accept dotted username", () => {
      assert.doesNotThrow(() => validateUsername("alice.smith"));
    });

    test("should accept hyphenated username", () => {
      assert.doesNotThrow(() => validateUsername("alice-dev"));
    });

    test("should accept underscore username", () => {
      assert.doesNotThrow(() => validateUsername("alice_admin"));
    });

    test("should accept max length (255 chars)", () => {
      const longName = "a".repeat(255);
      assert.doesNotThrow(() => validateUsername(longName));
    });
  });

  suite("Invalid usernames", () => {
    test("should reject empty username", () => {
      assert.throws(
        () => validateUsername(""),
        UsernameValidationError
      );
    });

    test("should reject null username", () => {
      assert.throws(
        () => validateUsername(null as any),
        UsernameValidationError
      );
    });

    test("should reject username starting with dash", () => {
      assert.throws(
        () => validateUsername("-alice"),
        /cannot start with dash/
      );
    });

    test("should reject username with newline", () => {
      assert.throws(
        () => validateUsername("alice\nattacker"),
        /control characters/
      );
    });

    test("should reject username with null byte", () => {
      assert.throws(
        () => validateUsername("alice\x00attacker"),
        /control characters/
      );
    });

    test("should reject username with semicolon", () => {
      assert.throws(
        () => validateUsername("alice;rm -rf"),
        /letters, numbers, and @.-_/
      );
    });

    test("should reject username over 255 chars", () => {
      const tooLong = "a".repeat(256);
      assert.throws(
        () => validateUsername(tooLong),
        /1-255 characters/
      );
    });

    test("should reject username with pipe", () => {
      assert.throws(
        () => validateUsername("alice|attacker"),
        /letters, numbers, and @.-_/
      );
    });
  });

  suite("isValidUsername helper", () => {
    test("should return true for valid username", () => {
      assert.strictEqual(isValidUsername("alice"), true);
    });

    test("should return false for invalid username", () => {
      assert.strictEqual(isValidUsername("-alice"), false);
    });
  });
});
```

### Step 5: Add Security Tests

**File:** `src/test/unit/security/usernameInjection.test.ts`

```typescript
import * as assert from "assert";
import { validateUsername } from "../../../util/usernameValidator";

suite("Username Injection Prevention", () => {
  suite("Argument injection", () => {
    test("should reject argument injection attempt", () => {
      const payload = "--config-option=dangerous";
      assert.throws(() => validateUsername(payload));
    });

    test("should reject flag injection", () => {
      const payload = "--password=stolen";
      assert.throws(() => validateUsername(payload));
    });
  });

  suite("Newline injection", () => {
    test("should reject newline in username", () => {
      const payload = "alice\n--password=attacker";
      assert.throws(() => validateUsername(payload));
    });

    test("should reject carriage return", () => {
      const payload = "alice\r--password=attacker";
      assert.throws(() => validateUsername(payload));
    });
  });

  suite("Control character injection", () => {
    test("should reject null byte", () => {
      const payload = "alice\x00attacker";
      assert.throws(() => validateUsername(payload));
    });

    test("should reject tab character", () => {
      const payload = "alice\tattacker";
      assert.throws(() => validateUsername(payload));
    });

    test("should reject DEL character", () => {
      const payload = "alice\x7Fattacker";
      assert.throws(() => validateUsername(payload));
    });
  });

  suite("Shell metacharacter injection", () => {
    const shellChars = [";", "|", "&", "$", "`", "(", ")", "<", ">", "\\", "'", '"'];
    
    shellChars.forEach(char => {
      test(`should reject shell metacharacter: ${char}`, () => {
        const payload = `alice${char}malicious`;
        assert.throws(() => validateUsername(payload));
      });
    });
  });
});
```

---

## PART 7: SUMMARY & RECOMMENDATIONS

### Key Findings

1. **Username Flow:**
   - Entry: UI input, SecretStorage, credential cache
   - Storage: Memory (Repository), SecretStorage, filesystem cache
   - Usage: SVN command args, cache files, logging

2. **Current Validation:** NONE

3. **Injection Risk:** MEDIUM
   - Shell injection: LOW (cp.spawn without shell)
   - Argument injection: MEDIUM (no validation on leading dash)
   - Newline injection: LOW (cp.spawn nullifies)
   - Control chars: MEDIUM (undefined behavior)

4. **SVN Username Spec:**
   - No official restrictions
   - Common: alphanumeric + @.-_
   - Enterprise: email, AD usernames

### Recommended Validation Strategy

**Pattern:** Allowlist-based with UTF-8 support

```typescript
// Allowed: a-z A-Z 0-9 @ . - _ + Unicode letters/numbers
// Blocked: Control chars, shell metacharacters, leading dash
// Length: 1-255 characters
const pattern = /^[a-zA-Z0-9@._\-\p{L}\p{N}]+$/u;
```

**Validation Points:**
1. ✅ UI input (promptAuth.ts) - Immediate feedback
2. ✅ AuthService.setCredentials() - Catch all sources
3. ❌ Svn.exec() - Skip (performance, late)

**Implementation Effort:** 2-3 hours
- 30 min: Create validator utility
- 30 min: Apply to UI + AuthService
- 60 min: Write comprehensive tests
- 30 min: Documentation + changelog

### Action Items

**Priority P0 (Security):**
- [ ] Create username validator utility
- [ ] Apply validation to promptAuth.ts
- [ ] Apply validation to AuthService.setCredentials
- [ ] Add unit tests (30+ test cases)
- [ ] Add security tests (injection prevention)

**Priority P1 (Documentation):**
- [ ] Document username format in README
- [ ] Add validation section to SECURITY.md
- [ ] Update CHANGELOG with security fix
- [ ] Add code comments explaining validation

**Priority P2 (Monitoring):**
- [ ] Log rejected usernames (sanitized)
- [ ] Track validation failures (metrics)
- [ ] Review rejected patterns quarterly

---

**Document Version:** 1.0
**Last Updated:** 2025-11-21
**Classification:** Security Analysis
**Next Steps:** Review with team, prioritize implementation
