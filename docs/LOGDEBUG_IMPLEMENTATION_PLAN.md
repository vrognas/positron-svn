# logDebug() OutputChannel Implementation Plan

**Version**: v1.0
**Created**: 2025-11-20
**Status**: Planning Phase
**Estimated Effort**: 3-4 hours

---

## Objective

Refactor `errorLogger.ts` to use VSCode OutputChannel instead of console, enabling:
1. User-visible debug logs (View → Output → "SVN")
2. Configurable verbose mode via `svn.debug.verbose`
3. Consistent logging across 30+ files using console.log

---

## Current State Analysis

### Existing Infrastructure

**OutputChannel (Already Exists):**
```typescript
// src/extension.ts:109
const outputChannel = window.createOutputChannel("Svn");
```
- User-visible at View → Output → "SVN"
- Currently only shows SVN command output
- Not connected to errorLogger

**errorLogger.ts (Current):**
```typescript
export function logError(message: string, error?: unknown): void {
  console.error(`${sanitizedMessage}:`, sanitizedError);  // ❌ Dev Tools only
}
```
- Sanitizes credentials (good!)
- Uses console.error (not user-visible)
- No debug logging utility

**Configuration System:**
```typescript
// src/helpers/configuration.ts
export const configuration = new Configuration();
configuration.get<boolean>("debug.verbose", false);
```
- Singleton pattern
- Event-driven (onDidChange)
- Workspace-aware

---

## Implementation Plan (TDD Approach)

Following LESSONS_LEARNED.md patterns: "Write 3 TDD tests first"

### Step 1: Write Tests (30 minutes)

**Create:** `src/test/unit/util/errorLogger.test.ts`

```typescript
import * as assert from "assert";
import { OutputChannel } from "vscode";
import { setOutputChannel, logError, logDebug, logInfo } from "../../../util/errorLogger";

suite("errorLogger", () => {
  let mockOutput: string[] = [];
  let mockChannel: OutputChannel;

  setup(() => {
    mockOutput = [];
    mockChannel = {
      appendLine: (line: string) => mockOutput.push(line),
      append: () => {},
      clear: () => {},
      dispose: () => {},
      hide: () => {},
      show: () => {},
      name: "test"
    } as any;

    setOutputChannel(mockChannel);
  });

  suite("logError", () => {
    test("should log error to output channel with timestamp", () => {
      logError("Test error", new Error("test message"));

      assert.strictEqual(mockOutput.length, 2);
      assert.ok(mockOutput[0].includes("[ERROR"));
      assert.ok(mockOutput[0].includes("Test error"));
      assert.ok(mockOutput[1].includes("test message"));
    });

    test("should sanitize credentials in error messages", () => {
      logError("Error with password", new Error("--password secret123"));

      assert.ok(!mockOutput.join("").includes("secret123"));
      assert.ok(mockOutput.join("").includes("***"));
    });

    test("should handle error without message", () => {
      logError("Context only");

      assert.strictEqual(mockOutput.length, 1);
      assert.ok(mockOutput[0].includes("Context only"));
    });
  });

  suite("logDebug", () => {
    test("should not log when verbose mode disabled", () => {
      // Default: verbose = false
      logDebug("test.function", "debug info");

      assert.strictEqual(mockOutput.length, 0);
    });

    test("should log when verbose mode enabled", () => {
      // Mock config: svn.debug.verbose = true
      // (Need to mock configuration.get())

      logDebug("test.function", "debug info", { key: "value" });

      assert.ok(mockOutput[0].includes("[DEBUG"));
      assert.ok(mockOutput[0].includes("test.function"));
      assert.ok(mockOutput[0].includes("debug info"));
    });

    test("should format objects as JSON", () => {
      // With verbose enabled
      logDebug("test.function", { foo: "bar", num: 123 });

      assert.ok(mockOutput[0].includes('"foo"'));
      assert.ok(mockOutput[0].includes('"bar"'));
    });
  });

  suite("logInfo", () => {
    test("should always log info messages", () => {
      logInfo("test.function", "info message");

      assert.strictEqual(mockOutput.length, 1);
      assert.ok(mockOutput[0].includes("[INFO"));
      assert.ok(mockOutput[0].includes("info message"));
    });
  });
});
```

**Test Strategy:**
- Test 1: Basic logging (happy path)
- Test 2: Credential sanitization (security)
- Test 3: Verbose mode toggle (configuration)

---

### Step 2: Refactor errorLogger.ts (1 hour)

**Changes:**

