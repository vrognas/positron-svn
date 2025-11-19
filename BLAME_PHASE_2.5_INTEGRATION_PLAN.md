# BlameProvider Phase 2.5: Multi-Decoration Integration Plan

**Version**: 1.0
**Date**: 2025-11-19
**Status**: Planning

---

## Executive Summary

Extend BlameProvider from **single decoration type** (gutter text) to **3 simultaneous decoration types**:
1. **Gutter icons** (colored vertical bars by author)
2. **Gutter text** (existing, revision/author/date)
3. **Inline annotations** (end-of-line commit messages)

**Key Changes:**
- `decorationType` → `decorationTypes: { gutter, icon, inline }`
- `updateDecorations()` → apply 3 decoration arrays
- `clearDecorations()` → clear all 3 types
- `onConfigurationChange()` → recreate all 3 types
- Color hashing for author colors
- SVG generation for gutter icons
- Message caching for inline annotations

---

## 1. Current Architecture Analysis

### 1.1 Current BlameProvider Structure

```typescript
export class BlameProvider implements Disposable {
  // CURRENT: Single decoration type
  private decorationType: TextEditorDecorationType;
  private blameCache = new Map<string, { data: ISvnBlameLine[]; version: number }>();
  private disposables: Disposable[] = [];

  constructor(private repository: Repository) {
    // Creates single decoration type (gutter text)
    this.decorationType = window.createTextEditorDecorationType({
      before: { /* gutter text config */ }
    });
  }

  public async updateDecorations(editor?: TextEditor): Promise<void> {
    // 1. Fetch blame data
    // 2. Create decorations array
    // 3. Apply: target.setDecorations(this.decorationType, decorations)
  }

  public clearDecorations(editor?: TextEditor): void {
    // Clear single decoration type
    target.setDecorations(this.decorationType, []);
  }

  private async onConfigurationChange(_event: any): Promise<void> {
    // Recreate single decoration type
    this.decorationType.dispose();
    this.decorationType = window.createTextEditorDecorationType({ /* ... */ });
    await this.updateDecorations(window.activeTextEditor);
  }
}
```

### 1.2 Current Decoration Flow

```
updateDecorations()
  ├─ shouldDecorate() check → early return if false
  ├─ getBlameData() → fetch/cache
  ├─ createDecorations() → format text using template
  └─ editor.setDecorations(this.decorationType, decorations)
```

**Problem**: Only supports one decoration type (gutter text)

---

## 2. Phase 2.5 Architecture

### 2.1 New Class Structure

```typescript
export class BlameProvider implements Disposable {
  // CHANGED: Three decoration types
  private decorationTypes: {
    gutter: TextEditorDecorationType;      // Text annotations (existing)
    icon: TextEditorDecorationType;        // Colored vertical bars
    inline: TextEditorDecorationType;      // End-of-line annotations
  };

  // NEW: Message cache for inline annotations
  private messageCache = new Map<string, string>(); // key: revision, value: commit message

  // NEW: Author color cache
  private authorColors = new Map<string, string>(); // key: author, value: hex color

  // Existing
  private blameCache = new Map<string, { data: ISvnBlameLine[]; version: number }>();
  private disposables: Disposable[] = [];

  constructor(private repository: Repository) {
    this.decorationTypes = this.createDecorationTypes();
  }

  // NEW: Create all 3 decoration types
  private createDecorationTypes(): {
    gutter: TextEditorDecorationType;
    icon: TextEditorDecorationType;
    inline: TextEditorDecorationType;
  } {
    return {
      gutter: window.createTextEditorDecorationType({
        before: {
          color: new ThemeColor("editorCodeLens.foreground"),
          margin: "0 1.5em 0 0",
          fontStyle: "italic"
        },
        isWholeLine: false
      }),

      icon: window.createTextEditorDecorationType({
        gutterIconPath: undefined, // Set per decoration
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

  // CHANGED: Apply 3 decoration arrays
  public async updateDecorations(editor?: TextEditor): Promise<void> {
    const target = editor || window.activeTextEditor;
    if (!target || !this.shouldDecorate(target)) {
      this.clearDecorations(target);
      return;
    }

    // Fetch blame data
    const blameData = await this.getBlameData(target.document.uri);
    if (!blameData) {
      this.clearDecorations(target);
      return;
    }

    // Create 3 decoration arrays
    const decorations = await this.createAllDecorations(blameData, target);

    // Apply all 3 types
    if (blameConfiguration.isGutterTextEnabled()) {
      target.setDecorations(this.decorationTypes.gutter, decorations.gutter);
    }

    if (blameConfiguration.isGutterIconEnabled()) {
      target.setDecorations(this.decorationTypes.icon, decorations.icon);
    }

    if (blameConfiguration.isInlineEnabled()) {
      target.setDecorations(this.decorationTypes.inline, decorations.inline);
    }
  }

  // CHANGED: Clear all 3 types
  public clearDecorations(editor?: TextEditor): void {
    const target = editor || window.activeTextEditor;
    if (target) {
      target.setDecorations(this.decorationTypes.gutter, []);
      target.setDecorations(this.decorationTypes.icon, []);
      target.setDecorations(this.decorationTypes.inline, []);
    }
  }

  // CHANGED: Recreate all 3 types on config change
  private async onConfigurationChange(_event: any): Promise<void> {
    // Dispose old types
    this.decorationTypes.gutter.dispose();
    this.decorationTypes.icon.dispose();
    this.decorationTypes.inline.dispose();

    // Recreate all 3 types
    this.decorationTypes = this.createDecorationTypes();

    // Re-apply decorations
    if (window.activeTextEditor) {
      await this.updateDecorations(window.activeTextEditor);
    }
  }

  // CHANGED: Dispose all 3 types
  public dispose(): void {
    this.decorationTypes.gutter.dispose();
    this.decorationTypes.icon.dispose();
    this.decorationTypes.inline.dispose();
    this.blameCache.clear();
    this.messageCache.clear();
    this.authorColors.clear();
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }
}
```

