# Explorer File Decorations Implementation Plan

**Goal**: Add file status decorations (badges and colors) in VS Code Explorer view, similar to Git

---

## Current State

### Already Implemented ✅
- **SCM view decorations** (`resource.ts:74-89`)
  - Icons for each status (Added, Modified, Deleted, etc.)
  - Colors using Git theme colors
  - Tooltips showing status

### Missing ❌
- **Explorer view decorations**
  - No `FileDecorationProvider` registered
  - Files in Explorer don't show status badges/colors

---

## Implementation Plan

### 1. Create FileDecorationProvider (`src/fileDecorationProvider.ts`)

```typescript
import {
  FileDecorationProvider,
  FileDecoration,
  Uri,
  ThemeColor,
  EventEmitter,
  Disposable,
  window
} from "vscode";
import { Repository } from "./repository";

class SvnFileDecorationProvider implements FileDecorationProvider {
  private _onDidChangeFileDecorations = new EventEmitter<Uri[]>();
  readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

  provideFileDecoration(uri: Uri): FileDecoration | undefined {
    // Look up file status in repository
    // Return badge + color based on status
  }

  // Refresh decorations when repo changes
  refresh(uris: Uri[]): void {
    this._onDidChangeFileDecorations.fire(uris);
  }
}
```

### 2. Register Provider in Repository

**File**: `src/repository.ts` (constructor)

```typescript
// After sourceControl creation (line 248)
this.fileDecorationProvider = new SvnFileDecorationProvider(this);
this.disposables.push(
  window.registerFileDecorationProvider(this.fileDecorationProvider)
);
```

### 3. Fire Updates on Status Changes

**File**: `src/repository.ts`

When repository status updates (after `updateModelState()`), fire decoration changes:

```typescript
const changedUris = this.changes.resourceStates.map(r => r.resourceUri);
this.fileDecorationProvider.refresh(changedUris);
```

### 4. Badge and Color Mapping

Use same logic as `Resource.letter` and `Resource.color`:

| Status | Badge | Color |
|--------|-------|-------|
| Modified | M | gitDecoration.modifiedResourceForeground |
| Added | A | gitDecoration.untrackedResourceForeground |
| Deleted | D | gitDecoration.deletedResourceForeground |
| Conflicted | C | gitDecoration.conflictingResourceForeground |
| Unversioned | U | gitDecoration.untrackedResourceForeground |
| Ignored | I | gitDecoration.ignoredResourceForeground |
| Missing | ! | gitDecoration.deletedResourceForeground |
| Renamed | R | gitDecoration.modifiedResourceForeground |

---

## Technical Details

### FileDecoration Interface
```typescript
{
  badge?: string;           // "M", "A", "D", etc.
  tooltip?: string;         // "Modified", "Added", etc.
  color?: ThemeColor;       // Theme color reference
  propagate?: boolean;      // Show on parent folders
}
```

### Performance Considerations
1. **Caching**: Store file status map in Repository for O(1) lookup
2. **Batching**: Fire decoration updates in batch, not per-file
3. **Debouncing**: Debounce refresh calls (already done in status updates)

### Edge Cases
1. **External files**: Don't decorate (return undefined)
2. **Ignored files**: Optional, may clutter Explorer (config setting?)
3. **Conflicted + Modified**: Prioritize conflict badge
4. **Parent folders**: Set `propagate: false` to avoid cluttering tree

---

## Testing

### Manual Tests
1. Modify file → See "M" badge in Explorer
2. Add new file → See "A" badge
3. Delete file → See "D" badge (strikethrough)
4. Create conflict → See "C" badge
5. Commit changes → Badges disappear

### Unit Tests
- `provideFileDecoration()` returns correct badge/color per status
- `onDidChangeFileDecorations` fires on status changes
- Handles missing/external files gracefully

---

## Configuration (Optional)

Add setting to toggle Explorer decorations:

```json
"svn.decorations.enabled": {
  "type": "boolean",
  "default": true,
  "description": "Show SVN status decorations on files in Explorer"
}
```

---

## Files to Create/Modify

### Create
1. `src/fileDecorationProvider.ts` (~150 lines)

### Modify
1. `src/repository.ts` - Register provider, fire updates
2. `src/extension.ts` - No changes (auto-registered via Repository)
3. `package.json` - Optional config setting

---

## Effort Estimate

- **Implementation**: 30-45 minutes
- **Testing**: 15 minutes
- **Documentation**: 5 minutes
- **Total**: ~1 hour

---

## Benefits

✅ Files show status at a glance in Explorer
✅ No need to open Source Control view
✅ Consistent with Git UX
✅ Uses existing status tracking (no performance cost)

---

## Potential Issues

⚠️ **Too many badges**: If many files modified, Explorer may look cluttered
- Mitigation: Config to disable, or show only in workspace root

⚠️ **Ignored files**: Showing "I" on all ignored files may be noisy
- Mitigation: Make ignored file decorations optional (separate config)

---

**Status**: Ready to implement
**Decision**: Awaiting approval