```typescript
/**
 * Safe error logging utility with OutputChannel support
 *
 * Logs to VSCode Output panel (View → Output → "SVN") instead of console.
 * Automatically sanitizes credentials to prevent leaks.
 *
 * Usage:
 * ```typescript
 * import { logError, logDebug, logInfo } from "./util/errorLogger";
 *
 * logError("svnRepository.getInfo", err);           // Always visible
 * logInfo("svnRepository.getInfo", "Starting...");  // Always visible
 * logDebug("svnRepository.getInfo", "Cache hit");   // Only if svn.debug.verbose=true
 * ```
 */

import { OutputChannel } from "vscode";
import { sanitizeError, sanitizeString } from "../security/errorSanitizer";
import { configuration } from "../helpers/configuration";

// Global output channel (set by extension.ts on activation)
let _outputChannel: OutputChannel | null = null;

/**
 * Set the output channel for logging
 * Called once during extension activation
 */
export function setOutputChannel(channel: OutputChannel): void {
  _outputChannel = channel;
}

/**
 * Format arguments for logging
 */
function formatArgs(args: any[]): string {
  return args
    .map(arg => {
      if (typeof arg === "object" && arg !== null) {
        try {
          return JSON.stringify(arg, null, 2);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    })
    .join(" ");
}

/**
 * Get formatted timestamp
 */
function getTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Safely log an error with automatic sanitization
 * Always logs to output channel (user-visible)
 *
 * @param context - Context identifier (e.g., "svnRepository.getInfo")
 * @param error - The error to log (optional)
 */
export function logError(context: string, error?: unknown): void {
  if (!_outputChannel) {
    console.error(`[ERROR] ${context}:`, error);
    return;
  }

  const sanitizedContext = sanitizeString(context);
  const timestamp = getTimestamp();

  _outputChannel.appendLine(`[ERROR ${timestamp}] ${sanitizedContext}`);

  if (error) {
    const sanitizedError = sanitizeError(
      error instanceof Error ? error : new Error(String(error))
    );
    _outputChannel.appendLine(sanitizedError.message);
    if (sanitizedError.stack) {
      _outputChannel.appendLine(sanitizedError.stack);
    }
  }
}

/**
 * Log informational messages
 * Always logs to output channel (user-visible)
 *
 * @param context - Context identifier
 * @param args - Messages/data to log
 */
export function logInfo(context: string, ...args: any[]): void {
  if (!_outputChannel) {
    console.log(`[INFO] ${context}:`, ...args);
    return;
  }

  const sanitizedContext = sanitizeString(context);
  const timestamp = getTimestamp();
  const message = formatArgs(args);
  const sanitizedMessage = sanitizeString(message);

  _outputChannel.appendLine(`[INFO ${timestamp}] ${sanitizedContext}: ${sanitizedMessage}`);
}

/**
 * Log debug information (only in verbose mode)
 * Controlled by svn.debug.verbose setting
 *
 * @param context - Context identifier (e.g., "svnRepository.getInfo")
 * @param args - Debug data to log
 */
export function logDebug(context: string, ...args: any[]): void {
  const verbose = configuration.get<boolean>("debug.verbose", false);

  if (!verbose) {
    return;
  }

  if (!_outputChannel) {
    console.log(`[DEBUG] ${context}:`, ...args);
    return;
  }

  const sanitizedContext = sanitizeString(context);
  const timestamp = getTimestamp();
  const message = formatArgs(args);
  const sanitizedMessage = sanitizeString(message);

  _outputChannel.appendLine(`[DEBUG ${timestamp}] ${sanitizedContext}: ${sanitizedMessage}`);
}

/**
 * Safely log a warning with automatic sanitization
 * Always logs to output channel (user-visible)
 *
 * @param context - Context identifier
 * @param args - Messages/data to log
 */
export function logWarning(context: string, ...args: any[]): void {
  if (!_outputChannel) {
    console.warn(`[WARN] ${context}:`, ...args);
    return;
  }

  const sanitizedContext = sanitizeString(context);
  const timestamp = getTimestamp();
  const message = formatArgs(args);
  const sanitizedMessage = sanitizeString(message);

  _outputChannel.appendLine(`[WARN ${timestamp}] ${sanitizedContext}: ${sanitizedMessage}`);
}

/**
 * Safely throw an error with sanitized message
 * Use this when re-throwing or creating errors from untrusted input
 *
 * @param message Error message
 * @param originalError Optional original error for context
 * @returns Error with sanitized message
 */
export function createSafeError(message: string, originalError?: unknown): Error {
  const sanitizedMessage = sanitizeString(message);
  const error = new Error(sanitizedMessage);

  if (originalError && originalError instanceof Error) {
    if (originalError.stack) {
      error.stack = sanitizeString(originalError.stack);
    }
  }

  return error;
}
```

**Key Changes:**
1. Added `_outputChannel` global variable
2. Added `setOutputChannel()` to connect from extension.ts
3. All log functions use outputChannel instead of console
4. Added `logDebug()` with verbose mode check
5. Added `logInfo()` for informational messages
6. Fallback to console if outputChannel not set (safety)
7. All output sanitized for credential safety

