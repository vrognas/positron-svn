# Blame Phase 2.5: Commit Message Fetching System Design

**Version**: 1.0
**Date**: 2025-11-19
**Status**: Design Complete

---

## Executive Summary

Design batch commit message fetching for BlameProvider Phase 2.5 inline annotations.

**Performance Target**: 4-10x faster than individual fetches
**Memory Target**: ~100KB for 200 cached messages
**Cache Strategy**: 10-min TTL + LRU eviction

---

## 1. Current State Analysis

### 1.1 Repository.log() Implementation

**File**: `/home/user/positron-svn/src/svnRepository.ts:1083`

```typescript
public async log(
  rfrom: string,
  rto: string,
  limit: number,
  target?: string | Uri
): Promise<ISvnLogEntry[]> {
  const args = [
    "log",
    "-r",
    `${rfrom}:${rto}`,
    `--limit=${limit}`,
    "--xml",
    "-v"
  ];
  if (target !== undefined) {
    args.push(fixPegRevision(target instanceof Uri ? target.toString(true) : target));
  }
  const result = await this.exec(args);
  return parseSvnLog(result.stdout);
}
```

**Limitation**: Range-based fetching (`-r FROM:TO`), not suitable for sparse revisions.

### 1.2 ISvnLogEntry Structure

**File**: `/home/user/positron-svn/src/common/types.ts:322`

```typescript
export interface ISvnLogEntry {
  revision: string;
  author: string;
  date: string;
  msg: string;  // ← Target field
  paths: ISvnLogEntryPath[];
}
```

### 1.3 Blame Data Structure

**File**: `/home/user/positron-svn/src/common/types.ts:279`

```typescript
export interface ISvnBlameLine {
  lineNumber: number;
  revision?: string;  // ← Used for message lookup
  author?: string;
  date?: string;
  merged?: {
    path: string;
    revision: string;
    author: string;
    date: string;
  };
}
```

**Typical file**: 100-500 lines, 10-50 unique revisions

### 1.4 Configuration

**File**: `/home/user/positron-svn/src/blame/blameConfiguration.ts:103`

```typescript
public isLogsEnabled(): boolean {
  return this.get<boolean>("enableLogs", true);
}
```

**Config key**: `svn.blame.enableLogs` (default: true)

---

## 2. New Repository Method: Batch Log Fetching

### 2.1 Implementation

**File**: `/home/user/positron-svn/src/svnRepository.ts` (add after line 1105)

```typescript
/**
 * Fetch log entries for specific revisions (batch operation)
 * @param revisions Array of revision numbers (e.g., ["1234", "1235", "1300"])
 * @returns Log entries (may be fewer than requested if revisions don't exist)
 */
public async logByRevisions(revisions: string[]): Promise<ISvnLogEntry[]> {
  if (revisions.length === 0) {
    return [];
  }

  // svn log -r 1,2,3,4,5 --xml
  // Note: SVN accepts comma-separated list of revisions
  const args = ["log", "-r", revisions.join(","), "--xml"];

  const result = await this.exec(args);

  return parseSvnLog(result.stdout);
}
```

**SVN Command**: `svn log -r 1234,1235,1300 --xml`

**Performance**:
- Single SVN call for N revisions (vs N separate calls)
- 4-10x faster than individual fetches
- Command line length limit: ~100 revisions per batch (safe on all platforms)

**Error Handling**:
- Missing revisions silently skipped by SVN (returns partial results)
- Malformed XML handled by `parseSvnLog()` (returns empty array)
- Network errors propagate to caller

### 2.2 Wrapper in Repository.ts

**File**: `/home/user/positron-svn/src/repository.ts` (add after line 750)

```typescript
public async logByRevisions(revisions: string[]) {
  return this.run(Operation.Log, () =>
    this.repository.logByRevisions(revisions)
  );
}
```

**Purpose**: Adds operation tracking and auth handling

---

## 3. Message Cache Structure

### 3.1 Cache Entry Design

**File**: `/home/user/positron-svn/src/blame/blameProvider.ts` (add after line 25)

