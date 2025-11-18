# SVN Blame Hover - Implementation Plan

**Quick reference for implementation**

---

## 1. VSCode Hover API Pattern

```typescript
import {
  HoverProvider,
  Hover,
  MarkdownString,
  TextDocument,
  Position,
  CancellationToken,
  languages
} from 'vscode';

class BlameHoverProvider implements HoverProvider {
  provideHover(
    document: TextDocument,
    position: Position,
    token: CancellationToken
  ): Hover | null {
    // Return Hover with MarkdownString content
  }
}

// Registration in extension.ts
context.subscriptions.push(
  languages.registerHoverProvider(
    { scheme: 'file' },
    new BlameHoverProvider(repository)
  )
);
```

---

## 2. Hover Content Formatting

### Standard Format (with message)
```markdown
$(git-commit) **Revision** r1234
$(person) **Author** john.doe
$(clock) **Date** 2 days ago

---

**Message**
feat: Add hover support

Implement HoverProvider for blame
```

### Merged Revision Format
```markdown
$(git-commit) **Revision** r1234
$(person) **Author** john.doe
$(clock) **Date** 2 days ago

---

$(git-merge) **Merged** from `src/file.ts`
  r5678 by jane.smith, 5 days ago

---

**Message**
fix: Merge upstream changes
```

### Minimal Format (logs disabled)
```markdown
$(git-commit) **Revision** r1234
$(person) **Author** john.doe
$(clock) **Date** 2 days ago
```

### Uncommitted Changes
```markdown
**Uncommitted changes**

Working copy modifications
```

---

## 3. Date Formatting

```typescript
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

function formatDate(isoDate: string, format: "relative" | "absolute"): string {
  if (!isoDate) return "Unknown date";

  try {
    if (format === "relative") {
      return dayjs(isoDate).fromNow();  // "2 days ago"
    } else {
      const date = new Date(isoDate);
      return date.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });  // "Nov 16, 2025, 2:30 PM"
    }
  } catch (err) {
    return isoDate;  // Fallback
  }
}
```

---

## 4. Commit Message Fetching

```typescript
// In Repository class (svnRepository.ts)
private _commitMessageCache = new Map<string, {
  message: string;
  timestamp: number;
}>();

async getCommitMessage(revision: string): Promise<string | null> {
  const cacheKey = `msg:${revision}`;
  const cached = this._commitMessageCache.get(cacheKey);

  if (cached && (Date.now() - cached.timestamp < 10 * 60 * 1000)) {
    return cached.message;
  }

  try {
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

---

## 5. Implementation Structure

### File: `/src/blame/blameHoverProvider.ts`

```typescript
import {
  CancellationToken,
  Hover,
  HoverProvider,
  MarkdownString,
  Position,
  TextDocument
} from "vscode";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { ISvnBlameLine } from "../common/types";
import { blameConfiguration } from "./blameConfiguration";
import { blameStateManager } from "./blameStateManager";
import { Repository } from "../repository";
import { logError } from "../util/errorLogger";

dayjs.extend(relativeTime);

export class BlameHoverProvider implements HoverProvider {
  constructor(private repository: Repository) {}

  async provideHover(
    document: TextDocument,
    position: Position,
    token: CancellationToken
  ): Promise<Hover | null> {
    // 1. Check cancellation
    if (token.isCancellationRequested) {
      return null;
    }

    // 2. Get blame state
    const blameState = blameStateManager.get(document.uri);
    if (!blameState || !blameState.blameData) {
      return null;
    }

    // 3. Find blame line (0-indexed position → 1-indexed blame)
    const blameLine = blameState.blameData.find(
      b => b.lineNumber === position.line + 1
    );

    if (!blameLine) {
      return null;
    }

    // 4. Check cancellation again
    if (token.isCancellationRequested) {
      return null;
    }

    // 5. Build hover content
    return this.buildHover(blameLine);
  }

  private async buildHover(blameLine: ISvnBlameLine): Promise<Hover> {
    const content = new MarkdownString();
    content.isTrusted = true;
    content.supportHtml = false;

    // Handle uncommitted changes
    if (!blameLine.revision) {
      content.appendMarkdown("**Uncommitted changes**\n\n");
      content.appendMarkdown("Working copy modifications");
      return new Hover(content);
    }

    // Core info
    const revision = blameLine.revision || "???";
    const author = blameLine.author || "Unknown";
    const dateFormat = blameConfiguration.getDateFormat();
    const date = blameLine.date
      ? this.formatDate(blameLine.date, dateFormat)
      : "Unknown date";

    content.appendMarkdown(`$(git-commit) **Revision** r${revision}\n\n`);
    content.appendMarkdown(`$(person) **Author** ${author}\n\n`);
    content.appendMarkdown(`$(clock) **Date** ${date}\n\n`);

    // Merged revision info
    if (blameLine.merged) {
      const mergedDate = this.formatDate(blameLine.merged.date, dateFormat);
      content.appendMarkdown(`---\n\n`);
      content.appendMarkdown(
        `$(git-merge) **Merged** from \`${blameLine.merged.path}\`\n\n`
      );
      content.appendMarkdown(
        `  r${blameLine.merged.revision} by ${blameLine.merged.author}, ${mergedDate}\n\n`
      );
    }

    // Commit message (if enabled)
    if (blameConfiguration.isLogsEnabled()) {
      const message = await this.getCommitMessage(revision);
      if (message) {
        content.appendMarkdown(`---\n\n`);
        content.appendMarkdown(`**Message**\n\n${message}\n`);
      }
    }

    return new Hover(content);
  }

