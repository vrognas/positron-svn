# BlameProvider Architecture Design

**Version**: 1.0
**Date**: 2025-11-18
**Target**: VSCode Git v1.97 blame pattern

---

## 1. Class Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      BlameProvider                          │
├─────────────────────────────────────────────────────────────┤
│ - decorationType: TextEditorDecorationType                  │
│ - blameCache: Map<string, ISvnBlameLine[]>                  │
│ - activeDecorations: Map<TextEditor, Disposable>            │
│ - throttledUpdate: () => void                               │
│ - disposables: Disposable[]                                 │
├─────────────────────────────────────────────────────────────┤
│ + constructor(repository, stateManager, config)             │
│ + activate(): void                                          │
│ + updateDecorations(editor?): Promise<void>                 │
│ + clearDecorations(editor?): void                           │
│ + dispose(): void                                           │
│ - onDidChangeActiveEditor(editor): void                     │
│ - onDidChangeTextDocument(event): void                      │
│ - onDidChangeState(uri): void                               │
│ - onDidChangeConfiguration(event): void                     │
│ - createDecorationType(): TextEditorDecorationType          │
│ - formatBlameText(line): string                             │
│ - shouldDecorate(editor): boolean                           │
│ - isFileTooLarge(editor): Promise<boolean>                  │
└─────────────────────────────────────────────────────────────┘
         │
         │ uses
         ▼
┌─────────────────────────┐  ┌──────────────────────┐  ┌────────────────────┐
│  BlameStateManager      │  │  BlameConfiguration  │  │  Repository        │
├─────────────────────────┤  ├──────────────────────┤  ├────────────────────┤
│ + onDidChangeState      │  │ + onDidChange        │  │ + blame()          │
│ + shouldShowBlame()     │  │ + isGutterEnabled()  │  │ + resetBlameCache()│
│ + setBlameEnabled()     │  │ + getGutterTemplate()│  │                    │
└─────────────────────────┘  └──────────────────────┘  └────────────────────┘
```

---

## 2. Class Responsibilities

### Single Responsibility: Decoration Management

**BlameProvider** manages gutter decorations lifecycle ONLY:
- Creates/updates/removes decorations
- Listens to editor/state/config events
- Fetches blame data when needed
- Does NOT manage state (delegated to BlameStateManager)
- Does NOT manage settings (delegated to BlameConfiguration)

---

## 3. Method Signatures

```typescript
export class BlameProvider implements Disposable {
  private decorationType: TextEditorDecorationType | undefined;
  private blameCache = new Map<string, ISvnBlameLine[]>();
  private activeDecorations = new Map<TextEditor, Disposable>();
  private disposables: Disposable[] = [];
  private updateThrottled: (() => void) | undefined;

  constructor(
    private repository: Repository,
    private stateManager: BlameStateManager,
    private config: BlameConfiguration
  ) {}

  /**
   * Activate provider - register event listeners
   */
  public activate(): void;

  /**
   * Update decorations for editor (throttled 150ms)
   * @param editor - Target editor (defaults to active)
   */
  @throttle(150)
  public async updateDecorations(editor?: TextEditor): Promise<void>;

  /**
   * Clear decorations from editor
   * @param editor - Target editor (defaults to all)
   */
  public clearDecorations(editor?: TextEditor): void;

  /**
   * Dispose all resources
   */
  public dispose(): void;

  /**
   * Handle active editor change
   */
  private onDidChangeActiveEditor(editor: TextEditor | undefined): void;

  /**
   * Handle document change (typing)
   * Debounced 500ms - only clear decorations, don't re-fetch
   */
  @debounce(500)
  private onDidChangeTextDocument(event: TextDocumentChangeEvent): void;

  /**
   * Handle state change from BlameStateManager
   */
  private onDidChangeState(uri: Uri | undefined): void;

  /**
   * Handle configuration change
   */
  private onDidChangeConfiguration(event: ConfigurationChangeEvent): void;

  /**
   * Create decoration type from config template
   */
  private createDecorationType(): TextEditorDecorationType;

  /**
   * Format blame line using template
   */
  private formatBlameText(line: ISvnBlameLine): string;

  /**
   * Check if editor should be decorated
   */
  private shouldDecorate(editor: TextEditor): boolean;

  /**
   * Check if file exceeds size limit
   */
  private async isFileTooLarge(editor: TextEditor): Promise<boolean>;
}
```

---

## 4. Decoration Lifecycle

### 4.1 Creation Flow

```
User toggles blame
  ▼