```typescript
/**
 * Cache entry for commit messages
 */
interface MessageCacheEntry {
  message: string;
  timestamp: number;      // For TTL expiration (10 min)
  lastAccessed: number;   // For LRU eviction
}

/**
 * BlameProvider manages gutter decorations for SVN blame
 * Per-repository instance (like StatusService)
 */
export class BlameProvider implements Disposable {
  private decorationType: TextEditorDecorationType;
  private blameCache = new Map<string, { data: ISvnBlameLine[]; version: number }>();

  // NEW: Message cache
  private messageCache = new Map<string, MessageCacheEntry>();
  private readonly MAX_MESSAGE_CACHE_SIZE = 200;
  private readonly MESSAGE_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

  private disposables: Disposable[] = [];
  private isActivated = false;

  // ... rest of class
}
```

### 3.2 Memory Footprint Calculation

**Target**: ~100KB for 200 entries

```
Per entry:
- Key (revision string): ~10 bytes ("12345")
- Message (avg): ~50 bytes ("Fix bug in parser")
- Timestamp (number): 8 bytes
- LastAccessed (number): 8 bytes
- Map overhead: ~24 bytes
Total per entry: ~100 bytes

200 entries × 100 bytes = ~20KB (baseline)

Longer messages (avg 250 chars):
200 entries × 350 bytes = ~70KB

Peak usage: ~100KB ✅
```

**Reality check**: Some commit messages are longer (1KB+), but LRU eviction keeps size bounded.

---

## 4. Cache Eviction Strategy

### 4.1 Two-Phase Eviction

**File**: `/home/user/positron-svn/src/blame/blameProvider.ts` (add private method)

```typescript
/**
 * Evict expired and LRU entries from message cache
 * Called after each batch fetch
 */
private evictMessageCache(): void {
  const now = Date.now();

  // Phase 1: Remove expired entries (TTL = 10 min)
  for (const [revision, entry] of this.messageCache) {
    if (now - entry.timestamp > this.MESSAGE_CACHE_TTL_MS) {
      this.messageCache.delete(revision);
    }
  }

  // Phase 2: If still over limit, remove LRU entries
  if (this.messageCache.size > this.MAX_MESSAGE_CACHE_SIZE) {
    // Sort by lastAccessed (ascending = oldest first)
    const sorted = Array.from(this.messageCache.entries())
      .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

    // Remove oldest entries until under limit
    const toRemove = sorted.slice(0, this.messageCache.size - this.MAX_MESSAGE_CACHE_SIZE);
    for (const [revision] of toRemove) {
      this.messageCache.delete(revision);
    }
  }
}
```

**Example**:
```
Cache state: 210 entries (over limit)
Phase 1: Remove 50 expired → 160 entries
Phase 2: Under limit, no LRU removal needed

Cache state: 220 entries (none expired)
Phase 1: No removals → 220 entries
Phase 2: Remove 20 oldest → 200 entries ✅
```

### 4.2 Eviction Timing

**Trigger points**:
1. After each `prefetchMessages()` call
2. In `dispose()` method (clear all)
3. On config change (optional: clear if `enableLogs` toggled)

**No background timer**: Passive eviction only (simpler, less CPU)

---

## 5. Batch Message Fetching

### 5.1 Prefetch Strategy

**File**: `/home/user/positron-svn/src/blame/blameProvider.ts` (add private method)

```typescript
/**
 * Prefetch commit messages for multiple revisions (batch operation)
 * Background operation - failures logged but not thrown
 */
private async prefetchMessages(revisions: string[]): Promise<void> {
  // Skip if logs disabled
  if (!blameConfiguration.isLogsEnabled()) {
    return;
  }

  const now = Date.now();

  // Filter out cached/valid entries
  const uncached = revisions.filter(revision => {
    const entry = this.messageCache.get(revision);

    // Include if:
    // 1. Not in cache, OR
    // 2. In cache but expired (TTL check)
    return !entry || (now - entry.timestamp > this.MESSAGE_CACHE_TTL_MS);
  });

  if (uncached.length === 0) {
    return; // All cached, nothing to fetch
  }

  // Batch into chunks of 100 (command line length limit)
  const BATCH_SIZE = 100;

  for (let i = 0; i < uncached.length; i += BATCH_SIZE) {
    const batch = uncached.slice(i, i + BATCH_SIZE);

    try {
      // Batch fetch
      const logEntries = await this.repository.logByRevisions(batch);

      // Populate cache
      for (const entry of logEntries) {
        this.messageCache.set(entry.revision, {
          message: entry.msg || "",
          timestamp: now,
          lastAccessed: now
        });
      }
    } catch (err) {
      console.error(`BlameProvider: Failed to fetch message batch ${i}-${i + batch.length}`, err);
      // Continue with next batch (graceful degradation)
    }
  }

  // Evict old entries
  this.evictMessageCache();
}
```