### 2.2 New Decoration Creation Flow

```typescript
/**
 * Create all 3 decoration arrays from blame data
 */
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

  // Pre-fetch messages if inline enabled (batch operation)
  const revisions = [...new Set(blameData.map(b => b.revision).filter(Boolean))];
  if (blameConfiguration.isInlineEnabled() && blameConfiguration.isLogsEnabled()) {
    await this.prefetchMessages(revisions);
  }

  for (const blameLine of blameData) {
    const lineIndex = blameLine.lineNumber - 1;

    if (lineIndex < 0 || lineIndex >= editor.document.lineCount) {
      continue;
    }

    const range = new Range(lineIndex, 0, lineIndex, 0);

    // 1. Gutter text decoration (existing logic)
    if (blameConfiguration.isGutterTextEnabled()) {
      gutterDecorations.push({
        range,
        renderOptions: {
          before: {
            contentText: this.formatBlameText(blameLine)
          }
        }
      });
    }

    // 2. Gutter icon decoration (NEW)
    if (blameConfiguration.isGutterIconEnabled() && blameLine.author) {
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
    if (blameConfiguration.isInlineEnabled() && blameLine.revision) {
      const message = await this.getCommitMessage(blameLine.revision);
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
  }

  return {
    gutter: gutterDecorations,
    icon: iconDecorations,
    inline: inlineDecorations
  };
}
```

---

## 3. Color Hashing Algorithm

### 3.1 Author Color Assignment

```typescript
/**
 * Get consistent color for author using hash-based assignment
 */
private getAuthorColor(author: string): string {
  // Check cache first
  if (this.authorColors.has(author)) {
    return this.authorColors.get(author)!;
  }

  // Hash author name to color
  const color = this.hashToColor(author);
  this.authorColors.set(author, color);
  return color;
}

/**
 * Hash string to HSL color (ensures readability)
 */
private hashToColor(str: string): string {
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Map to HSL color space
  // H: 0-360 (full spectrum)
  // S: 60-80 (vibrant but not oversaturated)
  // L: 50-60 (readable against both light/dark themes)
  const hue = Math.abs(hash) % 360;
  const saturation = 60 + (Math.abs(hash >> 8) % 20);
  const lightness = 50 + (Math.abs(hash >> 16) % 10);

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}
```

### 3.2 Color Consistency Tests

```typescript
// Unit tests for color hashing
describe("Color Hashing", () => {
  it("should generate consistent colors for same author", () => {
    const color1 = provider.getAuthorColor("john");
    const color2 = provider.getAuthorColor("john");
    assert.strictEqual(color1, color2);
  });

  it("should generate different colors for different authors", () => {
    const johnColor = provider.getAuthorColor("john");
    const janeColor = provider.getAuthorColor("jane");
    assert.notStrictEqual(johnColor, janeColor);
  });

  it("should generate readable colors (50-60% lightness)", () => {
    const color = provider.getAuthorColor("test");
    const match = color.match(/hsl\(\d+, \d+%, (\d+)%\)/);
    const lightness = parseInt(match![1]);
    assert.ok(lightness >= 50 && lightness <= 60);
  });
});
```

---

## 4. SVG Generation for Gutter Icons

### 4.1 Color Bar SVG

```typescript
/**
 * Generate data URI for colored vertical bar SVG
 */
private generateColorBarSvg(color: string): Uri {
  // 2px wide, 100% height vertical bar
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg"
         width="2"
         height="100%"
         viewBox="0 0 2 20">
      <rect width="2" height="20" fill="${color}" />
    </svg>
  `.trim().replace(/\n\s+/g, ' ');

  // Convert to data URI
  const encoded = Buffer.from(svg).toString('base64');
  return Uri.parse(`data:image/svg+xml;base64,${encoded}`);
}
```

### 4.2 SVG Caching Strategy

**Option 1: Generate per decoration** (simple, may be slow)
```typescript
// Generate SVG for each line (100+ SVGs per file)
const svgUri = this.generateColorBarSvg(color);
```

**Option 2: Cache by color** (recommended)
```typescript
private svgCache = new Map<string, Uri>(); // key: color, value: data URI

private generateColorBarSvg(color: string): Uri {
  if (this.svgCache.has(color)) {
    return this.svgCache.get(color)!;
  }

  const svg = `<svg ...>${color}</svg>`;
  const uri = Uri.parse(`data:image/svg+xml;base64,...`);

  this.svgCache.set(color, uri);
  return uri;
}
```

**Performance**: Cache reduces SVG generation from O(lines) to O(unique authors)

### 4.3 SVG Tests

```typescript
describe("SVG Generation", () => {
  it("should generate valid data URI", () => {
    const uri = provider.generateColorBarSvg("#ff0000");
    assert.ok(uri.toString().startsWith("data:image/svg+xml;base64,"));
  });

  it("should cache SVGs by color", () => {
    const uri1 = provider.generateColorBarSvg("#ff0000");
    const uri2 = provider.generateColorBarSvg("#ff0000");
    assert.strictEqual(uri1, uri2); // Same reference
  });

  it("should embed color correctly", () => {
    const uri = provider.generateColorBarSvg("#123456");
    const decoded = Buffer.from(uri.toString().split(',')[1], 'base64').toString();
    assert.ok(decoded.includes('#123456'));
  });
});
```

---

## 5. Message Fetching and Caching

### 5.1 Message Fetching Strategy

```typescript
/**
 * Get commit message for revision (with caching)
 */
