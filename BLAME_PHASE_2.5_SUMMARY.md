# BlameProvider Phase 2.5: Integration Strategy Summary

**Status**: Planning Complete ✅
**Version**: Target v2.17.196
**Estimated Effort**: 8-12 hours

---

## Overview

Extend BlameProvider from **single decoration** (gutter text) to **3 simultaneous decorations**:
1. **Gutter icons**: Colored vertical bars by author
2. **Gutter text**: Existing revision/author/date (unchanged)
3. **Inline annotations**: End-of-line commit messages

---

## Key Architecture Changes

### Before (Phase 1 & 2)
```typescript
class BlameProvider {
  private decorationType: TextEditorDecorationType;  // Single type

  updateDecorations() {
    target.setDecorations(this.decorationType, decorations);  // 1 call
  }

  clearDecorations() {
    target.setDecorations(this.decorationType, []);  // 1 call
  }
}
```

### After (Phase 2.5)
```typescript
class BlameProvider {
  private decorationTypes: {
    gutter: TextEditorDecorationType;   // Text
    icon: TextEditorDecorationType;     // Color bar
    inline: TextEditorDecorationType;   // Message
  };

  private messageCache: Map<string, string>;    // NEW
  private authorColors: Map<string, string>;    // NEW
  private svgCache: Map<string, Uri>;           // NEW

  updateDecorations() {
    target.setDecorations(this.decorationTypes.gutter, gutterDecs);
    target.setDecorations(this.decorationTypes.icon, iconDecs);
    target.setDecorations(this.decorationTypes.inline, inlineDecs);
  }

  clearDecorations() {
    target.setDecorations(this.decorationTypes.gutter, []);
    target.setDecorations(this.decorationTypes.icon, []);
    target.setDecorations(this.decorationTypes.inline, []);
  }
}
```

---

## Core Features

### 1. Color Hashing for Authors
- **Algorithm**: String hash → HSL color (H: 0-360, S: 60-80%, L: 50-60%)
- **Consistency**: Same author = same color across files/sessions
- **Uniqueness**: Different authors = different colors (360 hues)
- **Cache**: `authorColors` map (O(1) lookup after first hash)
- **Tests**: 4 unit tests (consistency, uniqueness, readability, caching)