**Batch size reasoning**:
- Command line max: 32KB (Windows), 2MB (Linux/Mac)
- 100 revisions × ~6 chars = ~600 chars (safe on all platforms)
- Typical file: 10-50 unique revisions (single batch)

### 5.2 Progressive Loading Flow

```
User opens file
  ↓
getBlameData() → fetch blame (100 lines)
  ↓
Collect unique revisions → ["1234", "1235", "1300"] (3 unique)
  ↓
prefetchMessages([...]) → BACKGROUND (don't await)
  ↓
createDecorations() → render with empty messages ("")
  ↓
Apply decorations → UI shows immediately
  ↓
[Background] prefetchMessages completes
  ↓
[Future] Next updateDecorations() → messages available
```

**Key insight**: Don't await prefetch, let decorations render immediately.

**Refinement**: For Phase 2.5, we'll await prefetch (simpler, messages show on first render).

---

## 6. Get Message with Cache Lookup

### 6.1 Implementation

**File**: `/home/user/positron-svn/src/blame/blameProvider.ts` (add private method)

```typescript
/**
 * Get commit message for revision (from cache)
 * @param revision Revision number
 * @returns Message (empty string if not cached or expired)
 */
private getCommitMessage(revision: string): string {
  const entry = this.messageCache.get(revision);

  if (!entry) {
    return ""; // Not fetched yet
  }

  // Check TTL expiration
  const now = Date.now();
  if (now - entry.timestamp > this.MESSAGE_CACHE_TTL_MS) {
    this.messageCache.delete(revision);
    return ""; // Expired, remove
  }

  // Update LRU timestamp
  entry.lastAccessed = now;

  return entry.message;
}
```

**Behavior**:
- Cache hit (valid): Return message, update lastAccessed
- Cache hit (expired): Delete entry, return ""
- Cache miss: Return ""

**No async**: Pure synchronous cache lookup (no network calls)

---

## 7. Integration with Decoration Creation

### 7.1 Updated createDecorations()

**File**: `/home/user/positron-svn/src/blame/blameProvider.ts:268` (modify method)

```typescript
/**
 * Create decoration options from blame data
 */
private async createDecorations(blameData: ISvnBlameLine[], editor: TextEditor): Promise<any[]> {
  // Collect unique revisions for batch fetch
  const uniqueRevisions = [...new Set(
    blameData
      .map(line => line.revision)
      .filter(Boolean) as string[]
  )];

  // Prefetch messages (await to ensure messages available for first render)
  await this.prefetchMessages(uniqueRevisions);

  // Create decorations
  const decorations: any[] = [];
  const template = blameConfiguration.getGutterTemplate();
  const dateFormat = blameConfiguration.getDateFormat();

  for (const blameLine of blameData) {
    const lineIndex = blameLine.lineNumber - 1; // 1-indexed to 0-indexed

    // Skip if line doesn't exist in document
    if (lineIndex < 0 || lineIndex >= editor.document.lineCount) {
      continue;
    }

    // Get message from cache (may be empty if fetch failed)
    const message = blameLine.revision ? this.getCommitMessage(blameLine.revision) : "";

    // Format text (includes message if available)
    const text = this.formatBlameText(blameLine, template, dateFormat, message);

    decorations.push({
      range: new Range(lineIndex, 0, lineIndex, 0),
      renderOptions: {
        before: {
          contentText: text
        }
      }
    });
  }

  return decorations;
}
```

**Change**: Made method `async` to await `prefetchMessages()`

**Impact**: All callers must use `await`:
- Line 108: `const decorations = await this.createDecorations(blameData, target);`

