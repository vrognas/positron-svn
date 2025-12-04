# Lessons Learned

**Version**: v2.25.0
**Updated**: 2025-11-29

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

### 15. Remote SSH: Respect Native Credential Stores

**Lesson**: Don't disable system credential managers (gpg-agent, gnome-keyring) in remote environments.

**Issue** (v2.18.0):

- Extension always passed `--config-option config:auth:password-stores=` to SVN
- This disabled gpg-agent/gnome-keyring, breaking remote SSH workflows
- Password prompt cycled endlessly because:
  1. Extension credential cache needs `realmUrl` from `svn info`
  2. But `svn info` itself needs auth → chicken-egg problem
  3. Without cached credentials, SVN rejected `--password` on command line
  4. Auth failed, prompted again → infinite loop

**Fix** (v2.26.0 - simplified):

```typescript
// Use credentialMode setting with auto-detection
const mode = configuration.get("auth.credentialMode", "auto");
const isRemote = !!env.remoteName;
const useSystemKeyring =
  mode === "systemKeyring" || (mode === "auto" && !isRemote);

if (!useSystemKeyring) {
  args.push("--config-option", "config:auth:password-stores=");
  args.push("--config-option", "servers:global:store-auth-creds=no");
}
```

**Why auto mode works**:

- Detects local vs remote (SSH/WSL/container) automatically
- Local: Uses system keyring (gpg-agent, Keychain, Credential Manager)
- Remote: Uses VS Code SecretStorage (no keyring setup needed)

**Security** (v2.26.0):

- SVN 1.10+ uses `--password-from-stdin` (hides from process list)
- SVN < 1.10: Password NOT passed - must use system keyring
- Removed insecure `--password` command-line fallback

**Rule**: Default to `auto` mode - it handles most scenarios correctly.

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

### 16. Testing: Vitest for Unit Tests

**Lesson**: Use Vitest for unit tests, keep Mocha for VS Code E2E tests.

**Migration** (v2.23.0):

- Unit tests: Vitest (104 tests, runs in 1.5s)
- E2E tests: Mocha + @vscode/test-electron (needs VS Code API)
- Dual framework: Both run in parallel in CI

**Benefits**:

- 6-10x faster unit tests (no TypeScript compilation needed)
- Better error messages with object diffs
- Watch mode for development
- Built-in coverage (replaces c8)

**Pattern**:

```typescript
// Vitest (unit tests)
import { describe, it, expect, vi } from "vitest";
describe("Parser", () => {
  it("parses XML", () => {
    expect(result).toHaveLength(1);
  });
});

// Mocha (E2E tests needing VS Code)
suite("Extension", () => {
  test("activates", async () => {
    const ext = vscode.extensions.getExtension("...");
  });
});
```

**Key insight**: Mock `vscode` module via `vitest.config.ts` alias for unit tests.

**Rule**: Use Vitest for pure logic, Mocha only when VS Code API required.

---

### 18. SVN Locking for Large Files

**Lesson**: SVN's lock-modify-unlock workflow mitigates "poor SVN usage" in data science repos.

**Problem domains**:

- Monolithic checkouts (sparse checkout needed)
- Binary bloat (large CSVs, models, datasets)
- Locking ambiguity (unclear who has lock)
- Disconnected history (vague commit messages)

**Implementation** (v2.24.0):

- Commands: `lock`, `unlock`, `breakLock`
- Lock info in tooltips (🔒 Locked by <user>)
- Explorer context menu integration
- Directory locking support

**Pattern**:

```typescript
// Lock with optional comment
await repository.lock(files, { comment: "Editing dataset" });

// Break lock owned by another user
await repository.unlock(files, { force: true });

// Check lock status
const lockInfo = await repository.getLockInfo(filePath);
if (lockInfo) console.log(`Locked by ${lockInfo.owner}`);
```

**Rule**: Lock files before editing large binaries. Use lock comments for coordination.

---

### 19. CLI vs GUI Feature Parity

**Lesson**: Not all GUI options map to CLI flags. Research before implementing.

**Example** (v2.30.0 - Cleanup):

- TortoiseSVN has "Break locks" checkbox (calls C API directly)
- SVN CLI always breaks locks (hardcoded in `svn_client_cleanup2()`)
- No `--break-locks` flag exists - it's always on

