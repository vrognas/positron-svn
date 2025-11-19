# BlameProvider Phase 2.5: Implementation Reference

**Quick reference for implementing multi-decoration support**

---

## Updated BlameProvider Class Structure

```typescript
export class BlameProvider implements Disposable {
  // ===== CHANGED: Multiple decoration types =====
  private decorationTypes: {
    gutter: TextEditorDecorationType;   // Text annotations
    icon: TextEditorDecorationType;     // Colored bars
    inline: TextEditorDecorationType;   // End-of-line messages
  };

  // ===== NEW: Additional caches =====
  private messageCache = new Map<string, string>();     // revision → message
  private authorColors = new Map<string, string>();     // author → hex color
  private svgCache = new Map<string, Uri>();            // color → data URI

  // ===== EXISTING: Blame cache =====
  private blameCache = new Map<string, { data: ISvnBlameLine[]; version: number }>();
  private disposables: Disposable[] = [];
  private isActivated = false;

  constructor(private repository: Repository) {
    this.decorationTypes = this.createDecorationTypes();
  }

  // ===== NEW: Create 3 decoration types =====
  private createDecorationTypes() {
    return {
      gutter: window.createTextEditorDecorationType({
        before: {
          color: new ThemeColor("editorCodeLens.foreground"),
          margin: "0 1.5em 0 0",
          fontStyle: "italic",
          fontWeight: "normal"
        },
        isWholeLine: false
      }),

      icon: window.createTextEditorDecorationType({
        gutterIconPath: undefined, // Set per-decoration
        gutterIconSize: "100%",
        isWholeLine: false
      }),

      inline: window.createTextEditorDecorationType({
        after: {
          color: new ThemeColor("editorCodeLens.foreground"),
          margin: "0 0 0 3em",
          fontStyle: "italic",
          fontWeight: "normal"
        },
        isWholeLine: false
      })
    };
  }

  // ===== Public API (mostly unchanged) =====
  public activate(): void { /* ... existing ... */ }

  // ===== CHANGED: Apply 3 decoration types =====
  @throttle
  public async updateDecorations(editor?: TextEditor): Promise<void> {
    const target = editor || window.activeTextEditor;
    if (!target) {
      return;
    }

    // Check if should decorate
    if (!this.shouldDecorate(target)) {
      this.clearDecorations(target);
      return;
    }

    // Large file check
    if (target.document.lineCount > 5000 && blameConfiguration.shouldWarnLargeFile()) {
      window.showWarningMessage(
        `File too large for blame (${target.document.lineCount} lines). Consider disabling blame.`
      );
      return;
    }

    try {
      // Fetch blame data (with cache)
      const blameData = await this.getBlameData(target.document.uri);
      if (!blameData) {
        this.clearDecorations(target);
        return;
      }

      // Create 3 decoration arrays
      const decorations = await this.createAllDecorations(blameData, target);

      // Apply enabled decoration types
      if (blameConfiguration.isGutterTextEnabled()) {
        target.setDecorations(this.decorationTypes.gutter, decorations.gutter);
      } else {
        target.setDecorations(this.decorationTypes.gutter, []);
      }

      if (blameConfiguration.isGutterIconEnabled()) {
        target.setDecorations(this.decorationTypes.icon, decorations.icon);
      } else {
        target.setDecorations(this.decorationTypes.icon, []);
      }

      if (blameConfiguration.isInlineEnabled()) {
        target.setDecorations(this.decorationTypes.inline, decorations.inline);
      } else {
        target.setDecorations(this.decorationTypes.inline, []);
      }
    } catch (err) {
      console.error("BlameProvider: Failed to update decorations", err);
      this.clearDecorations(target);
    }
  }

  // ===== CHANGED: Clear all 3 types =====
  public clearDecorations(editor?: TextEditor): void {
    const target = editor || window.activeTextEditor;
    if (target) {
      target.setDecorations(this.decorationTypes.gutter, []);
      target.setDecorations(this.decorationTypes.icon, []);
      target.setDecorations(this.decorationTypes.inline, []);
    }
  }

  // ===== CHANGED: Recreate all 3 types on config change =====
  private async onConfigurationChange(_event: any): Promise<void> {
    // Dispose old types
    this.decorationTypes.gutter.dispose();
    this.decorationTypes.icon.dispose();
    this.decorationTypes.inline.dispose();

    // Recreate all 3 types
    this.decorationTypes = this.createDecorationTypes();

    // Refresh active editor
    if (window.activeTextEditor) {
      await this.updateDecorations(window.activeTextEditor);
    }
  }

  // ===== CHANGED: Dispose all 3 types =====
  public dispose(): void {
    this.decorationTypes.gutter.dispose();
    this.decorationTypes.icon.dispose();
    this.decorationTypes.inline.dispose();
    this.blameCache.clear();
    this.messageCache.clear();
    this.authorColors.clear();
    this.svgCache.clear();
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
    this.isActivated = false;
  }

  // ===== NEW: Create all 3 decoration arrays =====
  private async createAllDecorations(
    blameData: ISvnBlameLine[],
    editor: TextEditor
  ): Promise<{
    gutter: DecorationOptions[];
    icon: DecorationOptions[];
    inline: DecorationOptions[];
  }> {
    const gutterDecorations: DecorationOptions[] = [];
    const iconDecorations: DecorationOptions[] = [];
    const inlineDecorations: DecorationOptions[] = [];

    // Pre-fetch messages if inline enabled
    if (blameConfiguration.isInlineEnabled() && blameConfiguration.isLogsEnabled()) {
      const revisions = [...new Set(blameData.map(b => b.revision).filter(Boolean))];
      await this.prefetchMessages(revisions);
    }

    for (const blameLine of blameData) {
      const lineIndex = blameLine.lineNumber - 1;

      if (lineIndex < 0 || lineIndex >= editor.document.lineCount) {
        continue;
      }

      const range = new Range(lineIndex, 0, lineIndex, 0);

      // 1. Gutter text (existing)
      if (blameConfiguration.isGutterTextEnabled()) {
        const text = blameLine.revision
          ? this.formatBlameText(blameLine, template, dateFormat)
          : "Not committed yet";

        gutterDecorations.push({
          range,
          renderOptions: {
            before: { contentText: text }
          }
        });
      }

      // Skip icon/inline for uncommitted lines
      if (!blameLine.revision || !blameLine.author) {
        continue;
      }

      // 2. Gutter icon (NEW)
      if (blameConfiguration.isGutterIconEnabled()) {
        const color = this.getAuthorColor(blameLine.author);
        const svgUri = this.generateColorBarSvg(color);

        iconDecorations.push({
          range,
          renderOptions: {
            light: { gutterIconPath: svgUri },
            dark: { gutterIconPath: svgUri }
          }
        });
      }

      // 3. Inline annotation (NEW)
      if (blameConfiguration.isInlineEnabled()) {
        const message = await this.getCommitMessage(blameLine.revision);
        const inlineText = this.formatInlineText(blameLine, message);

        inlineDecorations.push({
          range,
          renderOptions: {
            after: { contentText: inlineText }
          }
        });
      }
    }

    return {
      gutter: gutterDecorations,
      icon: iconDecorations,
      inline: inlineDecorations
    };
  }

  // ===== NEW: Color hashing =====
  private getAuthorColor(author: string): string {
    if (this.authorColors.has(author)) {
      return this.authorColors.get(author)!;
    }

    const color = this.hashToColor(author);
    this.authorColors.set(author, color);
    return color;
  }

  private hashToColor(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }

    const hue = Math.abs(hash) % 360;
    const saturation = 60 + (Math.abs(hash >> 8) % 20);
    const lightness = 50 + (Math.abs(hash >> 16) % 10);

    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }

  // ===== NEW: SVG generation =====
  private generateColorBarSvg(color: string): Uri {
    if (this.svgCache.has(color)) {
      return this.svgCache.get(color)!;
    }

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg"
           width="2"
           height="100%"
           viewBox="0 0 2 20">
        <rect width="2" height="20" fill="${color}" />
      </svg>
    `.trim().replace(/\n\s+/g, ' ');

    const encoded = Buffer.from(svg).toString('base64');
    const uri = Uri.parse(`data:image/svg+xml;base64,${encoded}`);

    this.svgCache.set(color, uri);
    return uri;
  }

  // ===== NEW: Message fetching =====
  private async getCommitMessage(revision: string): Promise<string> {
    if (this.messageCache.has(revision)) {
      return this.messageCache.get(revision)!;
    }

    if (!blameConfiguration.isLogsEnabled()) {
      return "";
    }

    try {
      const log = await this.repository.log(revision, 1);
      const message = log[0]?.msg || "";
      this.messageCache.set(revision, message);
      return message;
    } catch (err) {
      console.error(`Failed to fetch message for r${revision}`, err);
      return "";
    }
  }

  private async prefetchMessages(revisions: string[]): Promise<void> {
    const uncached = revisions.filter(r => !this.messageCache.has(r));
    for (const revision of uncached) {
      await this.getCommitMessage(revision);
    }
  }

  private formatInlineText(line: ISvnBlameLine, message: string): string {
    const maxLength = blameConfiguration.getInlineMaxLength();
    const firstLine = message.split('\n')[0];
    const truncated = firstLine.length > maxLength
      ? firstLine.substring(0, maxLength - 3) + "..."
      : firstLine;

    const template = blameConfiguration.getInlineTemplate();
    return template
      .replace(/\$\{revision\}/g, line.revision || "???")
      .replace(/\$\{author\}/g, line.author || "unknown")
      .replace(/\$\{message\}/g, truncated);
  }

  // ===== EXISTING: Unchanged helpers =====
  private shouldDecorate(editor: TextEditor): boolean { /* ... */ }
  private async getBlameData(uri: Uri): Promise<ISvnBlameLine[] | undefined> { /* ... */ }
  private formatBlameText(line: ISvnBlameLine, template: string, dateFormat: string): string { /* ... */ }
  private formatDate(dateStr: string | undefined, format: "relative" | "absolute"): string { /* ... */ }
  private getRelativeTime(date: Date): string { /* ... */ }
}
```

---

## updateDecorations() Pseudocode

```
FUNCTION updateDecorations(editor?: TextEditor)
  ├─ target = editor || window.activeTextEditor
  ├─ IF target is null → RETURN
  │
  ├─ IF !shouldDecorate(target)
  │  └─ clearDecorations(target) → RETURN
  │
  ├─ IF target.lineCount > 5000 AND shouldWarnLargeFile()
  │  └─ showWarningMessage() → RETURN
  │
  ├─ TRY
  │  ├─ blameData = AWAIT getBlameData(target.uri)
  │  ├─ IF blameData is null
  │  │  └─ clearDecorations(target) → RETURN
  │  │
  │  ├─ decorations = AWAIT createAllDecorations(blameData, target)
  │  │  ├─ Returns: { gutter: [...], icon: [...], inline: [...] }
  │  │
  │  ├─ IF isGutterTextEnabled()
  │  │  └─ target.setDecorations(decorationTypes.gutter, decorations.gutter)
  │  ├─ ELSE
  │  │  └─ target.setDecorations(decorationTypes.gutter, [])
  │  │
  │  ├─ IF isGutterIconEnabled()
  │  │  └─ target.setDecorations(decorationTypes.icon, decorations.icon)
  │  ├─ ELSE
  │  │  └─ target.setDecorations(decorationTypes.icon, [])
  │  │
  │  ├─ IF isInlineEnabled()
  │  │  └─ target.setDecorations(decorationTypes.inline, decorations.inline)
  │  └─ ELSE
  │     └─ target.setDecorations(decorationTypes.inline, [])
  │
  └─ CATCH error
     ├─ console.error("Failed to update decorations", error)
     └─ clearDecorations(target)