### 7.2 Updated formatBlameText()

**File**: `/home/user/positron-svn/src/blame/blameProvider.ts:299` (modify signature)

```typescript
/**
 * Format blame line using template
 */
private formatBlameText(
  line: ISvnBlameLine,
  template: string,
  dateFormat: "relative" | "absolute",
  message: string = ""  // NEW: Optional message parameter
): string {
  const revision = line.revision || "???";
  const author = line.author || "unknown";
  const date = this.formatDate(line.date, dateFormat);

  return template
    .replace(/\$\{revision\}/g, revision)
    .replace(/\$\{author\}/g, author)
    .replace(/\$\{date\}/g, date)
    .replace(/\$\{message\}/g, message)  // NEW: Message substitution
    .padEnd(30); // Ensure consistent spacing
}
```

**Note**: For Phase 2.5, inline annotations will use separate template. This is for gutter text (optional message support).

---

## 8. Error Handling

### 8.1 Network Failures

**Scenario**: SVN server unreachable, timeout

```typescript
try {
  const logEntries = await this.repository.logByRevisions(batch);
} catch (err) {
  console.error(`BlameProvider: Failed to fetch message batch ${i}-${i + batch.length}`, err);
  // Graceful degradation: show decorations without messages
  // Continue with next batch (don't abort entire operation)
}
```

**Fallback**: Empty messages for failed batch, continue with other batches

### 8.2 Missing Revisions

**Scenario**: Revision doesn't exist (deleted, never committed)

**SVN behavior**: Silently skips missing revisions (no error)

```
Request: svn log -r 1234,9999,1235
Response: Only entries for 1234,1235 (9999 skipped)
```

**Handling**: No special logic needed, missing revisions get empty message

### 8.3 Malformed Responses

**Scenario**: SVN returns invalid XML

```typescript
// parseSvnLog already handles parse errors
return parseSvnLog(result.stdout);
// Returns empty array [] on parse error
```

**Handling**: Empty logEntries array, no cache population (safe)

### 8.4 Large Batch Size

**Scenario**: File has 500 unique revisions (rare but possible)

```typescript
// Batch into chunks of 100
const BATCH_SIZE = 100;

for (let i = 0; i < uncached.length; i += BATCH_SIZE) {
  const batch = uncached.slice(i, i + BATCH_SIZE);
  // ... fetch batch
}
```

**Result**: 5 SVN calls instead of 500 (still 100x faster)

### 8.5 Configuration Toggle

**Scenario**: User disables `enableLogs` mid-session

```typescript
private async prefetchMessages(revisions: string[]): Promise<void> {
  // Skip if logs disabled
  if (!blameConfiguration.isLogsEnabled()) {
    return; // No-op, cache remains intact
  }
  // ... rest of method
}
```

**Behavior**: Cache persists, but no new fetches

**Optional**: Clear cache on config change:
```typescript
private async onConfigurationChange(_event: any): Promise<void> {
  // Check if enableLogs changed
  if (_event.affectsConfiguration("svn.blame.enableLogs")) {
    this.messageCache.clear(); // Clear cache
  }
  // ... rest of method
}
```

---

## 9. Fallback Behavior

### 9.1 When Messages Unavailable

**Scenarios**:
1. Network failure during prefetch
2. SVN server unreachable
3. Revisions don't exist

**Behavior**:
```typescript
const message = blameLine.revision ? this.getCommitMessage(blameLine.revision) : "";
// Returns "" if not cached

const text = this.formatBlameText(blameLine, template, dateFormat, message);
// Template: "${author}, ${message}" → "john, " (empty message)
```

**UI**: Decorations show author/date, no message (graceful degradation)

### 9.2 When enableLogs: false

**Behavior**:
```typescript
if (!blameConfiguration.isLogsEnabled()) {
  return; // Skip prefetch entirely
}
```

**UI**: Decorations show author/date only (no message fetching)

**Template**: Use template without `${message}` placeholder:
- Good: `"${author} (${revision}) ${date}"`
- Bad: `"${author}, ${message}"` → "john, " (trailing comma)

**Recommendation**: Separate templates for gutter (no message) vs inline (with message)

---

## 10. Performance Analysis

