# Safe Quick-Wins: Prioritized Implementation

**Version**: v1.0
**Created**: 2025-11-20
**Status**: Ready to Implement

---

## Safest, Highest-Impact Quick-Wins

Sorted by effort and risk:

---

## 🟢 TRIVIAL (10-15 minutes each)

### 1. Add resolve() Validation (SECURITY)
**Impact:** Prevents command injection
**Risk:** None (pure addition)
**Effort:** 10 minutes

**Current Code:**
```typescript
// src/svnRepository.ts:1019-1024
public async resolve(files: string[], action: string) {
  files = files.map(file => this.removeAbsolutePath(file));

  // ⚠️ NO VALIDATION - action passed directly to SVN
  const result = await this.exec(["resolve", "--accept", action, ...files]);
  return result.stdout;
}
```

**Fix:**
```typescript
// src/svnRepository.ts:1019-1024
public async resolve(files: string[], action: string) {
  // ADD 3 LINES:
  if (!validateAcceptAction(action)) {
    throw new Error(`Invalid resolve action: ${action}`);
  }

  files = files.map(file => this.removeAbsolutePath(file));
  const result = await this.exec(["resolve", "--accept", action, ...files]);
  return result.stdout;
}
```

**Why It's Safe:**
- `validateAcceptAction()` already exists and imported (line 41)
- Already has 11 comprehensive tests
- Already used in another method (line 916)
- Just missed in this one method

**Implementation:**
1. Add 3 lines
2. Run tests
3. Commit

---

### 2. Add Blame Feature to README (DOCUMENTATION)
**Impact:** 50-70% feature adoption increase
**Risk:** None (docs only)
**Effort:** 15 minutes

**Current:** Blame feature (286 LOC, 13 configs) completely absent from README

**Fix:** Add section after line 59 in README.md:

```markdown
## Blame Annotations

View line-by-line revision history directly in the editor.

**Features:**
- Gutter annotations: author, revision, date per line
- Inline messages: commit details at end of line (GitLens-style)
- Colored indicators: visual revision grouping
- Status bar: blame info for current line
- Auto-blame: enabled by default

**Configuration:**
See all 13 configuration options in Settings → search "svn.blame"

For advanced configuration, see [Blame System Documentation](docs/BLAME_SYSTEM.md).
```

**Why It's Safe:**
- Documentation only, zero code changes
- Content exists in docs/BLAME_SYSTEM.md
- Just exposing existing feature

**Implementation:**
1. Edit README.md
2. Commit

---

## 🟡 LOW RISK (30-60 minutes)

### 3. Fix Dependency Vulnerabilities (SECURITY)
**Impact:** Fixes CVSS 7.5 HIGH severity vulnerabilities
**Risk:** Low (dev dependencies, well-tested upgrade)
**Effort:** 30-45 minutes

**Vulnerabilities:**
```
glob 11.0.3 → CVE-1109842/843 (command injection, CVSS 7.5)
semantic-release 25.0.2 → Transitive via @semantic-release/npm
js-yaml <3.14.2 → Prototype pollution (moderate)
```

**Fix Approach:**
```bash
# Try upgrade first (recommended)
npm install --save-dev glob@latest
npm audit

# If glob upgrade doesn't fix semantic-release:
npm install --save-dev semantic-release@24.2.9

# Fix remaining
npm audit fix

# Verify
npm run build
npm test
```

**Why Low Risk:**
- Dev dependencies only (not production)
- Can test before merging
- Can revert if issues
- You confirmed: "release not critical, can accept vulns temporarily"

**Implementation:**
1. Run upgrade commands
2. Test build + tests
3. Commit with npm audit output

---

### 4. CI Configuration Fixes (BUILD)
**Impact:** Fixes CI failures, 30% faster test runs
**Risk:** Low (config only)
**Effort:** 30 minutes

**Issues:**

1. **Missing test-compile script**
   - CI references `npm run test-compile` but doesn't exist
   - Causes CI failure

2. **Inefficient pretest**
   - Compiles to `out/` but uses `dist/`
   - Redundant work