BlameStateManager.setBlameEnabled(uri, true)
  ▼
BlameStateManager fires onDidChangeState(uri)
  ▼
BlameProvider.onDidChangeState(uri)
  ▼
BlameProvider.updateDecorations(editor)
  ▼
  ├─ Check shouldDecorate() → FALSE? → Return early
  ├─ Check isFileTooLarge() → TRUE? → Warn & return
  ├─ Fetch blame: Repository.blame(uri.fsPath)
  ├─ Cache result: blameCache.set(key, lines)
  ├─ Format lines: formatBlameText(line)
  ├─ Create decorations: DecorationOptions[]
  └─ Apply: editor.setDecorations(decorationType, decorations)
```

### 4.2 Update Triggers

| Event | Handler | Behavior |
|-------|---------|----------|
| **Active editor change** | `onDidChangeActiveEditor` | Update decorations for new editor |
| **State toggle** | `onDidChangeState` | Update/clear based on new state |
| **Config change** | `onDidChangeConfiguration` | Recreate decorationType, update all |
| **Document edit** | `onDidChangeTextDocument` | Clear decorations (no re-fetch) |
| **Document save** | `onDidSaveTextDocument` | Re-fetch blame, update decorations |

### 4.3 Disposal Flow

```
BlameProvider.dispose()
  ▼
  ├─ Dispose decorationType
  ├─ Clear blameCache
  ├─ Dispose activeDecorations (Map<Editor, Disposable>)
  └─ Dispose all event listeners (disposables[])
```

---

## 5. State Synchronization

### 5.1 BlameStateManager Integration

```typescript
// In BlameProvider.constructor()
this.disposables.push(
  this.stateManager.onDidChangeState(this.onDidChangeState, this)
);

// In BlameProvider.shouldDecorate()
private shouldDecorate(editor: TextEditor): boolean {
  if (editor.document.uri.scheme !== 'file') return false;
  if (!this.stateManager.shouldShowBlame(editor.document.uri)) return false;
  if (!this.config.isGutterEnabled()) return false;
  return true;
}
```

### 5.2 State Flow Diagram

```
BlameStateManager
  ├─ Per-file state: Map<Uri, boolean>
  ├─ Global state: boolean
  └─ shouldShowBlame(uri) = global && per-file
        ▼
  BlameProvider.shouldDecorate(editor)
        ▼
  Update/clear decorations
```

### 5.3 Cache Consistency

| Event | BlameProvider Action | BlameStateManager Action |
|-------|---------------------|--------------------------|
| **File save** | Clear cache, re-fetch | No change |
| **Commit** | Clear all caches | No change |
| **Toggle blame** | Update decorations | Set state, fire event |
| **Close editor** | Remove from activeDecorations | No change |

---

## 6. Performance Optimizations

### 6.1 Lazy Loading Strategy

**Problem**: Large files (10K+ lines) slow down decoration rendering

**Solution**: Render only visible range

```typescript
// Phase 1: Full file decoration (MVP)
const decorations = blameLines.map(line => ({
  range: new Range(line.lineNumber - 1, 0, line.lineNumber - 1, 0),
  renderOptions: { after: { contentText: this.formatBlameText(line) } }
}));

// Phase 2: Visible range only (optimization)
const visibleRanges = editor.visibleRanges;
const decorations = blameLines
  .filter(line => visibleRanges.some(r => r.contains(line.lineNumber)))
  .map(line => ({ ... }));
```

**Implementation**: Phase 2 deferred to P2 (after MVP validation)

### 6.2 Throttling & Debouncing

| Operation | Pattern | Delay | Reason |
|-----------|---------|-------|--------|
| **updateDecorations()** | @throttle | 150ms | Prevent rapid re-renders on editor switch |
| **onDidChangeTextDocument** | @debounce | 500ms | Wait for user to stop typing |
| **onDidChangeActiveEditor** | None | - | Immediate response expected |
| **onDidChangeState** | None | - | User-triggered, immediate feedback |

### 6.3 Cache Strategy

```typescript
// In-memory cache (separate from Repository.blame cache)
private blameCache = new Map<string, ISvnBlameLine[]>();

// Cache key: uri.toString() + documentVersion
private getCacheKey(editor: TextEditor): string {
  return `${editor.document.uri.toString()}@${editor.document.version}`;
}