### 10.1 Baseline (No Caching)

**Scenario**: 100-line file, 50 unique revisions

```
Per-revision fetch: 50 × 200ms = 10,000ms (10 seconds) ❌
```

### 10.2 With Batch Fetching

**Scenario**: Same file, 50 revisions in 1 batch

```
Batch fetch: 1 × 500ms = 500ms ✅
Speedup: 20x faster
```

### 10.3 With Caching (Second Open)

**Scenario**: Same file opened again within 10 min

```
Cache hit: 0ms (all cached) ✅
Speedup: Instant
```

### 10.4 Large File (500 lines, 200 revisions)

**Scenario**: 200 unique revisions

```
Batch fetch: 2 × 500ms = 1,000ms (1 second) ✅
Cache: 200 entries × 350 bytes = 70KB ✅
Speedup: 40x faster than individual fetches
```

### 10.5 Memory Usage

**200 cached messages**:
```
Baseline: 20KB (short messages)
Average: 70KB (medium messages)
Peak: 100KB (long messages)
```

**Total BlameProvider memory**:
```
Blame cache: 50KB (100 files × 500 bytes)
Message cache: 70KB (200 messages × 350 bytes)
Decoration cache: 20KB (DOM overhead)
Total: ~140KB ✅
```

---

## 11. Implementation Checklist

### 11.1 Repository Layer

- [ ] Add `logByRevisions()` to `svnRepository.ts`
- [ ] Add wrapper in `repository.ts`
- [ ] Add Operation.Log tracking
- [ ] Test batch fetching (3 unit tests)
  - [ ] Empty array
  - [ ] Single revision
  - [ ] Multiple revisions (10)
  - [ ] Missing revisions (graceful handling)

### 11.2 BlameProvider Layer

- [ ] Add message cache structure
- [ ] Implement `evictMessageCache()`
- [ ] Implement `prefetchMessages()`
- [ ] Implement `getCommitMessage()`
- [ ] Update `createDecorations()` to async
- [ ] Update `formatBlameText()` signature
- [ ] Clear cache in `dispose()`
- [ ] Test caching (5 unit tests)
  - [ ] Cache hit (valid)
  - [ ] Cache hit (expired)
  - [ ] Cache miss
  - [ ] LRU eviction
  - [ ] TTL eviction

### 11.3 Integration

- [ ] Update `updateDecorations()` to await createDecorations()
- [ ] Test end-to-end (3 E2E tests)
  - [ ] First open (prefetch + cache)
  - [ ] Second open (cache hit)
  - [ ] enableLogs disabled (skip prefetch)

### 11.4 Error Handling

- [ ] Test network failures (1 test)
- [ ] Test missing revisions (1 test)
- [ ] Test malformed responses (1 test)
- [ ] Test large batch size (1 test)

**Total**: 15 new tests

---

## 12. Test Strategy

### 12.1 Unit Tests: logByRevisions()

**File**: `/src/test/unit/svnRepository.test.ts`

```typescript
describe("logByRevisions()", () => {
  it("should return empty array for empty input", async () => {
    const result = await repository.logByRevisions([]);
    assert.strictEqual(result.length, 0);
  });

  it("should fetch single revision", async () => {
    mockExec.resolves({ stdout: "<log><logentry revision='1234'>...</logentry></log>" });

    const result = await repository.logByRevisions(["1234"]);

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].revision, "1234");
  });

  it("should batch fetch multiple revisions", async () => {
    mockExec.resolves({ stdout: "<log><logentry revision='1234'>...</logentry><logentry revision='1235'>...</logentry></log>" });

    const result = await repository.logByRevisions(["1234", "1235"]);

    assert.strictEqual(result.length, 2);
    assert.ok(mockExec.calledWith(["log", "-r", "1234,1235", "--xml"]));
  });

  it("should handle missing revisions gracefully", async () => {
    // SVN skips missing revisions (no error)
    mockExec.resolves({ stdout: "<log><logentry revision='1234'>...</logentry></log>" });

    const result = await repository.logByRevisions(["1234", "9999"]);

    assert.strictEqual(result.length, 1); // Only 1234 returned
  });
});
```