```

---

## createAllDecorations() Pseudocode

```
FUNCTION createAllDecorations(blameData: ISvnBlameLine[], editor: TextEditor)
  ├─ gutterDecorations = []
  ├─ iconDecorations = []
  ├─ inlineDecorations = []
  │
  ├─ IF isInlineEnabled() AND isLogsEnabled()
  │  ├─ revisions = unique(blameData.map(b => b.revision))
  │  └─ AWAIT prefetchMessages(revisions)
  │
  ├─ FOR EACH blameLine IN blameData
  │  ├─ lineIndex = blameLine.lineNumber - 1
  │  ├─ IF lineIndex < 0 OR lineIndex >= editor.lineCount → CONTINUE
  │  ├─ range = new Range(lineIndex, 0, lineIndex, 0)
  │  │
  │  ├─ // 1. Gutter text decoration
  │  ├─ IF isGutterTextEnabled()
  │  │  ├─ text = blameLine.revision ? formatBlameText(blameLine) : "Not committed yet"
  │  │  └─ gutterDecorations.push({ range, renderOptions: { before: { contentText: text } } })
  │  │
  │  ├─ // Skip icon/inline for uncommitted lines
  │  ├─ IF !blameLine.revision OR !blameLine.author → CONTINUE
  │  │
  │  ├─ // 2. Gutter icon decoration
  │  ├─ IF isGutterIconEnabled()
  │  │  ├─ color = getAuthorColor(blameLine.author)
  │  │  ├─ svgUri = generateColorBarSvg(color)
  │  │  └─ iconDecorations.push({ range, renderOptions: { gutterIconPath: svgUri } })
  │  │
  │  └─ // 3. Inline annotation
  │     ├─ IF isInlineEnabled()
  │        ├─ message = AWAIT getCommitMessage(blameLine.revision)
  │        ├─ inlineText = formatInlineText(blameLine, message)
  │        └─ inlineDecorations.push({ range, renderOptions: { after: { contentText: inlineText } } })
  │
  └─ RETURN { gutter: gutterDecorations, icon: iconDecorations, inline: inlineDecorations }