**Pattern**:

1. Check SVN CLI `--help` for actual flags
2. Check if feature is hardcoded in CLI source
3. For GUI-only features, document limitation
4. Don't create "phantom" options that do nothing

**Reference**: [TortoiseSVN Cleanup](https://tortoisesvn.net/docs/release/TortoiseSVN_en/tsvn-dug-cleanup.html)

**Rule**: When porting from GUI to extension, verify CLI supports the feature.

---

### 20. Cleanup Error Detection: Multiple Codes

**Lesson**: SVN cleanup is needed for multiple error types, not just E155004.

**Error codes requiring cleanup** (v2.31.0):

- **E155004**: Working copy is locked
- **E155037**: Previous operation interrupted
- **E200030**: SQLite database busy/locked/corrupt
- **E155032**: Working copy database problem

**Text patterns**:

- "locked", "previous operation", "run 'cleanup'", "sqlite"

**E155015 (conflict) does NOT need cleanup**:

- Conflicts require `svn resolve`, not cleanup
- "Obstructed" status often needs delete + update, not cleanup

**UX Pattern**:

```typescript
if (needsCleanup(error)) {
  const choice = await window.showErrorMessage(msg, "Run Cleanup");
  if (choice === "Run Cleanup") {
    await commands.executeCommand("svn.cleanup");
  }
}
```

**Rule**: Offer actionable buttons for recoverable errors.

---

### 21. User-Friendly Errors: Show Code for Transparency

**Lesson**: Include error codes in user messages for transparency and googlability.

**Pattern** (v2.32.0):

```
"Working copy locked (E155004). Run cleanup to fix."
```

**Benefits**:

- User can Google the error code for more details
- Technical users get context they need
- Non-technical users get actionable guidance

**Implementation**:

```typescript
// Extract code, format message
const code = extractErrorCode(stderr); // E155004
return `Working copy locked (${code}). Run cleanup to fix.`;
```

**Action Buttons**: Match error type to action:

- Cleanup errors → "Run Cleanup" button
- Out-of-date → "Update" button
- Conflicts → "Resolve Conflicts" button

**Rule**: Always include error code in parentheses. Offer one actionable button per error type.

---

### 22. Timer Disposal: Store References

**Lesson**: Always store timer references and clear them in dispose().

**Issue** (v2.32.12):

- `setInterval()` and `setTimeout()` not cleared on extension reload
- Timers accumulate over reloads, causing memory leaks
- Especially problematic during development with frequent reloads

**Pattern**:

```typescript
// BAD: Timer created but never cleared
setInterval(() => this.cleanup(), FIVE_MINUTES);

// GOOD: Store reference, clear in dispose
private cleanupInterval?: ReturnType<typeof setInterval>;

constructor() {
  this.cleanupInterval = setInterval(() => this.cleanup(), FIVE_MINUTES);
}

dispose(): void {
  if (this.cleanupInterval) {
    clearInterval(this.cleanupInterval);
  }
}
```

**Rule**: Every `setInterval`/`setTimeout` needs corresponding `clearInterval`/`clearTimeout` in dispose().

---

**Document Version**: 2.12
**Last Updated**: 2025-12-04

### 23. VS Code TreeView Providers: Listen for Repository Open/Close Events

**Lesson**: TreeDataProviders created during extension activation may miss initial data if async initialization isn't complete.

**Issue** (v2.32.17):

- Repository Log and Selective Download treeviews displayed empty at startup
- Required manual refresh to show data
- Root cause: SourceControlManager scans workspace folders asynchronously (fire-and-forget)
- Providers created AFTER SourceControlManager constructor but BEFORE repositories discovered
- `sourceControlManager.repositories` was empty when providers called `getChildren()`

**Fix**:

```typescript
// In constructor, subscribe to lifecycle events
this._disposables.push(
  this.sourceControlManager.onDidOpenRepository(() => {
    this.refresh();
  }),
  this.sourceControlManager.onDidCloseRepository(() => {
    this.refresh();
  })
);
```

**Why this pattern is needed**:

- VS Code extensions often use async initialization for performance (non-blocking activation)
- TreeDataProviders may be created before data is available
- `onDidOpenRepository` fires when async discovery completes
- Without listening to this event, providers never know data is ready

**When to apply**:

- ✅ TreeDataProvider depends on async-discovered resources (repos, files, configs)
- ✅ Provider created during `activate()` before async init completes
- ✅ Data source fires lifecycle events (open, close, change)
- ❌ Static data available immediately at construction time

**Rule**: TreeDataProviders must subscribe to data source lifecycle events, not just change events.

---

### 24. SVN Peg Revision: Pass Separately, Don't Embed in Path

**Lesson**: Never manually embed SVN peg revisions into paths that will be processed by escaping functions.

**Issue** (v2.32.19):

- Repository Log diff commands failed with "path not found" error
- SVN error: `svn: E160013: '.../file.txt@367' path not found`
- Actual command sent: `svn log ... 'path@367@'` (double @)
- Root cause: Caller constructed `path@revision` then passed to `log()` method
- `log()` method called `fixPegRevision()` which added another `@` when it detected existing `@`

**Why this happens**:

```typescript
// BAD: Manual peg revision embedding
const pathWithPeg = `${remotePath}@${revision}`; // "file.txt@367"
await repo.log(..., pathWithPeg);
// log() calls fixPegRevision("file.txt@367") → "file.txt@367@"
// SVN interprets trailing @ as empty peg revision (HEAD)

// GOOD: Pass peg revision separately
await repo.log(..., remotePath, revision);
// log() calls fixPegRevision("file.txt") → "file.txt"
// Then appends "@367" → "file.txt@367"
```

**SVN Peg Revision Syntax**:

- `file.txt@100` = view file.txt at revision 100
- `file@2024.txt@100` = view file named "file@2024.txt" at revision 100
- `file.txt@100@` = view file named "file.txt@100" at HEAD (empty peg)
- `fixPegRevision()` adds trailing `@` to escape any `@` in filename

**Fix Pattern**:

```typescript
// Add optional pegRevision parameter to methods that call SVN
async log(rfrom, rto, limit, target?, pegRevision?: string) {
  let targetPath = fixPegRevision(targetStr);  // Escape @ in filename
  if (pegRevision) {
    targetPath += "@" + pegRevision;  // Add peg revision last
  }
  args.push(targetPath);
}
```

**Rule**: Pass peg revision as a separate parameter; let the SVN-calling method construct the final path.

---

### 25. Credential Lock Deadlock: No Nested retryRun Calls

**Lesson**: `credentialLock` in `retryRun()` causes deadlock when operations are nested within callbacks.

**Issue** (v2.32.20):

- "Update Revision" notification hung indefinitely after `svn update` and `svn info` completed
- Root cause: `updateRevision` callback called `await this.status()` which triggered nested `retryRun()`
- Parent `retryRun` held `credentialLock`, child `retryRun` waited for same lock = DEADLOCK

**Code path**:

```
run(Update, callback)
  → retryRun(callback)      // Acquires credentialLock
    → callback()
      → this.status()
        → run(Status)
          → retryRun()      // BLOCKED waiting for credentialLock!
```

**Fix**:

```typescript
// BEFORE: Nested run() call causes deadlock
await this.status(); // Calls run(Status) → retryRun()

// AFTER: Let parent run() handle model update
// run(Operation.Update) automatically calls updateModelState() after callback
void this.updateRemoteChangedFiles(); // Debounced, fires in background
```

**Why this works**:

- Every `run()` call with a non-read-only operation already calls `updateModelState()` after the callback
- Calling `this.status()` inside the callback was redundant AND caused the deadlock
- The fix removes the redundant call, letting the parent handle status refresh

**Rule**: Never call `run()` / `retryRun()` from within a `run()` callback. Let the parent handle post-callback work.

---

### 21. VS Code UX: Multi-Step QuickPick Patterns

**Lesson**: Use native VS Code QuickPick/InputBox for wizard-like flows, not webviews.

**Issue** (v2.33.0):

- Original commit UX required webview for commit message input
- Webview is heavy, context-switching, non-native feel
- Users expected Ctrl+Enter to commit like VS Code Git extension

**Fix**:

```typescript
// Multi-step QuickPick with step indicators
await window.showQuickPick(items, {
  title: "Commit (1/3): Select type", // Step indicator in title
  placeHolder: "Choose commit type"
});

// acceptInputCommand for Ctrl+Enter
sourceControl.acceptInputCommand = {
  command: "svn.commitFromInputBox",
  title: "Commit",
  arguments: [this]
};
```

**Pattern**:

1. Use QuickPick for selection steps (commit type, files)
2. Use InputBox for text entry (scope, description)
3. Title shows step progress ("1/3", "2/3", "3/3")
4. Final step shows confirmation with file preview
5. Wire `acceptInputCommand` for Ctrl+Enter from SCM input box

**Benefits**:

- Native VS Code look and feel
- Keyboard-driven (no mouse required)
- Faster than webview (no DOM rendering)
- Familiar to Git extension users

**Services**:

- `ConventionalCommitService`: Parse/format conventional commit messages
- `CommitFlowService`: Orchestrate multi-step QuickPick flow
- `PreCommitUpdateService`: Run SVN update before commit with progress

**Rule**: Prefer native VS Code UI (QuickPick, InputBox, Progress) over webviews for simple workflows.

---

### 26. Optimistic UI Updates: Skip Status Refresh for SCM Operations

**Lesson**: For stage/unstage operations, update UI immediately without waiting for full `svn status` refresh.

**Issue** (v2.33.x):

- Stage/unstage called full `svn status --xml` after each SVN changelist operation
- Each status call: ~100-500ms depending on working copy size
- Multiple rapid stage operations = cumulative delay (user sees lag)

**Fix**:

```typescript
// BEFORE: Full refresh after every operation
await repository.addChangelist(files, STAGING_CHANGELIST);
await repository.updateModelState(); // Full svn status --xml

// AFTER: Optimistic UI update
await repository.addChangelist(files, STAGING_CHANGELIST);
groupManager.moveToStaged(files); // Move Resource objects directly
```

**Pattern**:

1. Execute SVN operation (addChangelist/removeChangelist)
2. Directly manipulate Resource groups in memory
3. Skip updateModelState() refresh
4. Eventual consistency: next status poll corrects any drift

**Implementation**:

- `moveToStaged(paths)`: Remove from changes/changelists, add to staged
- `moveFromStaged(paths, targetChangelist?)`: Remove from staged, add to target
- Both methods update staging cache via `syncFromChangelist()`

**When to use**:

- ✅ Operations with predictable outcome (stage = move to staged group)
- ✅ User expects instant feedback (<100ms)
- ✅ Background refresh will eventually correct state
- ❌ Operations with uncertain outcome (merge, update with conflicts)
- ❌ Critical operations where accuracy > speed

**Rule**: For predictable SCM operations, update UI optimistically. Let background refresh handle edge cases.

---

### 27. Native Resources: Track and Dispose Separately

**Lesson**: Native Node.js resources (FSWatcher, process handlers) must be explicitly tracked and disposed.

**Issue** (v2.33.2):

- `fs.watch()` watcher created but never added to disposables array
- Process event handlers (`exit`, `SIGINT`, `SIGTERM`) never removed
- File handles leaked when repository closed
- Handlers accumulated during development reloads

**Fix**:

```typescript
// BAD: Native watcher not tracked
const watcher = watch(path, callback);
watcher.on("error", handleError);
// Never closed!

// GOOD: Track and close in dispose
private nativeWatcher?: FSWatcher;

constructor() {
  this.nativeWatcher = watch(path, callback);
}

dispose(): void {
  if (this.nativeWatcher) {
    this.nativeWatcher.close();
    this.nativeWatcher = undefined;
  }
}
```

**Process handlers**:

```typescript
// BAD: Handlers never removed
process.on("exit", cleanup);
process.on("SIGINT", handler);

// GOOD: Store references, remove on dispose
const sigintHandler = () => {
  cleanup();
  process.exit();
};
process.on("SIGINT", sigintHandler);
disposables.push(
  toDisposable(() => {
    process.removeListener("SIGINT", sigintHandler);
  })
);
```

**Rule**: Native resources don't implement IDisposable. Track them separately and clean up in dispose().

---
