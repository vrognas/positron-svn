---
status: skipped
priority: p3
issue_id: "006"
tags: [code-quality, error-handling, consistency, pr-26]
dependencies: []
skipped_date: 2025-11-16
skipped_reason: "Low priority - current error handling acceptable, not blocking merge"
---

# Error Handling Inconsistency - Throw vs Swallow Pattern

## Problem Statement

The codebase exhibits inconsistent error handling patterns between `revealFileInOS` (throws) and `diffWithExternalTool` (throws), while callers mix throw and swallow strategies, creating confusion about error contract.

## Findings

- Discovered during code review by pattern-recognition-specialist
- Locations:
  - `src/util/fileOperations.ts:15-23` - revealFileInOS throws
  - `src/util/fileOperations.ts:34-111` - diffWithExternalTool throws
  - `src/commands/revealInExplorer.ts:28` - swallows errors
  - `src/historyView/repoLogProvider.ts:292, 339` - doesn't catch
- Creates ambiguity: are callers responsible for error handling?
- Some errors logged twice (utility + caller)

## Current Code

```typescript
// Utility - throws
export async function revealFileInOS(fsPath: string | Uri): Promise<void> {
  try {
    const uri = typeof fsPath === "string" ? Uri.file(fsPath) : fsPath;
    await commands.executeCommand("revealFileInOS", uri);
  } catch (error) {
    logError("Reveal in explorer failed", error);
    throw error; // Throws to caller
  }
}

// Caller - swallows
export class RevealInExplorer extends Command {
  public async execute(...) {
    try {
      await revealFileInOS(resource.resourceUri);
    } catch (error) {
      window.showErrorMessage("Unable to reveal file in explorer");
      // Swallows - doesn't rethrow
    }
  }
}

// Other caller - doesn't catch
public async revealInExplorerCmd(element: ILogTreeItem) {
  await revealFileInOS(remotePath); // No try/catch!
}
```

## Proposed Solutions

### Option 1: Utilities Never Throw User-Facing Errors (RECOMMENDED)
- **Pros**: Clear contract, no double-logging, caller controls UX
- **Cons**: Utilities can't enforce error messages
- **Effort**: Small (10 minutes)
- **Risk**: Low

```typescript
// Utility - returns error, doesn't throw
export async function revealFileInOS(fsPath: string | Uri): Promise<{ success: boolean; error?: Error }> {
  try {
    const uri = typeof fsPath === "string" ? Uri.file(fsPath) : fsPath;
    await commands.executeCommand("revealFileInOS", uri);
    return { success: true };
  } catch (error) {
    logError("Reveal in explorer failed", error);
    return { success: false, error: error as Error };
  }
}

// Caller - handles result
const result = await revealFileInOS(resource.resourceUri);
if (!result.success) {
  window.showErrorMessage("Unable to reveal file in explorer");
}
```

### Option 2: Utilities Always Throw, Callers Always Catch
- **Pros**: Exception-based flow, TypeScript async/await idiomatic
- **Cons**: Callers must remember to catch, easy to miss
- **Effort**: Small (10 minutes)
- **Risk**: Medium (uncaught exceptions)

```typescript
// All callers wrap in try/catch
try {
  await revealFileInOS(remotePath);
} catch (error) {
  window.showErrorMessage("Unable to reveal file in explorer");
}
```

### Option 3: Utilities Handle User Messages
- **Pros**: Consistent UX, no caller boilerplate
- **Cons**: Tight coupling to VS Code window API, harder to test
- **Effort**: Small (10 minutes)
- **Risk**: Medium (poor separation of concerns)

```typescript
export async function revealFileInOS(fsPath: string | Uri): Promise<boolean> {
  try {
    const uri = typeof fsPath === "string" ? Uri.file(fsPath) : fsPath;
    await commands.executeCommand("revealFileInOS", uri);
    return true;
  } catch (error) {
    logError("Reveal in explorer failed", error);
    window.showErrorMessage("Unable to reveal file in explorer");
    return false;
  }
}
```

## Recommended Action

Implement Option 2 (utilities throw, callers catch) - most idiomatic for async/await.
Add ESLint rule to enforce try/catch around utility calls.

## Technical Details

- **Affected Files**:
  - `src/util/fileOperations.ts` (document throw behavior)
  - `src/commands/revealInExplorer.ts` (already correct)
  - `src/historyView/repoLogProvider.ts` (add try/catch at lines 292, 339)
- **Related Components**: Error logging, user messaging
- **Database Changes**: No

## Resources

- Code review PR: #26
- Agent report: pattern-recognition-specialist
- Error handling best practices: https://docs.microsoft.com/en-us/vscode/api/references/vscode-api#window

## Acceptance Criteria

- [ ] Consistent error handling pattern documented
- [ ] All utility calls wrapped in try/catch (or utilities don't throw)
- [ ] No double-logging of same error
- [ ] Error messages user-friendly and actionable
- [ ] Tests verify error paths
- [ ] ESLint rule or documentation enforces pattern

## Work Log

### 2025-11-16 - Pattern Analysis Discovery
**By:** pattern-recognition-specialist (Multi-Agent Code Review)
**Actions:**
- Identified during comprehensive pattern analysis of PR #26
- Analyzed error flow across utility and caller boundaries
- Categorized as P3 (LOW) code quality issue

**Learnings:**
- Inconsistent error handling creates maintenance burden
- Double-logging wastes resources and clutters logs
- Uncaught exceptions in tree provider methods can crash view
- Clear contracts between utilities and callers essential

## Notes

Source: Code review performed on 2025-11-16
Review command: /compounding-engineering:review 26
Priority: P3 - Nice to fix, not blocking
Impact: Code quality, maintainability, consistency