```

---

## clearDecorations() Implementation

```typescript
public clearDecorations(editor?: TextEditor): void {
  const target = editor || window.activeTextEditor;
  if (!target) {
    return;
  }

  // MUST clear all 3 types (even if disabled)
  target.setDecorations(this.decorationTypes.gutter, []);
  target.setDecorations(this.decorationTypes.icon, []);
  target.setDecorations(this.decorationTypes.inline, []);
}
```

**Pseudocode**:
```
FUNCTION clearDecorations(editor?: TextEditor)
  ├─ target = editor || window.activeTextEditor
  ├─ IF target is null → RETURN
  │
  └─ // Clear all 3 decoration types
     ├─ target.setDecorations(decorationTypes.gutter, [])
     ├─ target.setDecorations(decorationTypes.icon, [])
     └─ target.setDecorations(decorationTypes.inline, [])
```

---

## Configuration Change Handler

```typescript
private async onConfigurationChange(event: ConfigurationChangeEvent): Promise<void> {
  if (!event.affectsConfiguration("svn.blame")) {
    return;
  }

  // Dispose old decoration types
  this.decorationTypes.gutter.dispose();
  this.decorationTypes.icon.dispose();
  this.decorationTypes.inline.dispose();

  // Recreate all 3 types (picks up new config)
  this.decorationTypes = this.createDecorationTypes();

  // Re-apply to active editor
  if (window.activeTextEditor) {
    await this.updateDecorations(window.activeTextEditor);
  }
}
```

**Pseudocode**:
```
FUNCTION onConfigurationChange(event: ConfigurationChangeEvent)
  ├─ IF !event.affectsConfiguration("svn.blame") → RETURN
  │
  ├─ // Dispose old types
  ├─ decorationTypes.gutter.dispose()
  ├─ decorationTypes.icon.dispose()
  ├─ decorationTypes.inline.dispose()
  │
  ├─ // Recreate all 3 types
  ├─ decorationTypes = createDecorationTypes()
  │
  └─ // Re-apply decorations
     ├─ IF window.activeTextEditor
     └─ AWAIT updateDecorations(window.activeTextEditor)