---

### Step 3: Connect in extension.ts (10 minutes)

**Add import:**
```typescript
import { setOutputChannel } from "./util/errorLogger";
```

**Connect in _activate():**
```typescript
async function _activate(context: ExtensionContext, disposables: Disposable[]) {
  const outputChannel = window.createOutputChannel("Svn");
  commands.registerCommand("svn.showOutput", () => outputChannel.show());
  disposables.push(outputChannel);

  // ↓ ADD THIS LINE
  setOutputChannel(outputChannel);

  const showOutput = configuration.get<boolean>("showOutput");
  // ... rest of activation
}
```

**That's it!** Now all logError() calls go to OutputChannel.

---

### Step 4: Add Configuration (10 minutes)

**Update package.json contributes:**

```json
{
  "svn.debug.verbose": {
    "type": "boolean",
    "description": "Enable verbose debug logging in SVN output channel (View → Output → SVN)",
    "default": false
  }
}
```

**Location:** After `svn.debug.disableSanitization` (around line 1289)

---

### Step 5: Run Tests (10 minutes)

```bash
# Compile TypeScript
npm run build:ts

# Run new tests
npm test -- --grep "errorLogger"

# Run all tests to ensure no regressions
npm test
```

**Expected:** All tests pass, no breaking changes

---

### Step 6: Manual Testing (20 minutes)

**Test Plan:**

1. **Start extension in debug mode:**
   - Press F5 in VSCode
   - Extension Host launches

2. **Open SVN repository**
   - Ensure extension activates

3. **Open Output panel:**
   - View → Output
   - Select "SVN" from dropdown

4. **Test logError:**
   - Trigger an error (e.g., commit with no message)
   - Verify error appears in output with [ERROR] prefix

5. **Test logDebug (disabled):**
   - Run SVN commands
   - Verify NO [DEBUG] logs appear (default: verbose=false)

6. **Enable verbose mode:**
   - Settings → `"svn.debug.verbose": true`
   - Run SVN commands again
   - Verify [DEBUG] logs now appear

7. **Test credential sanitization:**
   - Cause error with password in message
   - Verify password replaced with ***

---

## Phase 2: Replace console.log Calls (2-3 hours)

After errorLogger refactor is complete and tested:

### Step 1: Identify All console.log Calls

```bash
# Find all console usage (excluding safe locations)
grep -r "console\.(log|error|warn)" src/ \
  --exclude-dir=test \
  --exclude-dir=tools \
  | grep -v errorLogger.ts \
  | wc -l
```

**Expected:** ~30 files

### Step 2: Categorize by Context

```bash
# Get list with context
grep -rn "console\.(log|error|warn)" src/ \
  --exclude-dir=test \
  --exclude-dir=tools \
  | grep -v errorLogger.ts
```

**Categories:**

1. **Error handling** → `logError()`
   ```typescript
   // Before:
   console.error("Failed to get info:", err);

   // After:
   logError("svnRepository.getInfo", err);
   ```

2. **Debug info** → `logDebug()`
   ```typescript
   // Before:
   console.log("Cache hit for", file);

   // After:
   logDebug("svnRepository.getInfo", "Cache hit for", file);
   ```

3. **Informational** → `logInfo()`
   ```typescript
   // Before:
   console.log("Repository initialized");

   // After:
   logInfo("extension.activate", "Repository initialized");
   ```

### Step 3: Replace Systematically

**Order:** High-traffic files first
1. `src/svnRepository.ts` (core)
2. `src/repository.ts` (core)
3. `src/svn.ts` (execution)
4. `src/commands/*.ts` (user actions)
5. Others

**Pattern:**
```typescript
// Add import at top
import { logError, logDebug, logInfo } from "../util/errorLogger";

// Replace each console.* call
// Add context: filename.functionName or filename.className.methodName
```

### Step 4: Verify No Regressions

After each file:
```bash
npm run build:ts
npm test
```

---

## Configuration Documentation

### User-Facing (README.md)

Add section after "Settings":

```markdown
### Debug Logging

Enable verbose debug logging to troubleshoot issues:

1. Open Settings (File → Preferences → Settings)
2. Search for "svn.debug.verbose"
3. Enable the checkbox
4. View logs at View → Output → "SVN"

**When to enable:**
- Diagnosing extension issues
- Reporting bugs (attach logs)
- Understanding what the extension is doing

**Performance impact:** Minimal (logs only written when enabled)
```

### Developer-Facing (CONTRIBUTING.md)

Add logging guidelines:

```markdown
## Logging Guidelines

Use errorLogger utilities instead of console:

```typescript
import { logError, logDebug, logInfo } from "./util/errorLogger";