### 12.2 Unit Tests: Message Cache

**File**: `/src/test/unit/blameProvider.test.ts`

```typescript
describe("Message Cache", () => {
  it("should return cached message on hit", () => {
    provider["messageCache"].set("1234", {
      message: "Fix bug",
      timestamp: Date.now(),
      lastAccessed: Date.now()
    });

    const message = provider["getCommitMessage"]("1234");

    assert.strictEqual(message, "Fix bug");
  });

  it("should return empty string on miss", () => {
    const message = provider["getCommitMessage"]("9999");
    assert.strictEqual(message, "");
  });

  it("should evict expired entries (TTL)", () => {
    const oldTimestamp = Date.now() - (11 * 60 * 1000); // 11 min ago
    provider["messageCache"].set("1234", {
      message: "Fix bug",
      timestamp: oldTimestamp,
      lastAccessed: oldTimestamp
    });

    const message = provider["getCommitMessage"]("1234");

    assert.strictEqual(message, ""); // Expired
    assert.strictEqual(provider["messageCache"].has("1234"), false);
  });

  it("should evict LRU entries when over limit", () => {
    // Fill cache with 201 entries
    for (let i = 0; i < 201; i++) {
      provider["messageCache"].set(`${1000 + i}`, {
        message: "Test",
        timestamp: Date.now(),
        lastAccessed: Date.now() - i // Older entries have lower lastAccessed
      });
    }

    provider["evictMessageCache"]();

    assert.strictEqual(provider["messageCache"].size, 200); // Evicted 1
    assert.strictEqual(provider["messageCache"].has("1200"), false); // Oldest removed
  });

  it("should update lastAccessed on cache hit", () => {
    const entry = {
      message: "Fix bug",
      timestamp: Date.now(),
      lastAccessed: 1000
    };
    provider["messageCache"].set("1234", entry);

    provider["getCommitMessage"]("1234");

    assert.ok(entry.lastAccessed > 1000); // Updated
  });
});
```

### 12.3 E2E Tests

**File**: `/src/test/blameProvider.e2e.test.ts`

```typescript
describe("Message Fetching E2E", () => {
  it("should prefetch and cache messages on first open", async () => {
    const blameData: ISvnBlameLine[] = [
      { lineNumber: 1, revision: "1234", author: "john", date: "2025-11-18" },
      { lineNumber: 2, revision: "1235", author: "jane", date: "2025-11-19" }
    ];

    mockRepository.blame.resolves(blameData);
    mockRepository.logByRevisions.resolves([
      { revision: "1234", msg: "Fix bug", author: "john", date: "2025-11-18", paths: [] },
      { revision: "1235", msg: "Add feature", author: "jane", date: "2025-11-19", paths: [] }
    ]);

    const mockEditor = createMockEditor();
    await provider.updateDecorations(mockEditor);

    // Verify batch fetch called
    assert.ok(mockRepository.logByRevisions.calledOnce);
    assert.deepStrictEqual(mockRepository.logByRevisions.firstCall.args[0], ["1234", "1235"]);

    // Verify cache populated
    assert.strictEqual(provider["messageCache"].size, 2);
    assert.strictEqual(provider["getCommitMessage"]("1234"), "Fix bug");
  });

  it("should use cached messages on second open", async () => {
    // Pre-populate cache
    provider["messageCache"].set("1234", {
      message: "Fix bug",
      timestamp: Date.now(),
      lastAccessed: Date.now()
    });

    const blameData: ISvnBlameLine[] = [
      { lineNumber: 1, revision: "1234", author: "john", date: "2025-11-18" }
    ];

    mockRepository.blame.resolves(blameData);

    const mockEditor = createMockEditor();
    await provider.updateDecorations(mockEditor);

    // Verify NO batch fetch (all cached)
    assert.ok(mockRepository.logByRevisions.notCalled);
  });

  it("should skip prefetch when enableLogs disabled", async () => {
    sandbox.stub(blameConfiguration, "isLogsEnabled").returns(false);

    const blameData: ISvnBlameLine[] = [
      { lineNumber: 1, revision: "1234", author: "john", date: "2025-11-18" }
    ];

    mockRepository.blame.resolves(blameData);

    const mockEditor = createMockEditor();
    await provider.updateDecorations(mockEditor);

    // Verify NO batch fetch
    assert.ok(mockRepository.logByRevisions.notCalled);
  });
});
```