```

---

## Test File Structure

```
src/test/
├─ unit/
│  ├─ blame/
│  │  ├─ blameProviderMultiDecoration.test.ts  (13 tests)
│  │  │  ├─ Color hashing (4 tests)
│  │  │  ├─ SVG generation (3 tests)
│  │  │  ├─ Message fetching (4 tests)
│  │  │  └─ Decoration creation (2 tests)
│  │  │
│  │  └─ blameProviderEdgeCases.test.ts  (4 tests)
│  │     ├─ Uncommitted lines
│  │     ├─ Binary files
│  │     ├─ Long lines
│  │     └─ Many revisions (100+)
│  │
├─ integration/
│  └─ blameProviderMultiDecoration.e2e.test.ts  (5 tests)
│     ├─ All 3 types applied
│     ├─ Selective enabling
│     ├─ Clear all types
│     ├─ Config change
│     └─ Toggle commands
│
└─ performance/
   └─ blameProviderPerf.test.ts  (3 tests)
      ├─ 1000-line decoration <500ms
      ├─ SVG cache hit rate >90%
      └─ Message batch fetch
```

**Total**: 25 new tests (13 unit + 4 edge + 5 E2E + 3 perf)

---

## Performance Benchmarks to Validate

| Metric | Target | Method |
|--------|--------|--------|
| **Decoration creation** | <200ms (1000 lines) | `performance.now()` before/after |
| **SVG cache hit rate** | >90% | `svgCache.size / totalLines` |
| **Message cache hit rate** | >95% | `messageCache.size / uniqueRevisions` |
| **Memory usage** | <500KB (1000 lines) | `process.memoryUsage().heapUsed` |
| **Config change re-render** | <300ms | `performance.now()` in handler |

---

## Edge Case Handling Strategies

### 1. Uncommitted Lines
```typescript
// Skip icon/inline for uncommitted lines
if (!blameLine.revision || !blameLine.author) {
  continue; // Only gutter text shows "Not committed yet"
}
```

### 2. Binary Files
```typescript
// Already handled by getBlameData() throwing error
try {
  const blameData = await this.getBlameData(uri);
} catch (err) {
  this.clearDecorations(editor);
  return;
}
```

### 3. Very Long Lines (>500 chars)
```typescript
// Fixed margin prevents pushing annotation off-screen
inline: window.createTextEditorDecorationType({
  after: {
    margin: "0 0 0 3em", // 3em from line end
  }
})
```

### 4. Many Unique Revisions (100+)
```typescript
// Warn and skip inline annotations
const uniqueRevisions = new Set(blameData.map(b => b.revision).filter(Boolean));
if (uniqueRevisions.size > 100) {
  window.showWarningMessage(
    `File has ${uniqueRevisions.size} revisions. Inline annotations disabled.`
  );
  return { gutter, icon, inline: [] };
}
```

---

## TDD Implementation Order

1. **Write color hashing tests** (4 tests)
   - Consistency, uniqueness, readability, caching
2. **Implement color hashing**
   - `hashToColor()`, `getAuthorColor()`
3. **Write SVG tests** (3 tests)
   - Valid URI, caching, color embedding
4. **Implement SVG generation**
   - `generateColorBarSvg()` with cache
5. **Write message tests** (4 tests)
   - Cache hit/miss, errors, logs disabled
6. **Implement message fetching**
   - `getCommitMessage()`, `prefetchMessages()`, `formatInlineText()`
7. **Write decoration tests** (2 tests)
   - 3 arrays returned, uncommitted skip
8. **Implement createAllDecorations()**
   - Loop through blameData, create 3 arrays
9. **Write E2E tests** (5 tests)
   - Apply all types, selective, clear, config, toggle
10. **Update main methods**
    - `updateDecorations()`, `clearDecorations()`, `onConfigurationChange()`, `dispose()`
11. **Write performance tests** (3 tests)
    - 1000 lines, cache rates, memory
12. **Optimize if needed**
    - Lazy fetch, incremental updates

---

**Estimated Time**: 8-12 hours
- Implementation: 3-4 hours
- Testing: 4-5 hours
- Edge cases/optimization: 1-3 hours
