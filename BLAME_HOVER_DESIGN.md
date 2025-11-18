# SVN Blame Hover Tooltip Design

**Version**: 1.0
**Date**: 2025-11-18
**Status**: Design Complete

---

## 1. VSCode Hover API

### 1.1 HoverProvider Interface

VSCode provides `HoverProvider` interface in `vscode` module:

```typescript
import { HoverProvider, Hover, TextDocument, Position, CancellationToken, MarkdownString } from 'vscode';

interface HoverProvider {
  provideHover(
    document: TextDocument,
    position: Position,
    token: CancellationToken
  ): ProviderResult<Hover>;
}
```

### 1.2 Registration

Register via `languages.registerHoverProvider()`:

```typescript
// In extension.ts activation
const hoverProvider = new BlameHoverProvider(repository);
context.subscriptions.push(
  languages.registerHoverProvider(
    { scheme: 'file' },  // Support file:// URIs
    hoverProvider
  )
);
```

### 1.3 Hover Object

```typescript
class Hover {
  contents: MarkdownString | MarkdownString[];  // Rich content
  range?: Range;  // Optional highlight range
}
```

**Key features**:
- Supports **Markdown** for rich formatting
- Can return multiple MarkdownString sections
- Optional range highlights affected code
- Cancellable via CancellationToken

---

## 2. Hover Content Format

### 2.1 Markdown Structure

Use **MarkdownString** for rich tooltips with:
- Bold/italic text
- Code blocks
- Hyperlinks (internal commands)
- Icons via `$(icon-name)` syntax
- Horizontal rules for sections

### 2.2 Content Layout

**Priority 1: Core Info**
```
$(git-commit) Revision r1234
$(person) Author Name
$(clock) 2 days ago
```

**Priority 2: Commit Message** (if `enableLogs: true`)
```
---
feat: Add hover support for blame
- Markdown formatting
- Merged revision handling
```

**Priority 3: Merged Info** (if ISvnBlameLine.merged exists)
```
---
$(git-merge) Merged from path/to/file
  r5678 by Other Author, 5 days ago
```

### 2.3 Template Examples

**Standard hover** (non-merged, with message):
```markdown
$(git-commit) **Revision** r1234
$(person) **Author** John Doe
$(clock) **Date** 2 days ago

---

**Message**
feat: Add hover support

Implement HoverProvider for blame tooltips
```

**Merged revision hover**:
```markdown
$(git-commit) **Revision** r1234
$(person) **Author** John Doe
$(clock) **Date** 2 days ago

---

$(git-merge) **Merged** from `src/original/file.ts`
  r5678 by Jane Smith, 5 days ago

---

**Message**
fix: Merge upstream changes
```

**Minimal hover** (logs disabled, no merge):
```markdown
$(git-commit) **Revision** r1234
$(person) **Author** John Doe
$(clock) **Date** 2 days ago
```

---

## 3. Date Formatting

### 3.1 Relative Format (Default)

Use **dayjs** with `relativeTime` plugin (already in codebase):

```typescript
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

function formatRelativeDate(isoDate: string): string {
  return dayjs(isoDate).fromNow();
}

// Examples:
// "2 days ago"
// "3 hours ago"
// "a month ago"
// "just now"
```

**Pattern**: Follow `getCommitDescription()` in `historyView/common.ts:233`

### 3.2 Absolute Format

Use **locale-aware** formatting via native Date:

```typescript
function formatAbsoluteDate(isoDate: string): string {
  const date = new Date(isoDate);

  // Use locale-aware long format
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

// Examples (en-US):
// "Nov 15, 2025, 3:45:23 PM"
// "Jan 3, 2025, 9:12:01 AM"
```

**Fallback**: If date parsing fails, show raw ISO string

### 3.3 Date Formatting Function

```typescript
function formatDate(isoDate: string, format: "relative" | "absolute"): string {
  if (!isoDate) {
    return "Unknown date";
  }

  try {
    if (format === "relative") {
      return dayjs(isoDate).fromNow();
    } else {
      const date = new Date(isoDate);
      if (isNaN(date.getTime())) {
        return isoDate;  // Fallback to raw
      }
      return date.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  } catch (err) {
    return isoDate;  // Fallback
  }
}
```

---

## 4. Merged Revision Display

### 4.1 ISvnBlameLine.merged Structure

```typescript
interface ISvnBlameLine {
  lineNumber: number;
  revision?: string;
  author?: string;
  date?: string;
  merged?: {
    path: string;      // Original file path
    revision: string;  // Original revision
    author: string;    // Original author
    date: string;      // Original date
  };
}
```

### 4.2 Visual Distinction

**Merged revisions** should stand out visually:

1. **Icon**: `$(git-merge)` prefix
2. **Indentation**: 2-space indent for nested info
3. **Code format**: Path in backticks
4. **Separator**: Horizontal rule above

### 4.3 Merged Content Template

```markdown
$(git-merge) **Merged** from `${merged.path}`
  r${merged.revision} by ${merged.author}, ${formatDate(merged.date)}
```

**Full example**:
```markdown
$(git-commit) **Revision** r1234
$(person) **Author** John Doe (merged)
$(clock) **Date** 2 days ago

---

$(git-merge) **Merged** from `src/utils/helpers.ts`
  r5678 by Jane Smith, 5 days ago

---

**Message**
Merge branch 'feature-x' into main
```

---

## 5. Commit Message Fetching

### 5.1 Strategy: Lazy Fetch with Cache

**Approach**: Fetch on hover (not during initial blame)

**Rationale**:
- Blame without logs is **4-10x faster** (per ARCHITECTURE_ANALYSIS.md:211)
- Users may not hover every line
- Hover is async - acceptable to show "Loading..." briefly

**Cache**: Use existing `Repository._logCache` pattern

### 5.2 Configuration Check

```typescript
if (blameConfiguration.isLogsEnabled()) {
  // Fetch commit message
  commitMessage = await repository.getCommitMessage(revision);
} else {
  // Skip - show minimal hover
  commitMessage = null;
}
```

### 5.3 Fetch Implementation

```typescript
// In Repository class
private _commitMessageCache = new Map<string, {
  message: string;
  timestamp: number;
}>();
private readonly COMMIT_MESSAGE_CACHE_TTL_MS = 10 * 60 * 1000; // 10min

public async getCommitMessage(revision: string): Promise<string | null> {
  const cacheKey = `msg:${revision}`;
  const cached = this._commitMessageCache.get(cacheKey);

  if (cached && (Date.now() - cached.timestamp < this.COMMIT_MESSAGE_CACHE_TTL_MS)) {
    return cached.message;
  }

  try {
    // Use existing log() method
    const logEntries = await this.log(revision, revision, 1);
    const message = logEntries[0]?.msg || "";

    this._commitMessageCache.set(cacheKey, {
      message,
      timestamp: Date.now()
    });

    return message;
  } catch (err) {
    logError(`Failed to fetch commit message for r${revision}`, err);
    return null;
  }
}
```

### 5.4 Loading State

Show temporary content while fetching:

```typescript
async provideHover(document, position, token) {
  const blameLine = await this.getBlameLine(document, position);

  // Show immediate content without message
  const hover = this.buildHoverContent(blameLine, null);

  // Fetch message async (non-blocking)
  if (blameConfiguration.isLogsEnabled()) {
    this.fetchCommitMessage(blameLine.revision).then(message => {
      // Update hover if still visible (best-effort)
    });
  }

  return hover;
}
```

**Note**: VSCode doesn't support dynamic hover updates, so initial display won't include message. User can re-hover to see cached message.

---

## 6. Performance Optimization

### 6.1 Caching Strategy

**Three-tier cache**:

1. **Blame data**: 5min TTL, 100 entries (existing `Repository._blameCache`)
2. **Commit messages**: 10min TTL, 500 entries (new `_commitMessageCache`)
3. **Hover content**: Session-based (dispose on file close)

### 6.2 Cancellation Support

```typescript
async provideHover(document, position, token: CancellationToken) {
  if (token.isCancellationRequested) {
    return null;
  }

  const blameLine = await this.getBlameLine(document, position);

  if (token.isCancellationRequested) {
    return null;
  }

  return this.buildHover(blameLine);
}
```

### 6.3 Lazy Activation

Only activate hover provider when:
1. `svn.blame.enabled === true`
2. File has active blame state (per `BlameStateManager`)

**Optimization**: Dispose provider when blame disabled globally

---

## 7. Error Handling

### 7.1 Missing Blame Data

**Scenario**: User hovers before blame loaded

```typescript
async provideHover(document, position, token) {
  const uri = document.uri;
  const blameState = blameStateManager.get(uri);

  if (!blameState || !blameState.blameData) {
    return null;  // No hover
  }

  const line = position.line;
  const blameLine = blameState.blameData.find(b => b.lineNumber === line + 1);

  if (!blameLine) {
    return null;  // Line not blamed (e.g., working copy change)
  }

  return this.buildHover(blameLine);
}
```

### 7.2 Invalid Revision Data

**Scenario**: Blame line missing author/date/revision

```typescript
function buildHover(blameLine: ISvnBlameLine): Hover {
  const content = new MarkdownString();
  content.isTrusted = true;

  if (!blameLine.revision) {
    content.appendMarkdown("**Uncommitted changes**\n\n");
    content.appendMarkdown("Working copy modifications");
    return new Hover(content);
  }

  const revision = blameLine.revision || "???";
  const author = blameLine.author || "Unknown";
  const date = blameLine.date
    ? formatDate(blameLine.date, blameConfiguration.getDateFormat())
    : "Unknown date";

  // ... build content
}
```