// Error logging (always visible to users)
try {
  await operation();
} catch (err) {
  logError("className.methodName", err);
}

// Debug logging (only when svn.debug.verbose=true)
logDebug("className.methodName", "Processing", fileName, "cache hit");

// Informational logging (always visible)
logInfo("className.methodName", "Operation completed successfully");
```

**Context naming convention:**
- Format: `fileName.functionName` or `className.methodName`
- Examples: `svnRepository.getInfo`, `repository.updateModelState`
- Helps users/developers locate source of logs
```

---

## Rollout Plan

### Phase 1: Foundation (Week 1, Day 1-2)
- ✅ Write tests
- ✅ Refactor errorLogger.ts
- ✅ Connect in extension.ts
- ✅ Add configuration
- ✅ Test manually
- ✅ Commit: "Feat: Add logDebug() with OutputChannel support"

### Phase 2: Migration (Week 1, Day 3-5)
- Replace console.log in core files (svnRepository, repository, svn)
- Replace console.log in command files
- Replace console.log in remaining files
- Commit: "Refactor: Replace console.log with errorLogger utilities"

### Phase 3: Documentation (Week 1, Day 5)
- Update README.md
- Update CONTRIBUTING.md (if exists)
- Commit: "Docs: Add debug logging documentation"

---

## Success Criteria

### Technical
- ✅ All tests pass
- ✅ No regressions in existing functionality
- ✅ OutputChannel receives all logs
- ✅ Verbose mode toggles debug logs
- ✅ Credentials sanitized in all logs

### User Experience
- ✅ Users can view logs without Developer Tools
- ✅ Logs are timestamped and readable
- ✅ Debug mode enables verbose output
- ✅ Performance impact negligible

### Code Quality
- ✅ No console.log in production code (except fallbacks)
- ✅ Consistent logging patterns across codebase
- ✅ Clear context in all log statements

---

## Risk Mitigation

### Risk 1: Breaking Existing Error Handling
**Mitigation:**
- Preserve all existing logError() calls (just refactor internals)
- Fallback to console if outputChannel not set
- Test thoroughly before merging

### Risk 2: Configuration Not Loading
**Mitigation:**
- Default to false (no debug logs)
- Test configuration.get() returns expected value
- Add null checks

### Risk 3: Performance Impact from Verbose Logging
**Mitigation:**
- Check verbose flag BEFORE formatting (early return)
- Only log when outputChannel exists
- Sanitization already optimized (existing code)

### Risk 4: Lost Debug Information
**Mitigation:**
- Preserve all context in migration
- Add more context than before (filename.method)
- Test each migrated file manually

---

## Open Questions

1. **Should we add log levels beyond ERROR/INFO/DEBUG?**
   - TRACE for ultra-verbose?
   - FATAL for critical errors?

   **Decision:** Start with 3 levels, add more if needed

2. **Should logDebug() be namespaced?**
   ```typescript
   logDebug("svn.repository.getInfo", ...)  // vs
   logDebug("svnRepository.getInfo", ...)
   ```

   **Decision:** Use filename.method (simpler, matches existing patterns)

3. **Should we add a "Show Logs" command?**
   - Already exists: `svn.showOutput` command

   **Decision:** Use existing command, document it

4. **Should tests mock configuration.get()?**
   - Currently tests assume verbose=false

   **Decision:** Mock configuration in tests for verbose=true case

---

## Appendix: Example Output

### With verbose=false (default):
```
[ERROR 2025-11-20T10:15:30.123Z] svnRepository.commit: Failed to commit
Error: working copy is locked
  at Repository.commit (repository.ts:450)
  ...

[INFO 2025-11-20T10:16:45.456Z] extension.activate: Extension activated successfully
```

### With verbose=true:
```
[DEBUG 2025-11-20T10:15:29.000Z] svnRepository.getInfo: Fetching info for file.txt
[DEBUG 2025-11-20T10:15:29.100Z] svnRepository.getInfo: Cache miss, executing svn info
[DEBUG 2025-11-20T10:15:30.000Z] svn.exec: Executing: svn info --xml file.txt
[ERROR 2025-11-20T10:15:30.123Z] svnRepository.commit: Failed to commit
Error: working copy is locked
  at Repository.commit (repository.ts:450)
  ...

[INFO 2025-11-20T10:16:45.456Z] extension.activate: Extension activated successfully
```

---

## Next Steps

1. **Review this plan** - Approve/modify approach
2. **Run Phase 1** - Implement errorLogger refactor (4 hours)
3. **Test & commit** - Ensure no regressions
4. **Run Phase 2** - Replace console.log (2-3 hours)
5. **Document** - Update user/developer docs

**Ready to proceed?**