private async getCommitMessage(revision: string): Promise<string> {
  // Check cache
  if (this.messageCache.has(revision)) {
    return this.messageCache.get(revision)!;
  }

  // Skip if logs disabled
  if (!blameConfiguration.isLogsEnabled()) {
    return "";
  }

  try {
    // Fetch log entry (uses repository's log cache)
    const log = await this.repository.log(revision, 1);
    const message = log[0]?.msg || "";

    // Cache for 5 minutes
    this.messageCache.set(revision, message);

    return message;
  } catch (err) {
    console.error(`Failed to fetch message for r${revision}`, err);
    return "";
  }
}

/**
 * Prefetch messages for multiple revisions (batch operation)
 */
private async prefetchMessages(revisions: string[]): Promise<void> {
  // Filter out cached revisions
  const uncached = revisions.filter(r => !this.messageCache.has(r));

  if (uncached.length === 0) {
    return;
  }

  // Batch fetch (repository.log() may support batch)
  // For now, fetch sequentially with throttling
  for (const revision of uncached) {
    await this.getCommitMessage(revision);
  }
}
```

### 5.2 Message Truncation

```typescript
/**
 * Format inline text with message truncation
 */
private formatInlineText(line: ISvnBlameLine, message: string): string {
  const maxLength = blameConfiguration.getInlineMaxLength(); // Default 50 chars

  // Truncate to first line
  const firstLine = message.split('\n')[0];

  // Truncate to max length
  const truncated = firstLine.length > maxLength
    ? firstLine.substring(0, maxLength - 3) + "..."
    : firstLine;

  // Format using template
  const template = blameConfiguration.getInlineTemplate();
  return template
    .replace(/\$\{revision\}/g, line.revision || "???")
    .replace(/\$\{author\}/g, line.author || "unknown")
    .replace(/\$\{message\}/g, truncated);
}
```

### 5.3 Message Cache Tests

```typescript
describe("Message Caching", () => {
  it("should fetch message on cache miss", async () => {
    mockRepository.log.resolves([{ msg: "Fix bug" }]);

    const message = await provider.getCommitMessage("1234");

    assert.strictEqual(message, "Fix bug");
    assert.ok(mockRepository.log.calledOnce);
  });

  it("should return cached message on cache hit", async () => {
    mockRepository.log.resolves([{ msg: "Fix bug" }]);

    await provider.getCommitMessage("1234");
    await provider.getCommitMessage("1234");

    assert.ok(mockRepository.log.calledOnce); // Only first call
  });

  it("should return empty string if logs disabled", async () => {
    sandbox.stub(blameConfiguration, "isLogsEnabled").returns(false);

    const message = await provider.getCommitMessage("1234");

    assert.strictEqual(message, "");
    assert.ok(mockRepository.log.notCalled);
  });
});
```

---

## 6. Configuration Schema Changes

### 6.1 New Settings

Add to `package.json`:

```json
{
  "svn.blame.gutter.icon.enabled": {
    "type": "boolean",
    "default": true,
    "description": "Show colored vertical bars in gutter"
  },
  "svn.blame.inline.enabled": {
    "type": "boolean",
    "default": false,
    "description": "Show inline commit messages at end of lines"
  },
  "svn.blame.inline.template": {
    "type": "string",
    "default": "${author}, ${message}",
    "description": "Template for inline annotations"
  },
  "svn.blame.inline.maxLength": {
    "type": "number",
    "default": 50,
    "description": "Maximum length of inline message"
  }
}
```

### 6.2 BlameConfiguration Updates

```typescript
// Add to blameConfiguration.ts
export class BlameConfiguration {
  public isGutterIconEnabled(): boolean {
    return this.get<boolean>("gutter.icon.enabled", true);
  }

  public isInlineEnabled(): boolean {
    return this.get<boolean>("inline.enabled", false);
  }

  public getInlineTemplate(): string {
    return this.get<string>("inline.template", "${author}, ${message}");
  }

  public getInlineMaxLength(): number {
    return this.get<number>("inline.maxLength", 50);
  }

  // DEPRECATED: Rename for clarity
  public isGutterTextEnabled(): boolean {
    return this.isGutterEnabled(); // Existing method
  }
}
```

---

## 7. Edge Cases and Handling

### 7.1 Uncommitted Lines

**Problem**: Uncommitted lines have no revision/author/date

**Solution**:
```typescript
// Skip icon/inline decorations for uncommitted lines
if (!blameLine.revision) {
  continue; // Only show gutter text "Not committed yet"
}
```

### 7.2 Binary Files

**Problem**: SVN blame fails on binary files

**Solution**: Already handled by `repository.blame()` throwing error
```typescript
// In updateDecorations()
try {
  const blameData = await this.getBlameData(target.document.uri);
} catch (err) {
  // Binary file or other error - clear decorations
  this.clearDecorations(target);
  return;
}
```

### 7.3 Very Long Lines (>500 chars)

**Problem**: Inline annotations pushed off-screen

**Solution**: Use `margin: "0 0 0 3em"` to add spacing
```typescript
// In createDecorationTypes()
inline: window.createTextEditorDecorationType({
  after: {
    margin: "0 0 0 3em", // Fixed 3em spacing from line end
    // ...
  }
})
```

### 7.4 Many Unique Revisions (100+)

**Problem**: Message fetching may be slow

**Solution 1**: Lazy fetch (fetch on scroll into view)
```typescript
// Only fetch messages for visible lines
const visibleLines = editor.visibleRanges.flatMap(r =>
  Array.from({ length: r.end.line - r.start.line }, (_, i) => r.start.line + i)
);
const visibleRevisions = blameData
  .filter(b => visibleLines.includes(b.lineNumber - 1))
  .map(b => b.revision)
  .filter(Boolean);