### 7.3 Message Fetch Failure

**Scenario**: `getCommitMessage()` throws error

```typescript
let message: string | null = null;

if (blameConfiguration.isLogsEnabled()) {
  try {
    message = await repository.getCommitMessage(blameLine.revision!);
  } catch (err) {
    // Log silently, show hover without message
    logError(`Hover: Failed to fetch message for r${blameLine.revision}`, err);
  }
}
```

**Fallback**: Show hover without message section

### 7.4 Date Parsing Errors

**Scenario**: Invalid ISO date string

```typescript
function formatDate(isoDate: string, format: "relative" | "absolute"): string {
  try {
    // ... formatting logic
  } catch (err) {
    logError(`Failed to format date: ${isoDate}`, err);
    return isoDate;  // Return raw string
  }
}
```

---

## 8. Implementation Plan

### 8.1 File Structure

**New files**:
- `/src/blame/blameHoverProvider.ts` (130-180 lines)

**Modified files**:
- `/src/extension.ts` (register hover provider)
- `/src/svnRepository.ts` (add `getCommitMessage()` method)
- `/src/blame/blameStateManager.ts` (expose blame data for hover)

### 8.2 API Usage Patterns

**Pattern 1: Provider Registration**

```typescript
// extension.ts
import { BlameHoverProvider } from './blame/blameHoverProvider';

export async function activate(context: ExtensionContext) {
  // ... existing activation

  const repository = /* get repository instance */;
  const hoverProvider = new BlameHoverProvider(repository);

  context.subscriptions.push(
    languages.registerHoverProvider(
      { scheme: 'file', pattern: '**/*' },
      hoverProvider
    )
  );
}
```

**Pattern 2: Build Hover Content**

```typescript
// blameHoverProvider.ts
import { HoverProvider, Hover, MarkdownString } from 'vscode';

class BlameHoverProvider implements HoverProvider {
  async provideHover(document, position, token) {
    // 1. Get blame state
    const blameState = blameStateManager.get(document.uri);
    if (!blameState?.blameData) return null;

    // 2. Find line blame
    const blameLine = blameState.blameData[position.line];
    if (!blameLine?.revision) return null;

    // 3. Build content
    const content = new MarkdownString();
    content.isTrusted = true;
    content.supportHtml = false;

    // 4. Add core info
    content.appendMarkdown(`$(git-commit) **Revision** r${blameLine.revision}\n\n`);
    content.appendMarkdown(`$(person) **Author** ${blameLine.author}\n\n`);
    content.appendMarkdown(`$(clock) **Date** ${this.formatDate(blameLine.date)}\n\n`);

    // 5. Add merged info (if exists)
    if (blameLine.merged) {
      content.appendMarkdown(`---\n\n`);
      content.appendMarkdown(`$(git-merge) **Merged** from \`${blameLine.merged.path}\`\n\n`);
      content.appendMarkdown(`  r${blameLine.merged.revision} by ${blameLine.merged.author}, `);
      content.appendMarkdown(`${this.formatDate(blameLine.merged.date)}\n\n`);
    }

    // 6. Add commit message (if enabled)
    if (blameConfiguration.isLogsEnabled()) {
      const message = await this.getCommitMessage(blameLine.revision);
      if (message) {
        content.appendMarkdown(`---\n\n`);
        content.appendMarkdown(`**Message**\n\n${message}\n`);
      }
    }

    return new Hover(content);
  }
}
```

### 8.3 Content Formatting Examples

**Example 1: Standard commit**

Input:
```typescript
{
  lineNumber: 42,
  revision: "1234",
  author: "john.doe",
  date: "2025-11-16T14:30:00.000Z"
}
```

Output (relative date):
```markdown
$(git-commit) **Revision** r1234
$(person) **Author** john.doe
$(clock) **Date** 2 days ago

---

**Message**
feat: Add blame hover support

Implement HoverProvider with Markdown formatting
```

**Example 2: Merged revision**

Input:
```typescript
{
  lineNumber: 55,
  revision: "1234",
  author: "john.doe",
  date: "2025-11-16T14:30:00.000Z",
  merged: {
    path: "src/utils/helpers.ts",
    revision: "5678",
    author: "jane.smith",
    date: "2025-11-10T10:15:00.000Z"
  }
}
```

Output (absolute date):
```markdown
$(git-commit) **Revision** r1234
$(person) **Author** john.doe
$(clock) **Date** Nov 16, 2025, 2:30 PM

---