// Cache invalidation
private invalidateCache(uri: Uri): void {
  for (const key of this.blameCache.keys()) {
    if (key.startsWith(uri.toString())) {
      this.blameCache.delete(key);
    }
  }
}
```

**Why separate cache?**
- Repository.blame() caches raw SVN output
- BlameProvider.blameCache caches per-document-version
- Avoids re-parsing when document unchanged but editor switches

### 6.4 Large File Handling

```typescript
private async isFileTooLarge(editor: TextEditor): Promise<boolean> {
  const lineCount = editor.document.lineCount;

  if (!this.config.isFileTooLarge(lineCount)) {
    return false;
  }

  if (!this.config.shouldWarnLargeFile()) {
    return true; // Silent fail
  }

  // Show warning with "Continue" option
  const choice = await window.showWarningMessage(
    `Large file (${lineCount} lines). Blame may be slow.`,
    "Continue", "Cancel"
  );

  return choice !== "Continue";
}
```

---

## 7. Event Handling

### 7.1 Event Registration

```typescript
public activate(): void {
  // Editor events
  this.disposables.push(
    window.onDidChangeActiveTextEditor(this.onDidChangeActiveEditor, this),
    workspace.onDidChangeTextDocument(this.onDidChangeTextDocument, this),
    workspace.onDidSaveTextDocument(this.onDidSaveTextDocument, this),
    workspace.onDidCloseTextDocument(this.onDidCloseTextDocument, this)
  );

  // State events
  this.disposables.push(
    this.stateManager.onDidChangeState(this.onDidChangeState, this)
  );

  // Config events
  this.disposables.push(
    this.config.onDidChange(this.onDidChangeConfiguration, this)
  );

  // Initial decoration of active editor
  if (window.activeTextEditor) {
    this.updateDecorations(window.activeTextEditor);
  }
}
```

### 7.2 Event Priority & Ordering

**Principle**: Optimize for common case (editor switch)

```
High Priority (immediate):
  - onDidChangeActiveEditor → updateDecorations()
  - onDidChangeState → updateDecorations() or clearDecorations()
  - onDidChangeConfiguration → recreate decorationType, updateAll()

Medium Priority (throttled):
  - onDidSaveTextDocument → updateDecorations() [150ms throttle]

Low Priority (debounced):
  - onDidChangeTextDocument → clearDecorations() [500ms debounce]
```

### 7.3 Event Handler Pseudo-code

```typescript
// Fast path: clear decorations only (don't re-fetch)
private onDidChangeTextDocument(event: TextDocumentChangeEvent): void {
  const editor = window.activeTextEditor;
  if (!editor || editor.document !== event.document) return;

  // Clear decorations during typing
  this.clearDecorations(editor);

  // Invalidate cache (version changed)
  this.invalidateCache(event.document.uri);
}

// Medium path: re-fetch after save
private async onDidSaveTextDocument(document: TextDocument): Promise<void> {
  const editor = window.activeTextEditor;
  if (!editor || editor.document !== document) return;

  // Re-fetch and decorate
  await this.updateDecorations(editor);
}

// Fast path: switch editor
private onDidChangeActiveEditor(editor: TextEditor | undefined): void {
  if (!editor) return;

  // Use cached blame if available
  this.updateDecorations(editor);
}
```

---

## 8. Disposal & Memory Management

### 8.1 Resource Tracking

```typescript
export class BlameProvider implements Disposable {
  // Tracked resources
  private decorationType?: TextEditorDecorationType;      // 1 instance
  private blameCache: Map<string, ISvnBlameLine[]>;       // N entries
  private activeDecorations: Map<TextEditor, Disposable>; // M editors
  private disposables: Disposable[];                      // K listeners