### 2. SVG Generation for Gutter Icons
- **Format**: 2px wide vertical bar, data URI encoded
- **Template**: `<svg width="2"><rect fill="${color}" /></svg>`
- **Cache**: `svgCache` by color (reuse across same author's lines)
- **Optimization**: O(unique authors), not O(lines)
- **Tests**: 3 unit tests (valid URI, caching, color embedding)

### 3. Commit Message Fetching
- **Source**: `repository.log(revision, 1)` (uses existing log cache)
- **Cache**: `messageCache` by revision (5-min TTL implicit)
- **Prefetch**: Batch fetch all unique revisions before decoration creation
- **Truncation**: Max 50 chars, first line only, "..." ellipsis
- **Performance**: Skip if `enableLogs: false` (4-10x faster)
- **Tests**: 4 unit tests (cache hit/miss, errors, logs disabled)

---

## Decoration Lifecycle

### Creation Flow
```
updateDecorations()
  ├─ Fetch blame data (cache hit → skip SVN call)
  ├─ createAllDecorations() → 3 arrays
  │  ├─ Prefetch messages (batch operation)
  │  ├─ For each line:
  │  │  ├─ Gutter text: format with template
  │  │  ├─ Gutter icon: hash color → generate SVG (cached)
  │  │  └─ Inline: fetch message (cached) → truncate → format
  │  └─ Return { gutter: [...], icon: [...], inline: [...] }
  │
  └─ Apply enabled types:
     ├─ setDecorations(gutter, gutterDecs) if enabled
     ├─ setDecorations(icon, iconDecs) if enabled
     └─ setDecorations(inline, inlineDecs) if enabled
```

### Clearing Strategy
- **When**: Blame disabled, config toggle, document edit, file close
- **How**: `setDecorations(type, [])` for ALL 3 types
- **Why**: Ensures no orphaned decorations (even if type disabled)

### Config Change
- **Trigger**: Any `svn.blame.*` setting change
- **Strategy**: Recreate ALL 3 types (simpler, safer than selective)
- **Flow**:
  1. Dispose old types (`.dispose()` x3)
  2. Create new types (`createDecorationTypes()`)
  3. Re-apply to active editor (`updateDecorations()`)

---

## Configuration Schema

### New Settings (package.json)
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

### BlameConfiguration Methods
```typescript
isGutterTextEnabled()    // Existing (alias for isGutterEnabled)
isGutterIconEnabled()    // NEW
isInlineEnabled()        // NEW
getInlineTemplate()      // NEW
getInlineMaxLength()     // NEW
```

---

## Edge Cases Handled

### 1. Uncommitted Lines
- **Problem**: No revision/author/date
- **Solution**: Skip icon/inline decorations (only show gutter text "Not committed yet")

### 2. Binary Files
- **Problem**: SVN blame fails
- **Solution**: Already handled by `repository.blame()` error → `clearDecorations()`

### 3. Very Long Lines (>500 chars)
- **Problem**: Inline annotation pushed off-screen
- **Solution**: Fixed margin (`margin: "0 0 0 3em"`) from line end

### 4. Many Unique Revisions (100+)
- **Problem**: Message fetching slow
- **Solution**: Warn user, skip inline annotations (or lazy fetch visible range)

---

## Testing Strategy (TDD)

### Unit Tests (13 tests)
**File**: `/src/test/unit/blame/blameProviderMultiDecoration.test.ts`

- **Color hashing** (4 tests)
  - Consistent color for same author
  - Different colors for different authors
  - Readable HSL values (L: 50-60%)
  - Cache hit on second call

- **SVG generation** (3 tests)
  - Valid data URI format
  - Cache hit for same color
  - Color embedded in SVG

- **Message fetching** (4 tests)
  - Fetch on cache miss
  - Cache hit on second call
  - Empty string if logs disabled
  - Graceful error handling

- **Decoration creation** (2 tests)
  - Returns 3 arrays (gutter, icon, inline)
  - Skips uncommitted lines for icon/inline

### E2E Tests (5 tests)
**File**: `/src/test/integration/blameProviderMultiDecoration.e2e.test.ts`

- All 3 decoration types applied when enabled
- Only enabled types applied (selective)
- Clear all 3 types when blame disabled
- Recreate all 3 types on config change
- Toggle commands update all types

### Performance Tests (3 tests)
**File**: `/src/test/performance/blameProviderPerf.test.ts`

- 1000-line file decoration <500ms
- SVG cache hit rate >90%
- Message batch prefetch

### Edge Case Tests (4 tests)
**File**: `/src/test/unit/blame/blameProviderEdgeCases.test.ts`

- Uncommitted lines (skip icon/inline)
- Binary files (clear decorations)
- Long lines (fixed margin)
- 100+ revisions (warn or skip)

**Total**: 25 new tests (85%+ coverage target)

---

## Performance Benchmarks

| Metric | Target | Method |
|--------|--------|--------|
| Decoration creation (1000 lines) | <200ms | `performance.now()` |
| SVG cache hit rate | >90% | `svgCache.size / totalLines` |
| Message cache hit rate | >95% | `messageCache.size / uniqueRevs` |
| Memory (1000 lines) | <500KB | `process.memoryUsage()` |
| Config change re-render | <300ms | `performance.now()` |

### Optimization Strategy
- **SVG cache**: O(unique authors) not O(lines) → 10-100x reduction
- **Message prefetch**: Batch fetch upfront → reduces sequential waits
- **Lazy inline**: Skip if >100 revisions or visible range only

---

## TDD Implementation Order

1. **Color hashing** (Write 4 tests → Implement → Verify)
2. **SVG generation** (Write 3 tests → Implement → Verify)
3. **Message fetching** (Write 4 tests → Implement → Verify)
4. **Decoration creation** (Write 2 tests → Implement → Verify)
5. **E2E integration** (Write 5 tests → Implement → Verify)
6. **Performance** (Write 3 tests → Optimize → Verify)

**Principle**: Red-Green-Refactor (test first, implement minimal, optimize)

---

## Unresolved Questions

1. **Gutter icon width**: 2px or 4px? (need UX feedback)
2. **Inline position**: Fixed margin or dynamic (after code)?
3. **Color palette**: Full HSL spectrum or 10 predefined colors?
4. **Message fetching**: Batch all or lazy (visible range)?
5. **Large file threshold**: Skip inline at 100 revisions or 500 lines?
6. **Cache TTL**: 5 minutes or unlimited (until config change)?
7. **Performance target**: 200ms or 500ms for 1000 lines?

**Recommendation**: Use defaults in plan, iterate based on feedback

---

## Implementation Checklist

- [ ] **Color system** (3h)
  - [ ] `hashToColor()` algorithm
  - [ ] `getAuthorColor()` with caching
  - [ ] 4 unit tests

- [ ] **SVG generation** (1h)
  - [ ] `generateColorBarSvg()` with data URI
  - [ ] SVG caching by color
  - [ ] 3 unit tests

- [ ] **Message fetching** (2h)
  - [ ] `getCommitMessage()` with caching
  - [ ] `prefetchMessages()` batch fetch
  - [ ] `formatInlineText()` truncation
  - [ ] 4 unit tests

- [ ] **Decoration creation** (2h)
  - [ ] Refactor `createDecorations()` → `createAllDecorations()`
  - [ ] Return 3 arrays
  - [ ] 2 unit tests

- [ ] **Main integration** (2h)
  - [ ] Update `updateDecorations()` (apply 3 types)
  - [ ] Update `clearDecorations()` (clear 3 types)
  - [ ] Update `onConfigurationChange()` (recreate 3 types)
  - [ ] Update `dispose()` (dispose 3 types)
  - [ ] 5 E2E tests

- [ ] **Configuration** (1h)
  - [ ] Add 4 settings to `package.json`
  - [ ] Add 4 methods to `BlameConfiguration`

- [ ] **Edge cases** (2h)
  - [ ] Uncommitted lines handling
  - [ ] 100+ revisions warning
  - [ ] 4 edge case tests

- [ ] **Performance** (2h)
  - [ ] 3 performance tests
  - [ ] Optimize if needed (lazy fetch, incremental)

- [ ] **Documentation** (1h)
  - [ ] Update `ARCHITECTURE_ANALYSIS.md`
  - [ ] Update `CHANGELOG.md` (v2.17.196)
  - [ ] Update version to 2.17.196

**Total Estimate**: 8-12 hours (3-4h implementation, 4-5h testing, 1-3h edge/perf)

---

## Backward Compatibility

- **Current behavior preserved**: Gutter text remains default
- **New defaults**:
  - `gutter.icon.enabled`: `true` (NEW, opt-out)
  - `inline.enabled`: `false` (NEW, opt-in)
- **No breaking changes**: Existing users see gutter text + icons by default

---

## Documents Created

1. **BLAME_PHASE_2.5_INTEGRATION_PLAN.md** (16 sections, comprehensive)
   - Architecture changes
   - Color hashing algorithm
   - SVG generation strategy
   - Message fetching/caching
   - Configuration schema
   - Edge case handling
   - Testing strategy (25 tests)
   - Performance benchmarks
   - Implementation checklist

2. **BLAME_PHASE_2.5_IMPLEMENTATION.md** (Quick reference)
   - Updated class structure (full code)
   - `updateDecorations()` pseudocode
   - `createAllDecorations()` pseudocode
   - `clearDecorations()` implementation
   - Test file structure
   - TDD implementation order

3. **BLAME_PHASE_2.5_SUMMARY.md** (This document)
   - Executive overview
   - Key changes
   - Testing strategy summary
   - Implementation checklist

---

## Next Steps

1. ✅ Review plan with stakeholders
2. ✅ Answer unresolved questions (use defaults for now)
3. **Start TDD**:
   - Write 4 color hashing tests
   - Implement `hashToColor()`, `getAuthorColor()`
   - Verify tests pass
4. Continue with SVG → message → decorations → E2E
5. Measure performance, optimize if needed
6. Update docs, increment version to 2.17.196

---

**Status**: Planning Complete ✅
**Ready to implement**: Yes
**Risk level**: Low (backward compatible, incremental changes)
**Test coverage target**: 85%+