$(git-merge) **Merged** from `src/utils/helpers.ts`
  r5678 by jane.smith, Nov 10, 2025, 10:15 AM

---

**Message**
fix: Merge upstream bugfix
```

**Example 3: Uncommitted changes**

Input:
```typescript
{
  lineNumber: 10,
  revision: undefined,
  author: undefined,
  date: undefined
}
```

Output:
```markdown
**Uncommitted changes**

Working copy modifications
```

**Example 4: Logs disabled**

Input (with `svn.blame.enableLogs: false`):
```typescript
{
  lineNumber: 20,
  revision: "9999",
  author: "admin",
  date: "2025-01-05T08:00:00.000Z"
}
```

Output:
```markdown
$(git-commit) **Revision** r9999
$(person) **Author** admin
$(clock) **Date** 10 months ago
```

---

## 9. Configuration Integration

### 9.1 Hover-Specific Settings (Optional)

**Recommendation**: Reuse existing `svn.blame.*` settings

No new settings needed initially. Future enhancements:

```json
{
  "svn.blame.hover.enabled": {
    "type": "boolean",
    "description": "Show blame info on hover",
    "default": true
  },
  "svn.blame.hover.showMessage": {
    "type": "boolean",
    "description": "Include commit message in hover (requires enableLogs)",
    "default": true
  }
}
```

### 9.2 Date Format Inheritance

```typescript
// Use existing dateFormat setting
const dateFormat = blameConfiguration.getDateFormat(); // "relative" | "absolute"

const formattedDate = formatDate(blameLine.date, dateFormat);
```

---

## 10. Testing Strategy

### 10.1 Unit Tests

**File**: `/src/test/unit/blame/blameHoverProvider.test.ts`

**Test cases**:
1. ✅ Hover on blamed line returns content
2. ✅ Hover on unblamed line returns null
3. ✅ Relative date formatting
4. ✅ Absolute date formatting
5. ✅ Merged revision display
6. ✅ Missing revision shows uncommitted message
7. ✅ Commit message included when enabled
8. ✅ Commit message skipped when disabled
9. ✅ Cancellation token support
10. ✅ Error handling for missing data

### 10.2 Integration Tests

**Scenarios**:
1. Activate hover on file with active blame
2. Hover before blame loaded (returns null)
3. Hover after blame cleared (returns null)
4. Toggle `enableLogs` setting (hover updates)
5. Toggle `dateFormat` setting (hover updates)

### 10.3 Manual Testing

**User flows**:
1. Open blamed file → hover line → see tooltip
2. Disable logs → hover → see minimal tooltip
3. Switch date format → hover → see updated format
4. Hover merged revision → see both original and merged info
5. Hover uncommitted line → see "Working copy" message

---

## 11. Performance Benchmarks

### 11.1 Target Metrics

- **Hover latency**: <50ms (cached blame)
- **Message fetch**: <200ms (first time), <10ms (cached)
- **Memory**: <5KB per cached message (500 entries = ~2.5MB)

### 11.2 Cache Hit Rates (Expected)

- **Blame data**: 80-90% (users hover same file repeatedly)
- **Commit messages**: 60-70% (revisions repeat across lines)

---

## 12. Summary

### 12.1 Key Decisions

1. **Markdown**: Use `MarkdownString` for rich formatting
2. **Date library**: Reuse `dayjs` (already in dependencies)
3. **Commit messages**: Lazy fetch on hover (not during blame)
4. **Cache**: 3-tier (blame/messages/hover), LRU eviction
5. **Error handling**: Graceful fallbacks, no error toasts
6. **Configuration**: Reuse existing `svn.blame.*` settings

### 12.2 Implementation Complexity

**Estimated effort**: 4-6 hours

- Provider implementation: 2-3h
- Date formatting: 0.5h
- Message fetching: 1h
- Testing: 1-1.5h
- Documentation: 0.5h

### 12.3 Dependencies

**Runtime**:
- `dayjs` (already installed)
- `dayjs/plugin/relativeTime` (already used)

**New files**:
- `/src/blame/blameHoverProvider.ts`

**Modified files**:
- `/src/extension.ts`
- `/src/svnRepository.ts`

---

## 13. Open Questions

1. **Hover range**: Highlight entire line or just trigger on line number gutter?
   - **Recommendation**: Entire line (follows Git extension pattern)

2. **Command links**: Add "Show Commit" link to open full commit details?
   - **Recommendation**: Yes, use `[Show Commit](command:svn.log?${revision})` syntax

3. **Throttling**: Debounce hover requests on rapid mouse movement?
   - **Recommendation**: No - VSCode handles this internally

4. **Multi-line hovers**: Show surrounding context (±2 lines)?
   - **Recommendation**: No - keep focused on single line (matches Git)

---

**Version**: 1.0
**Status**: Ready for implementation