await this.prefetchMessages(visibleRevisions);
```

**Solution 2**: Skip message fetch (show only author/revision)
```typescript
// If >100 unique revisions, skip message fetching
const uniqueRevisions = new Set(blameData.map(b => b.revision));
if (uniqueRevisions.size > 100 && blameConfiguration.shouldWarnLargeFile()) {
  window.showWarningMessage(
    "Too many revisions. Inline messages disabled for performance."
  );
  // Only show author/revision, no messages
}
```

---

## 8. Decoration Lifecycle Management

### 8.1 Lifecycle States

```
IDLE
  ├─ updateDecorations() called
  │
FETCHING_BLAME
  ├─ getBlameData() → cache hit → CREATING_DECORATIONS
  ├─ getBlameData() → cache miss → fetch SVN → CREATING_DECORATIONS
  │
CREATING_DECORATIONS
  ├─ createAllDecorations() → 3 arrays
  │  ├─ Gutter text: format with template
  │  ├─ Gutter icons: hash color, generate SVG
  │  └─ Inline: fetch messages, format
  │
APPLYING_DECORATIONS
  ├─ setDecorations(gutter, [...])
  ├─ setDecorations(icon, [...])
  ├─ setDecorations(inline, [...])
  │
IDLE
```

### 8.2 Clearing Strategy

**Must clear all 3 types** in these scenarios:
1. Blame disabled (state toggle)
2. Configuration disabled (gutter/inline toggle)
3. Document edited (typing)
4. File closed

```typescript
public clearDecorations(editor?: TextEditor): void {
  const target = editor || window.activeTextEditor;
  if (!target) return;

  // ALWAYS clear all 3 types (even if disabled)
  target.setDecorations(this.decorationTypes.gutter, []);
  target.setDecorations(this.decorationTypes.icon, []);
  target.setDecorations(this.decorationTypes.inline, []);
}
```

### 8.3 Partial Updates

**Optimization**: Only update enabled decoration types

```typescript
public async updateDecorations(editor?: TextEditor): Promise<void> {
  // ... fetch blame data

  const decorations = await this.createAllDecorations(blameData, target);

  // Only apply enabled types
  const config = blameConfiguration;

  if (config.isGutterTextEnabled()) {
    target.setDecorations(this.decorationTypes.gutter, decorations.gutter);
  } else {
    target.setDecorations(this.decorationTypes.gutter, []); // Clear if disabled
  }

  if (config.isGutterIconEnabled()) {
    target.setDecorations(this.decorationTypes.icon, decorations.icon);
  } else {
    target.setDecorations(this.decorationTypes.icon, []);
  }

  if (config.isInlineEnabled()) {
    target.setDecorations(this.decorationTypes.inline, decorations.inline);
  } else {
    target.setDecorations(this.decorationTypes.inline, []);
  }
}
```

---

## 9. Event Handling Updates

### 9.1 Configuration Change Handler

```typescript
private async onConfigurationChange(event: ConfigurationChangeEvent): Promise<void> {
  // Check which blame settings changed
  const blameChanged = event.affectsConfiguration("svn.blame");

  if (!blameChanged) {
    return;
  }

  // Strategy: Recreate ALL decoration types
  // Reason: Template/color/format changes affect decoration rendering

  // 1. Dispose old types
  this.decorationTypes.gutter.dispose();
  this.decorationTypes.icon.dispose();
  this.decorationTypes.inline.dispose();

  // 2. Recreate all 3 types (picks up new config)
  this.decorationTypes = this.createDecorationTypes();

  // 3. Re-apply to active editor
  if (window.activeTextEditor) {
    await this.updateDecorations(window.activeTextEditor);
  }
}
```

**Alternative: Selective recreation**
```typescript
// Only recreate changed decoration types (complex, may not be worth it)
if (event.affectsConfiguration("svn.blame.gutter")) {
  this.decorationTypes.gutter.dispose();
  this.decorationTypes.gutter = window.createTextEditorDecorationType({ ... });
}
// ... repeat for icon, inline
```

**Recommendation**: Recreate all (simpler, safer, minimal perf impact)

---

## 10. Testing Strategy

### 10.1 Unit Tests

**File**: `/src/test/unit/blameProviderMultiDecoration.test.ts`

```typescript
describe("BlameProvider - Multi-Decoration", () => {
  let provider: BlameProvider;
  let mockRepository: sinon.SinonStubbedInstance<Repository>;
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    mockRepository = sandbox.createStubInstance(Repository);
    provider = new BlameProvider(mockRepository as any);
  });

  afterEach(() => {
    provider.dispose();
    sandbox.restore();
  });

  // ===== Color Hashing Tests =====

  describe("getAuthorColor()", () => {
    it("should generate consistent color for same author", () => {
      const color1 = (provider as any).getAuthorColor("john");
      const color2 = (provider as any).getAuthorColor("john");
      assert.strictEqual(color1, color2);
    });

    it("should generate different colors for different authors", () => {
      const john = (provider as any).getAuthorColor("john");
      const jane = (provider as any).getAuthorColor("jane");
      assert.notStrictEqual(john, jane);
    });

    it("should generate readable HSL colors", () => {
      const color = (provider as any).getAuthorColor("test");
      assert.ok(color.startsWith("hsl("));
      const match = color.match(/hsl\((\d+), (\d+)%, (\d+)%\)/);
      assert.ok(match);
      const [_, h, s, l] = match.map(Number);
      assert.ok(h >= 0 && h < 360);
      assert.ok(s >= 60 && s <= 80);
      assert.ok(l >= 50 && l <= 60);
    });
  });

  // ===== SVG Generation Tests =====

  describe("generateColorBarSvg()", () => {
    it("should generate valid data URI", () => {
      const uri = (provider as any).generateColorBarSvg("#ff0000");
      assert.ok(uri.toString().startsWith("data:image/svg+xml;base64,"));
    });

    it("should cache SVGs by color", () => {
      const uri1 = (provider as any).generateColorBarSvg("#ff0000");
      const uri2 = (provider as any).generateColorBarSvg("#ff0000");
      assert.strictEqual(uri1.toString(), uri2.toString());
    });

    it("should embed color in SVG", () => {
      const uri = (provider as any).generateColorBarSvg("#123456");
      const decoded = Buffer.from(
        uri.toString().split(',')[1],
        'base64'
      ).toString();
      assert.ok(decoded.includes('#123456'));
    });
  });

  // ===== Message Fetching Tests =====

  describe("getCommitMessage()", () => {
    it("should fetch message on cache miss", async () => {
      mockRepository.log.resolves([{ msg: "Fix bug", revision: "1234" }]);

      const message = await (provider as any).getCommitMessage("1234");

      assert.strictEqual(message, "Fix bug");
      assert.ok(mockRepository.log.calledOnce);
    });

    it("should return cached message on cache hit", async () => {
      mockRepository.log.resolves([{ msg: "Fix bug", revision: "1234" }]);

      await (provider as any).getCommitMessage("1234");
      await (provider as any).getCommitMessage("1234");

      assert.ok(mockRepository.log.calledOnce);
    });

    it("should return empty string if logs disabled", async () => {
      sandbox.stub(blameConfiguration, "isLogsEnabled").returns(false);

      const message = await (provider as any).getCommitMessage("1234");

      assert.strictEqual(message, "");
      assert.ok(mockRepository.log.notCalled);
    });

    it("should handle fetch errors gracefully", async () => {
      mockRepository.log.rejects(new Error("Network error"));

      const message = await (provider as any).getCommitMessage("1234");

      assert.strictEqual(message, "");
    });
  });

  // ===== Multi-Decoration Tests =====

  describe("createAllDecorations()", () => {
    it("should create 3 decoration arrays", async () => {
      const blameData: ISvnBlameLine[] = [
        { lineNumber: 1, revision: "1234", author: "john", date: "2025-11-18" }
      ];

      const editor = createMockEditor();
      const result = await (provider as any).createAllDecorations(blameData, editor);

      assert.ok(result.gutter);
      assert.ok(result.icon);
      assert.ok(result.inline);
      assert.ok(Array.isArray(result.gutter));
      assert.ok(Array.isArray(result.icon));
      assert.ok(Array.isArray(result.inline));
    });

    it("should skip uncommitted lines for icon/inline", async () => {
      const blameData: ISvnBlameLine[] = [
        { lineNumber: 1, revision: undefined, author: undefined } // Uncommitted
      ];

      sandbox.stub(blameConfiguration, "isGutterIconEnabled").returns(true);
      sandbox.stub(blameConfiguration, "isInlineEnabled").returns(true);

      const editor = createMockEditor();
      const result = await (provider as any).createAllDecorations(blameData, editor);

      assert.strictEqual(result.icon.length, 0);
      assert.strictEqual(result.inline.length, 0);
    });
  });
});
```

**Unit Test Coverage Target**: 85%
- Color hashing: 4 tests
- SVG generation: 3 tests
- Message fetching: 4 tests
- Decoration creation: 2 tests
- **Total**: 13 new unit tests

### 10.2 E2E Tests

**File**: `/src/test/blameProviderMultiDecoration.e2e.test.ts`

```typescript
describe("BlameProvider E2E - Multi-Decoration", () => {
  // Test 1: All 3 decoration types applied
  it("should apply all 3 decoration types when enabled", async () => {
    sandbox.stub(blameConfiguration, "isGutterTextEnabled").returns(true);
    sandbox.stub(blameConfiguration, "isGutterIconEnabled").returns(true);
    sandbox.stub(blameConfiguration, "isInlineEnabled").returns(true);

    const testUri = Uri.file("/test/file.txt");
    const blameData: ISvnBlameLine[] = [
      { lineNumber: 1, revision: "1234", author: "john", date: "2025-11-18" }
    ];

    mockRepository.blame.resolves(blameData);
    mockRepository.log.resolves([{ msg: "Fix bug", revision: "1234" }]);

    const mockEditor = createMockEditor(testUri);
    await provider.updateDecorations(mockEditor);

    // Assert all 3 setDecorations() calls made
    assert.strictEqual(mockEditor.setDecorations.callCount, 3);

    // Verify each decoration type
    const calls = mockEditor.setDecorations.getCalls();
    assert.ok(calls.some(c => c.args[1].length > 0)); // Gutter
    assert.ok(calls.some(c => c.args[1].length > 0)); // Icon
    assert.ok(calls.some(c => c.args[1].length > 0)); // Inline
  });

  // Test 2: Selective enabling
  it("should only apply enabled decoration types", async () => {
    sandbox.stub(blameConfiguration, "isGutterTextEnabled").returns(true);
    sandbox.stub(blameConfiguration, "isGutterIconEnabled").returns(false);
    sandbox.stub(blameConfiguration, "isInlineEnabled").returns(false);

    const testUri = Uri.file("/test/file.txt");
    const blameData: ISvnBlameLine[] = [
      { lineNumber: 1, revision: "1234", author: "john", date: "2025-11-18" }
    ];

    mockRepository.blame.resolves(blameData);

    const mockEditor = createMockEditor(testUri);
    await provider.updateDecorations(mockEditor);

    const calls = mockEditor.setDecorations.getCalls();

    // Gutter: has decorations
    const gutterCall = calls.find(c =>
      c.args[0] === (provider as any).decorationTypes.gutter
    );
    assert.ok(gutterCall && gutterCall.args[1].length > 0);

    // Icon/inline: cleared (empty arrays)
    const iconCall = calls.find(c =>
      c.args[0] === (provider as any).decorationTypes.icon
    );
    const inlineCall = calls.find(c =>
      c.args[0] === (provider as any).decorationTypes.inline
    );
    assert.ok(iconCall && iconCall.args[1].length === 0);
    assert.ok(inlineCall && inlineCall.args[1].length === 0);
  });

  // Test 3: Clear all 3 types
  it("should clear all 3 decoration types", async () => {
    const mockEditor = createMockEditor();
    provider.clearDecorations(mockEditor);

    assert.strictEqual(mockEditor.setDecorations.callCount, 3);

    // All calls should pass empty arrays
    const calls = mockEditor.setDecorations.getCalls();
    calls.forEach(call => {
      assert.strictEqual(call.args[1].length, 0);
    });
  });

  // Test 4: Config change recreates all types
  it("should recreate all decoration types on config change", async () => {
    const oldGutter = (provider as any).decorationTypes.gutter;
    const oldIcon = (provider as any).decorationTypes.icon;
    const oldInline = (provider as any).decorationTypes.inline;

    await (provider as any).onConfigurationChange({
      affectsConfiguration: (s: string) => s === "svn.blame"
    });

    const newGutter = (provider as any).decorationTypes.gutter;
    const newIcon = (provider as any).decorationTypes.icon;
    const newInline = (provider as any).decorationTypes.inline;

    // All 3 types should be new instances
    assert.notStrictEqual(oldGutter, newGutter);
    assert.notStrictEqual(oldIcon, newIcon);
    assert.notStrictEqual(oldInline, newInline);
  });

  // Test 5: Toggle commands update all types
  it("should update all types when blame toggled", async () => {
    const testUri = Uri.file("/test/file.txt");
    const blameData: ISvnBlameLine[] = [
      { lineNumber: 1, revision: "1234", author: "john", date: "2025-11-18" }
    ];

    mockRepository.blame.resolves(blameData);
    sandbox.stub(blameConfiguration, "isGutterTextEnabled").returns(true);
    sandbox.stub(blameConfiguration, "isGutterIconEnabled").returns(true);
    sandbox.stub(blameConfiguration, "isInlineEnabled").returns(true);

    const mockEditor = createMockEditor(testUri);

    // Toggle ON
    blameStateManager.setBlameEnabled(testUri, true);
    await provider.updateDecorations(mockEditor);

    assert.strictEqual(mockEditor.setDecorations.callCount, 3);

    // Toggle OFF
    mockEditor.setDecorations.resetHistory();
    blameStateManager.setBlameEnabled(testUri, false);
    await provider.updateDecorations(mockEditor);

    // Should clear all 3 types
    assert.strictEqual(mockEditor.setDecorations.callCount, 3);
    mockEditor.setDecorations.getCalls().forEach(call => {
      assert.strictEqual(call.args[1].length, 0);
    });
  });
});
```

**E2E Test Coverage Target**: 70%
- All 3 types applied: 1 test
- Selective enabling: 1 test
- Clear all types: 1 test
- Config change: 1 test
- Toggle commands: 1 test
- **Total**: 5 new E2E tests

### 10.3 Performance Tests

**File**: `/src/test/performance/blameProviderPerf.test.ts`

```typescript
describe("BlameProvider - Performance", () => {
  it("should apply decorations to 1000-line file in <500ms", async () => {
    const blameData: ISvnBlameLine[] = Array.from({ length: 1000 }, (_, i) => ({
      lineNumber: i + 1,
      revision: `${1000 + i}`,
      author: `author${i % 10}`, // 10 unique authors
      date: "2025-11-18"
    }));

    mockRepository.blame.resolves(blameData);
    mockRepository.log.resolves([{ msg: "Test commit", revision: "1000" }]);

    const mockEditor = createMockEditor(1000);

    const start = performance.now();
    await provider.updateDecorations(mockEditor);
    const duration = performance.now() - start;

    assert.ok(duration < 500, `Expected <500ms, got ${duration}ms`);
  });

  it("should cache SVGs (only 10 generated for 1000 lines)", async () => {
    const blameData: ISvnBlameLine[] = Array.from({ length: 1000 }, (_, i) => ({
      lineNumber: i + 1,
      revision: `${1000 + i}`,
      author: `author${i % 10}`, // 10 unique authors
      date: "2025-11-18"
    }));

    mockRepository.blame.resolves(blameData);

    const generateSpy = sandbox.spy(provider as any, "generateColorBarSvg");

    await provider.updateDecorations(createMockEditor(1000));

    // Should only generate 10 unique SVGs (cached)
    const uniqueCalls = new Set(generateSpy.getCalls().map(c => c.args[0]));
    assert.strictEqual(uniqueCalls.size, 10);
  });

  it("should batch message fetching for 100 unique revisions", async () => {
    const blameData: ISvnBlameLine[] = Array.from({ length: 1000 }, (_, i) => ({
      lineNumber: i + 1,
      revision: `${1000 + (i % 100)}`, // 100 unique revisions
      author: `author${i % 10}`,
      date: "2025-11-18"
    }));

    mockRepository.blame.resolves(blameData);
    mockRepository.log.resolves([{ msg: "Test", revision: "1000" }]);

    const prefetchSpy = sandbox.spy(provider as any, "prefetchMessages");

    await provider.updateDecorations(createMockEditor(1000));

    assert.ok(prefetchSpy.calledOnce);
    const revisions = prefetchSpy.firstCall.args[0];
    assert.strictEqual(revisions.length, 100); // 100 unique
  });
});
```

**Performance Benchmarks**:
- 1000-line file: <500ms (target)
- SVG generation: O(unique authors), not O(lines)
- Message fetching: Batch prefetch, then cache

---

## 11. Edge Case Handling

### 11.1 Uncommitted Lines

```typescript
// In createAllDecorations()
for (const blameLine of blameData) {
  // ... range calculation

  // Gutter text: Always show (even for uncommitted)
  if (blameConfiguration.isGutterTextEnabled()) {
    gutterDecorations.push({
      range,
      renderOptions: {
        before: {
          contentText: blameLine.revision
            ? this.formatBlameText(blameLine)
            : "Not committed yet"
        }
      }
    });
  }

  // Icon/inline: Skip uncommitted lines
  if (!blameLine.revision || !blameLine.author) {
    continue;
  }

  // ... icon/inline decorations
}
```

### 11.2 Binary Files

**Already handled** by existing error handling:
```typescript
try {
  const blameData = await this.getBlameData(target.document.uri);
  if (!blameData) {
    this.clearDecorations(target);
    return;
  }
} catch (err) {
  console.error("BlameProvider: Failed to update decorations", err);
  this.clearDecorations(target);
}
```

### 11.3 Very Long Lines (>500 chars)

**Inline annotations use fixed margin**:
```typescript
inline: window.createTextEditorDecorationType({
  after: {
    margin: "0 0 0 3em", // Fixed 3em from line end
    // Prevents pushing annotation off-screen
  }
})
```

### 11.4 Files with 100+ Unique Revisions

**Option 1: Warn and skip inline**
```typescript
const uniqueRevisions = new Set(blameData.map(b => b.revision).filter(Boolean));
if (uniqueRevisions.size > 100) {
  if (blameConfiguration.shouldWarnLargeFile()) {
    window.showWarningMessage(
      `File has ${uniqueRevisions.size} revisions. Inline annotations disabled.`
    );
  }
  // Skip inline decoration creation
  return { gutter, icon, inline: [] };
}
```

**Option 2: Lazy fetch (on scroll)**
```typescript
// Only fetch messages for visible range
const visibleLines = editor.visibleRanges.flatMap(r =>
  Array.from({ length: r.end.line - r.start.line + 1 }, (_, i) => r.start.line + i)
);