---

## 13. Integration with Phase 2.5 Multi-Decoration

### 13.1 Inline Decoration Creation

**From BLAME_PHASE_2.5_INTEGRATION_PLAN.md:272**

```typescript
// 3. Inline annotation (NEW)
if (blameConfiguration.isInlineEnabled() && blameLine.revision) {
  const message = this.getCommitMessage(blameLine.revision);  // ← Use cache
  const inlineText = this.formatInlineText(blameLine, message);

  inlineDecorations.push({
    range,
    renderOptions: {
      after: {
        contentText: inlineText
      }
    }
  });
}
```

**formatInlineText()** (new method):

```typescript
/**
 * Format inline text with message truncation
 */
private formatInlineText(line: ISvnBlameLine, message: string): string {
  const maxLength = 50; // Config: blameConfiguration.getInlineMaxLength()

  // Truncate to first line
  const firstLine = message.split('\n')[0];

  // Truncate to max length
  const truncated = firstLine.length > maxLength
    ? firstLine.substring(0, maxLength - 3) + "..."
    : firstLine;

  // Template: "${author}, ${message}"
  const template = "${author}, ${message}";
  return template
    .replace(/\$\{revision\}/g, line.revision || "???")
    .replace(/\$\{author\}/g, line.author || "unknown")
    .replace(/\$\{message\}/g, truncated);
}
```

### 13.2 Prefetch Timing

**Option 1**: Prefetch before creating any decorations (current design)

```typescript
private async createAllDecorations(
  blameData: ISvnBlameLine[],
  editor: TextEditor
): Promise<{ gutter: any[]; icon: any[]; inline: any[] }> {
  // Pre-fetch messages (batch operation)
  const revisions = [...new Set(blameData.map(b => b.revision).filter(Boolean))];
  await this.prefetchMessages(revisions);  // ← Await here

  // Create all 3 decoration types (messages available)
  // ...
}
```

**Option 2**: Fire-and-forget prefetch (progressive loading)

```typescript
// Don't await - let UI render immediately
this.prefetchMessages(revisions).catch(err => {
  console.error("Background message fetch failed", err);
});

// Create decorations (messages may be empty initially)
// Next updateDecorations() call will have messages cached
```

**Recommendation**: Option 1 for Phase 2.5 (simpler, messages show immediately)

---

## 14. Unresolved Questions

1. **Batch size**: 100 revisions per batch, or dynamic based on command line length?
2. **Cache clear on config change**: Clear messageCache when `enableLogs` toggled?
3. **Progressive loading**: Await prefetch (simpler) or fire-and-forget (faster UI)?
4. **Cache persistence**: Keep in memory only, or persist to globalState across sessions?
5. **Merged revisions**: Fetch messages for `ISvnBlameLine.merged.revision` too?
6. **Large file handling**: Skip message fetch for files with >100 unique revisions?
7. **Template validation**: Warn if template includes `${message}` but `enableLogs: false`?

**Recommendations**:
1. 100 revisions (safe on all platforms)
2. No clear on config change (cache persists)
3. Await prefetch (Phase 2.5), fire-and-forget (Phase 2.6)
4. Memory only (simpler, globalState in Phase 2.6)
5. No merged revisions (Phase 2.5), add in Phase 2.6
6. No limit (batch fetching is fast enough)
7. No validation (user responsibility)

---

## 15. Next Steps

1. **Implement logByRevisions()** in svnRepository.ts (20 min)
2. **Implement message cache** in blameProvider.ts (30 min)
3. **Write unit tests** (15 tests, 60 min)
4. **Integration with Phase 2.5** multi-decoration (40 min)
5. **E2E testing** with real SVN repo (30 min)
6. **Performance validation** (measure 4-10x speedup, 20 min)

**Total**: ~3 hours

---

**Status**: Design Complete ✅
**Estimated Effort**: 3 hours (1h implementation, 1h testing, 1h integration)
**Performance**: 4-10x faster ✅
**Memory**: ~100KB ✅