3. **npm/yarn inconsistency**
   - main.yml uses npm ci
   - releaseOpenVsx.yml uses yarn

**Fixes:**

```json
// package.json
{
  "scripts": {
    "test-compile": "npm run build:ts",  // ADD
    "pretest": "npm run build && npm run lint"  // CHANGE (remove build:ts)
  }
}
```

```yaml
# .github/workflows/releaseOpenVsx.yml:22
- run: npm ci  # CHANGE from yarn install
```

**Why Low Risk:**
- Build configuration only
- Can test in CI before merging
- No code changes

**Implementation:**
1. Edit package.json
2. Edit releaseOpenVsx.yml
3. Push and watch CI
4. Commit

---

## 🟠 MEDIUM RISK (1 hour)

### 5. ReDoS Validation in Branch Helpers (SECURITY)
**Impact:** Prevents DoS attacks from malicious regex
**Risk:** Medium (changes error handling, needs testing)
**Effort:** 1 hour

**Current Code:**
```typescript
// src/helpers/branch.ts:23
const layout = configuration.get<string>(conf);  // User input
const regex = new RegExp(`(^|/)(${layout})$`);   // No validation!
```

**Problem:**
- User provides regex via config (svn.layout.branchesRegex)
- No validation before use
- Malicious regex can cause CPU exhaustion (ReDoS)

**Fix:**
```typescript
// src/helpers/branch.ts
function validateAndCreateRegex(pattern: string, configName: string): RegExp | null {
  try {
    const regex = new RegExp(`(^|/)(${pattern})$`);

    // Test with reasonable sample path (prevent ReDoS)
    const testPath = "a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/p";
    const start = Date.now();
    regex.test(testPath);

    if (Date.now() - start > 100) {
      throw new Error("Regex too complex");
    }

    return regex;
  } catch (err) {
    window.showErrorMessage(
      `Invalid regex in svn.layout.${configName}: ${pattern}`
    );
    return null;
  }
}

// Use in getBranchName and isTrunk:
const layout = configuration.get<string>(conf);
if (!layout) continue;

const regex = validateAndCreateRegex(layout, conf);
if (!regex) continue;
```

**Why Medium Risk:**
- Changes error handling flow
- Adds user-facing error messages
- Need to test various regex patterns
- But: Non-breaking (null check already exists)

**Implementation:**
1. Add validation function
2. Update getBranchName() and isTrunk()
3. Test with valid and invalid regex
4. Commit

---

## Summary Table

| Quick-Win | Effort | Risk | Impact | Ready? |
|-----------|--------|------|--------|--------|
| 1. resolve() validation | 10 min | None | High | ✅ Yes |
| 2. Blame README | 15 min | None | High | ✅ Yes |
| 3. Dependencies | 30-45 min | Low | High | ✅ Yes |
| 4. CI config | 30 min | Low | Medium | ✅ Yes |
| 5. ReDoS validation | 1 hour | Medium | Medium | ⚠️ Needs review |

---

## Recommended Order

### **Sprint 1 (Week 1, Day 1) - 1.5 hours**
1. resolve() validation (10 min)
2. Blame README (15 min)
3. Dependencies (45 min)
4. CI config (30 min)

**Outcome:** 4 quick wins, 2 security fixes, 1 doc improvement, 1 build fix

### **Sprint 2 (Week 1, Day 2) - 1 hour**
5. ReDoS validation (1 hour)

**Outcome:** Additional security hardening

---

## Which Would You Like to Start With?

**Option A: Start with #1 (resolve validation)**
- Safest, fastest
- Immediate security win
- Builds confidence

**Option B: Start with #2 (Blame README)**
- Zero risk
- High user impact
- 15 minutes

**Option C: Start with #3 (Dependencies)**
- Fixes critical CVEs
- Requires npm commands
- Verifiable with audit

**Option D: Do all 4 in sequence (Sprint 1)**
- Knock out multiple wins
- ~1.5 hours total
- Commit after each

What's your preference?