  private formatDate(
    isoDate: string,
    format: "relative" | "absolute"
  ): string {
    if (!isoDate) return "Unknown date";

    try {
      if (format === "relative") {
        return dayjs(isoDate).fromNow();
      } else {
        const date = new Date(isoDate);
        if (isNaN(date.getTime())) {
          return isoDate;
        }
        return date.toLocaleString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        });
      }
    } catch (err) {
      logError(`Failed to format date: ${isoDate}`, err);
      return isoDate;
    }
  }

  private async getCommitMessage(revision: string): Promise<string | null> {
    try {
      return await this.repository.getCommitMessage(revision);
    } catch (err) {
      logError(`Hover: Failed to fetch message for r${revision}`, err);
      return null;
    }
  }
}
```

---

## 6. Repository Integration

### Add to `/src/svnRepository.ts`:

```typescript
// Add cache property
private _commitMessageCache = new Map<string, {
  message: string;
  timestamp: number;
}>();
private readonly COMMIT_MESSAGE_CACHE_TTL_MS = 10 * 60 * 1000; // 10min

// Add method
public async getCommitMessage(revision: string): Promise<string | null> {
  const cacheKey = `msg:${revision}`;
  const cached = this._commitMessageCache.get(cacheKey);

  if (cached && (Date.now() - cached.timestamp < this.COMMIT_MESSAGE_CACHE_TTL_MS)) {
    return cached.message;
  }

  try {
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

---

## 7. Extension Activation

### Modify `/src/extension.ts`:

```typescript
import { BlameHoverProvider } from './blame/blameHoverProvider';
import { languages } from 'vscode';

export async function activate(context: ExtensionContext) {
  // ... existing activation code

  // Register hover provider for each repository
  repositories.forEach(repository => {
    const hoverProvider = new BlameHoverProvider(repository);
    context.subscriptions.push(
      languages.registerHoverProvider(
        { scheme: 'file' },
        hoverProvider
      )
    );
  });
}
```

---

## 8. Error Handling Patterns

### Pattern 1: Missing blame data
```typescript
if (!blameState || !blameState.blameData) {
  return null;  // No hover
}
```

### Pattern 2: Invalid line
```typescript
const blameLine = blameState.blameData.find(b => b.lineNumber === position.line + 1);
if (!blameLine) {
  return null;
}
```

### Pattern 3: Message fetch failure
```typescript
try {
  message = await repository.getCommitMessage(revision);
} catch (err) {
  logError(`Hover: Failed to fetch message`, err);
  // Continue without message
}
```

### Pattern 4: Date parsing error
```typescript
try {
  return dayjs(isoDate).fromNow();
} catch (err) {
  logError(`Failed to format date`, err);
  return isoDate;  // Fallback to raw
}
```

---

## 9. Testing Checklist

### Unit Tests (`blameHoverProvider.test.ts`)

- [ ] Standard hover with message
- [ ] Hover without message (logs disabled)
- [ ] Merged revision display
- [ ] Uncommitted changes display
- [ ] Relative date formatting
- [ ] Absolute date formatting
- [ ] Missing blame data returns null
- [ ] Invalid line returns null
- [ ] Cancellation token support
- [ ] Date parsing fallback

### Integration Tests

- [ ] Hover on active blame file
- [ ] Hover before blame loaded
- [ ] Toggle `enableLogs` setting
- [ ] Toggle `dateFormat` setting
- [ ] Hover on merged revision line

---

## 10. Performance Targets

- **Hover latency**: <50ms (cached blame)
- **Message fetch**: <200ms (first), <10ms (cached)
- **Cache memory**: ~2.5MB (500 messages × 5KB)

---

## 11. Implementation Steps

1. **Create provider file** (`blameHoverProvider.ts`)
   - Implement `HoverProvider` interface
   - Add date formatting logic
   - Add Markdown content builder

2. **Add repository method** (`getCommitMessage()`)
   - Implement cache
   - Use existing `log()` method
   - Handle errors gracefully

3. **Register provider** (in `extension.ts`)
   - Import and instantiate
   - Register with `languages.registerHoverProvider()`

4. **Write tests** (`blameHoverProvider.test.ts`)
   - Unit tests for all scenarios
   - Integration tests for user flows

5. **Update docs**
   - ARCHITECTURE_ANALYSIS.md
   - CHANGELOG.md
   - Version bump

---

**Estimated effort**: 4-6 hours
**Dependencies**: dayjs (already installed)
**New files**: 1 (`blameHoverProvider.ts`)
**Modified files**: 2 (`extension.ts`, `svnRepository.ts`)