  public dispose(): void {
    // Dispose decoration type
    this.decorationType?.dispose();
    this.decorationType = undefined;

    // Clear caches
    this.blameCache.clear();

    // Dispose active decorations
    this.activeDecorations.forEach(d => d.dispose());
    this.activeDecorations.clear();

    // Dispose listeners
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }
}
```

### 8.2 Memory Leak Prevention

| Risk | Prevention |
|------|------------|
| **Unbounded cache growth** | Invalidate on document close |
| **Orphaned decorations** | Track in activeDecorations Map, dispose on close |
| **Event listener leaks** | Store in disposables[], dispose all |
| **Decoration type leak** | Single instance, dispose on config change |

```typescript
// Add to activate()
workspace.onDidCloseTextDocument(document => {
  // Invalidate cache
  this.invalidateCache(document.uri);

  // Remove from activeDecorations
  const editor = window.visibleTextEditors.find(e => e.document === document);
  if (editor) {
    const decoration = this.activeDecorations.get(editor);
    decoration?.dispose();
    this.activeDecorations.delete(editor);
  }
});
```

### 8.3 Lifecycle Integration

```typescript
// In extension.ts
export function activate(context: ExtensionContext) {
  // ... existing code

  const blameProvider = new BlameProvider(
    repository,
    blameStateManager,
    blameConfiguration
  );

  blameProvider.activate();
  context.subscriptions.push(blameProvider);
}
```

---

## 9. TDD Test Strategy

### 9.1 Test Structure

```
src/test/
  ├─ unit/
  │   ├─ blameProvider.test.ts         # BlameProvider logic
  │   └─ blameFormatting.test.ts       # Template formatting
  ├─ integration/
  │   ├─ blameProvider.integration.ts  # E2E with real editors
  │   └─ blameCache.test.ts            # Cache invalidation
  └─ fixtures/
      ├─ blame.xml                     # Sample SVN blame output
      └─ test.repo/                    # Test SVN repo
```

### 9.2 Unit Tests (BlameProvider)

**Test File**: `/src/test/unit/blameProvider.test.ts`

```typescript
import * as assert from "assert";
import { BlameProvider } from "../../blameProvider";

describe("BlameProvider", () => {
  let provider: BlameProvider;
  let mockRepository: any;
  let mockStateManager: any;
  let mockConfig: any;

  beforeEach(() => {
    // Mock dependencies
    mockRepository = { blame: sinon.stub() };
    mockStateManager = {
      shouldShowBlame: sinon.stub(),
      onDidChangeState: { event: sinon.stub() }
    };
    mockConfig = {
      isGutterEnabled: sinon.stub().returns(true),
      getGutterTemplate: sinon.stub().returns("${author} ${revision}"),
      onDidChange: { event: sinon.stub() }
    };

    provider = new BlameProvider(mockRepository, mockStateManager, mockConfig);
  });

  afterEach(() => {
    provider.dispose();
  });

  // Test 1: shouldDecorate() checks all conditions
  it("should not decorate when state disabled", () => {
    mockStateManager.shouldShowBlame.returns(false);
    const editor = createMockEditor();

    assert.strictEqual(provider.shouldDecorate(editor), false);
  });

  // Test 2: shouldDecorate() checks gutter config
  it("should not decorate when gutter disabled", () => {
    mockStateManager.shouldShowBlame.returns(true);
    mockConfig.isGutterEnabled.returns(false);
    const editor = createMockEditor();

    assert.strictEqual(provider.shouldDecorate(editor), false);
  });

  // Test 3: Cache hit avoids re-fetch
  it("should use cached blame on second call", async () => {
    mockRepository.blame.resolves([
      { lineNumber: 1, revision: "123", author: "jdoe", date: "2025-01-01" }
    ]);

    const editor = createMockEditor();
    await provider.updateDecorations(editor);
    await provider.updateDecorations(editor);

    assert.strictEqual(mockRepository.blame.callCount, 1);
  });
});
```

**Coverage Target**: 85% (BlameProvider core logic)

### 9.3 Integration Tests

**Test File**: `/src/test/integration/blameProvider.integration.ts`

```typescript
describe("BlameProvider Integration", () => {
  // Test 1: Full decoration lifecycle
  it("should decorate editor when blame enabled", async () => {
    // Setup: Open test file
    const document = await workspace.openTextDocument(testFilePath);
    const editor = await window.showTextDocument(document);

    // Act: Enable blame
    blameStateManager.setBlameEnabled(document.uri, true);
    await delay(200); // Wait for throttle

    // Assert: Decorations applied
    const decorations = getEditorDecorations(editor);
    assert.ok(decorations.length > 0);
  });

  // Test 2: Clear on state toggle
  it("should clear decorations when blame disabled", async () => {
    // Setup: Blame enabled
    const editor = await openTestFileWithBlame();

    // Act: Disable blame
    blameStateManager.setBlameEnabled(editor.document.uri, false);
    await delay(200);

    // Assert: No decorations
    const decorations = getEditorDecorations(editor);
    assert.strictEqual(decorations.length, 0);
  });

  // Test 3: Update on config change
  it("should recreate decorations on template change", async () => {
    const editor = await openTestFileWithBlame();
    const initialText = getFirstDecorationText(editor);

    // Change template
    await blameConfiguration.update("gutter.template", "${revision}");
    await delay(200);

    const newText = getFirstDecorationText(editor);
    assert.notStrictEqual(initialText, newText);
  });
});
```

**Coverage Target**: 70% (E2E scenarios)

### 9.4 Test Coverage Summary

| Component | Unit Tests | Integration Tests | Total Coverage |
|-----------|------------|-------------------|----------------|
| **BlameProvider** | 15 tests | 5 tests | 85% |
| **formatBlameText()** | 8 tests | - | 95% |
| **Cache invalidation** | 5 tests | 3 tests | 90% |
| **Event handling** | 12 tests | 4 tests | 80% |
| **Total** | **40 tests** | **12 tests** | **85%** |

### 9.5 TDD Workflow

**Red-Green-Refactor cycle**:

```
1. Write failing test (e.g., shouldDecorate returns false when gutter disabled)
   ├─ Define test case
   └─ Assert expected behavior