const visibleRevisions = blameData
  .filter(b => visibleLines.includes(b.lineNumber - 1))
  .map(b => b.revision)
  .filter(Boolean);

await this.prefetchMessages(visibleRevisions);
```

---

## 12. Performance Validation Plan

### 12.1 Benchmark Metrics

| Metric | Target | Method |
|--------|--------|--------|
| **Decoration creation (1000 lines)** | <200ms | `performance.now()` |
| **SVG cache hit rate** | >90% | `svgCache.size / total lines` |
| **Message cache hit rate** | >95% | `messageCache.size / unique revisions` |
| **Memory (1000 lines)** | <500KB | `process.memoryUsage().heapUsed` |
| **Config change re-render** | <300ms | `performance.now()` |

### 12.2 Performance Test Suite

```typescript
describe("Performance Benchmarks", () => {
  it("Decoration creation (1000 lines) <200ms", async () => {
    const blameData = generateMockBlameData(1000, 10);
    const editor = createMockEditor(1000);

    const start = performance.now();
    await (provider as any).createAllDecorations(blameData, editor);
    const duration = performance.now() - start;

    console.log(`Decoration creation: ${duration.toFixed(2)}ms`);
    assert.ok(duration < 200);
  });

  it("SVG cache hit rate >90%", async () => {
    const blameData = generateMockBlameData(1000, 10); // 10 authors
    const editor = createMockEditor(1000);

    (provider as any).svgCache.clear();
    await (provider as any).createAllDecorations(blameData, editor);

    const hitRate = (provider as any).svgCache.size / 1000;
    console.log(`SVG cache hit rate: ${(hitRate * 100).toFixed(2)}%`);
    assert.ok(hitRate >= 0.90);
  });

  it("Memory usage (1000 lines) <500KB", async () => {
    const blameData = generateMockBlameData(1000, 10);
    const editor = createMockEditor(1000);

    const before = process.memoryUsage().heapUsed;
    await provider.updateDecorations(editor);
    const after = process.memoryUsage().heapUsed;

    const delta = (after - before) / 1024; // KB
    console.log(`Memory delta: ${delta.toFixed(2)} KB`);
    assert.ok(delta < 500);
  });
});
```

### 12.3 Profiling Strategy

**VSCode Profiler**:
1. Open large SVN file (1000+ lines)
2. Enable all 3 decoration types
3. Toggle blame ON
4. Profile `updateDecorations()` execution
5. Identify bottlenecks:
   - `repository.blame()` call
   - `createAllDecorations()` loop
   - `prefetchMessages()` batch fetch
   - `editor.setDecorations()` calls

**Chrome DevTools**:
```bash
# Run extension in debug mode with profiling
code --inspect-extensions=9333
# Open chrome://inspect, attach to extension host
# Record CPU profile during blame toggle
```

---

## 13. Implementation Checklist

### 13.1 Phase 2.5 Tasks

- [ ] **Architecture**
  - [ ] Update `decorationType` → `decorationTypes` struct
  - [ ] Add `messageCache`, `authorColors`, `svgCache` maps
  - [ ] Update constructor to create 3 decoration types

- [ ] **Color System**
  - [ ] Implement `hashToColor()` algorithm
  - [ ] Implement `getAuthorColor()` with caching
  - [ ] Add 4 unit tests (consistency, uniqueness, readability)

- [ ] **SVG Generation**
  - [ ] Implement `generateColorBarSvg()` with data URI
  - [ ] Add SVG caching by color
  - [ ] Add 3 unit tests (valid URI, caching, color embedding)

- [ ] **Message Fetching**
  - [ ] Implement `getCommitMessage()` with caching
  - [ ] Implement `prefetchMessages()` batch fetch
  - [ ] Implement `formatInlineText()` with truncation
  - [ ] Add 4 unit tests (cache hit/miss, errors, logs disabled)

- [ ] **Decoration Creation**
  - [ ] Refactor `createDecorations()` → `createAllDecorations()`
  - [ ] Return 3 arrays: `{ gutter, icon, inline }`
  - [ ] Add logic for gutter icons (color bar SVG)
  - [ ] Add logic for inline annotations (message fetch)
  - [ ] Add 2 unit tests (3 arrays, uncommitted skip)

- [ ] **Decoration Application**
  - [ ] Update `updateDecorations()` to apply 3 types
  - [ ] Update `clearDecorations()` to clear 3 types
  - [ ] Update `onConfigurationChange()` to recreate 3 types
  - [ ] Update `dispose()` to dispose 3 types
  - [ ] Add 1 E2E test (all 3 applied)

- [ ] **Configuration**
  - [ ] Add 4 new settings to `package.json`
  - [ ] Add 4 new methods to `BlameConfiguration`
  - [ ] Add 1 config test (enable/disable toggles)

- [ ] **Edge Cases**
  - [ ] Handle uncommitted lines (skip icon/inline)
  - [ ] Handle binary files (existing error handling)
  - [ ] Handle long lines (fixed margin)
  - [ ] Handle 100+ revisions (warn or lazy fetch)
  - [ ] Add 4 edge case tests

- [ ] **Testing**
  - [ ] 13 unit tests (color, SVG, message, decorations)
  - [ ] 5 E2E tests (apply, clear, toggle, config)
  - [ ] 3 performance tests (1000 lines, cache, memory)
  - [ ] **Total**: 21 new tests

- [ ] **Documentation**
  - [ ] Update `ARCHITECTURE_ANALYSIS.md` (Phase 2.5 complete)
  - [ ] Update `CHANGELOG.md` (v2.17.196)
  - [ ] Update version to 2.17.196

### 13.2 Test-Driven Development Order

**Write tests FIRST, then implement**:

1. **Color hashing** (3 tests → implement → verify)
2. **SVG generation** (3 tests → implement → verify)
3. **Message fetching** (4 tests → implement → verify)
4. **Decoration creation** (2 tests → implement → verify)
5. **E2E integration** (5 tests → implement → verify)
6. **Performance** (3 tests → optimize → verify)

---

## 14. Unresolved Questions

1. **Gutter icon size**: 2px or 4px width? (need UX feedback)
2. **Inline annotation position**: Fixed margin or dynamic (after code)?
3. **Color palette**: Full HSL spectrum or predefined palette (10 colors)?
4. **Message fetching**: Batch all at once or lazy (visible range)?
5. **Large file threshold**: Skip inline at 100 revisions or 500 lines?
6. **Cache TTL**: 5 minutes or unlimited (until config change)?
7. **Performance target**: 200ms or 500ms for 1000 lines?

**Recommendation**: Start with defaults in this plan, iterate based on user feedback

---

## 15. Migration Path

### 15.1 Backward Compatibility

**Current users**: Only gutter text enabled
**Phase 2.5 defaults**:
- `gutter.icon.enabled`: `true` (NEW, opt-out)
- `inline.enabled`: `false` (NEW, opt-in)

**No breaking changes**: Existing behavior preserved

### 15.2 Rollout Strategy

**v2.17.196 (Phase 2.5)**:
1. Deploy with gutter icons ON by default
2. Inline annotations OFF by default
3. Monitor performance metrics
4. Gather user feedback
5. Adjust defaults if needed (v2.17.197)

---

## 16. Performance Optimization Roadmap

### 16.1 Phase 2.5 (MVP)

- [x] Multi-decoration architecture
- [x] Color hashing with cache
- [x] SVG generation with cache
- [x] Message fetching with cache
- [x] Basic performance tests

### 16.2 Phase 2.6 (Optimization)

- [ ] Lazy message fetching (visible range only)
- [ ] Incremental decoration updates (only changed lines)
- [ ] Virtual scrolling support (render only visible)
- [ ] Persistent cache (globalState)
- [ ] Web worker for color/SVG generation

### 16.3 Phase 2.7 (Polish)

- [ ] Heatmap colors (age-based)
- [ ] Custom color palettes
- [ ] Hover tooltips for inline annotations
- [ ] Animation on blame toggle
- [ ] Telemetry for performance monitoring

---

**Next Steps**:
1. Review plan with team
2. Answer unresolved questions
3. Start TDD: Write 3 color hashing tests
4. Implement color hashing
5. Continue with SVG → message → decorations → E2E

---

**Version**: 1.0
**Status**: Design Complete ✅
**Estimated Effort**: 8-12 hours (3h implementation, 5h testing, 4h edge cases/perf)