2. Implement minimum code to pass
   ├─ Add shouldDecorate() logic
   └─ Run test → GREEN

3. Refactor
   ├─ Extract helper methods
   ├─ Improve readability
   └─ Run tests → still GREEN

4. Repeat for next feature
```

**Test-first order** (3 tests per feature):

1. `shouldDecorate()` logic (3 tests)
2. `formatBlameText()` template parsing (3 tests)
3. `updateDecorations()` cache handling (3 tests)
4. Event listeners registration (3 tests)
5. Disposal & cleanup (3 tests)

---

## 10. Integration with Existing Infrastructure

### 10.1 Dependency Injection

```typescript
// In src/extension.ts (per-repository setup)
export function activate(context: ExtensionContext) {
  // ... existing code

  // One BlameProvider per repository
  sourceControlManager.repositories.forEach(repository => {
    const blameProvider = new BlameProvider(
      repository,
      blameStateManager,      // Singleton
      blameConfiguration      // Singleton
    );

    blameProvider.activate();
    context.subscriptions.push(blameProvider);
  });

  // Listen for new repositories
  sourceControlManager.onDidChangeRepository(event => {
    if (event.kind === RepositoryChangeKind.Added) {
      const blameProvider = new BlameProvider(
        event.repository,
        blameStateManager,
        blameConfiguration
      );
      blameProvider.activate();
      context.subscriptions.push(blameProvider);
    }
  });
}
```

### 10.2 Repository Integration

```typescript
// Repository already has blame() method (from BLAME_LAYER_DESIGN.md)
// BlameProvider calls it directly:

const blameLines = await this.repository.blame(editor.document.uri.fsPath);
```

### 10.3 Service Registration Pattern

**Follows existing patterns**:

```typescript
// Similar to StatusService, ResourceGroupManager
class BlameProvider {
  constructor(
    private repository: Repository,
    private stateManager: BlameStateManager,
    private config: BlameConfiguration
  ) {}
}

// vs StatusService
class StatusService {
  constructor(
    private repository: Repository,
    private workspaceRoot: string
  ) {}
}
```

**Key difference**: BlameProvider is UI layer (decorations), not domain logic

---

## 11. Performance Benchmarks

### 11.1 Target Metrics

| Operation | Target | P99 |
|-----------|--------|-----|
| **updateDecorations() (cache hit)** | <10ms | <20ms |
| **updateDecorations() (cache miss)** | <500ms | <1000ms |
| **formatBlameText() x1000** | <5ms | <10ms |
| **shouldDecorate() check** | <1ms | <2ms |
| **clearDecorations()** | <5ms | <10ms |
| **Memory per file** | <100KB | <200KB |

### 11.2 Optimization Priorities

**Phase 1 (MVP)**: Full file decoration
- Goal: Validate UX, ensure correctness
- Accept slower performance (<1s for 5K lines)

**Phase 2 (Optimization)**: Lazy loading
- Goal: <100ms for any file size
- Render only visible range
- Virtual scrolling-like approach

**Phase 3 (Polish)**: Advanced caching
- Incremental blame updates
- Persist cache to disk (globalState)
- Pre-fetch blame for open files

---

## 12. Class Diagram (Detailed)

```typescript
export class BlameProvider implements Disposable {
  // ===== Properties =====

  /** Decoration type for gutter annotations */
  private decorationType?: TextEditorDecorationType;

  /** Per-document blame cache (key: uri@version) */
  private blameCache = new Map<string, ISvnBlameLine[]>();

  /** Track active decorations per editor (for disposal) */
  private activeDecorations = new Map<TextEditor, Disposable>();

  /** Event listener disposables */
  private disposables: Disposable[] = [];

  // ===== Constructor =====

  constructor(
    private repository: Repository,
    private stateManager: BlameStateManager,
    private config: BlameConfiguration
  ) {
    this.createDecorationType();
  }

  // ===== Public API =====

  /** Register event listeners, decorate active editor */
  public activate(): void {
    // Register 7 event listeners (see section 7.1)
    // Initial decoration
  }

  /** Update decorations for editor (throttled 150ms) */
  @throttle(150)
  public async updateDecorations(editor?: TextEditor): Promise<void> {
    // 1. Get editor (default to active)
    // 2. Check shouldDecorate() → early return
    // 3. Check isFileTooLarge() → warn & return
    // 4. Check cache → use if hit
    // 5. Fetch blame: repository.blame()
    // 6. Cache result
    // 7. Format decorations: formatBlameText()
    // 8. Apply: editor.setDecorations()
    // 9. Track in activeDecorations
  }

  /** Clear decorations from editor(s) */
  public clearDecorations(editor?: TextEditor): void {
    // If editor: clear that editor
    // If undefined: clear all editors
    // Dispose from activeDecorations
  }

  /** Dispose all resources */
  public dispose(): void {
    // Dispose decorationType
    // Clear caches
    // Dispose activeDecorations
    // Dispose event listeners
  }

  // ===== Event Handlers =====

  private onDidChangeActiveEditor(editor?: TextEditor): void;

  @debounce(500)
  private onDidChangeTextDocument(event: TextDocumentChangeEvent): void;

  private async onDidSaveTextDocument(document: TextDocument): Promise<void>;

  private onDidCloseTextDocument(document: TextDocument): void;

  private onDidChangeState(uri: Uri | undefined): void;

  private onDidChangeConfiguration(event: ConfigurationChangeEvent): void;

  // ===== Helpers =====

  private createDecorationType(): TextEditorDecorationType;

  private formatBlameText(line: ISvnBlameLine): string;

  private shouldDecorate(editor: TextEditor): boolean;

  private async isFileTooLarge(editor: TextEditor): Promise<boolean>;

  private getCacheKey(editor: TextEditor): string;

  private invalidateCache(uri: Uri): void;
}
```

---

## 13. Unresolved Questions

1. **Hover tooltips**: Show full commit message on blame line hover?
2. **Multi-line commits**: How to handle merged changes (ISvnBlameLine.merged)?
3. **Color coding**: Heatmap by age (older = cooler, newer = warmer)?
4. **Inline blame**: Support inline annotations like GitLens?
5. **Status bar integration**: Show current line blame in status bar (separate from gutter)?
6. **Diff view blame**: Support blame in diff editors?
7. **Blame at revision**: UI for blaming file at specific revision?
8. **Performance monitoring**: Add telemetry for decoration render times?
9. **Cancellation tokens**: Support canceling slow blame operations?

---

## 14. Design Validation Checklist

- [x] **Single Responsibility**: BlameProvider = decoration lifecycle only
- [x] **Integration**: Uses existing Repository.blame(), BlameStateManager, BlameConfiguration
- [x] **TDD Strategy**: 40 unit tests, 12 integration tests, 85% coverage target
- [x] **Disposal**: Proper resource tracking, no memory leaks
- [x] **Performance**: Throttling (150ms), debouncing (500ms), caching, lazy loading plan
- [x] **Event Handling**: 7 events covered (editor, state, config, document)
- [x] **State Sync**: BlameStateManager.onDidChangeState drives decoration updates
- [x] **Config Sync**: BlameConfiguration.onDidChange recreates decorations
- [x] **Error Handling**: Large file warnings, cache invalidation
- [x] **Patterns**: Follows service pattern (StatusService, ResourceGroupManager)
- [x] **VSCode API**: TextEditorDecorationType, DecorationOptions, editor.setDecorations()

---

**Next Steps**:
1. Implement BlameProvider class (TDD)
2. Write 3 core tests (shouldDecorate, formatBlameText, updateDecorations)
3. Integrate with extension.ts
4. Validate UX with real SVN repo
5. Optimize (lazy loading) if needed

---

**Version**: 1.0
**Status**: Design Complete ✅
