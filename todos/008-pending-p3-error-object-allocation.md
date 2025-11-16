---
status: skipped
priority: p3
issue_id: "008"
tags: [performance, optimization, hot-path, pr-26]
dependencies: []
skipped_date: 2025-11-16
skipped_reason: "Premature optimization - validation failures are exceptional cases, not hot path"
---

# Performance: Error Object Allocation in Hot Path

## Problem Statement

The `diffWithExternalTool` function allocates Error objects in validation code that may execute frequently, causing unnecessary memory pressure and GC overhead.

## Findings

- Discovered during code review by performance-oracle
- Location: `src/util/fileOperations.ts:47-86`
- Five Error objects allocated during validation
- Each validation failure creates Error with stack trace (expensive)
- Function may be called repeatedly (e.g., user selecting multiple files)
- Optimization: throw strings or reuse Error instances

## Current Code

```typescript
// Line 47: Config missing
const error = new Error(
  "External diff tool not configured. Set svn.diff.tool to path of bcsvn.bat"
);
logError("Diff tool not configured", error);
throw error;

// Line 57: Path not absolute
const error = new Error(
  `External diff tool must be an absolute path: ${diffToolPath}`
);
logError("Diff tool path not absolute", error);
throw error;

// Line 67: Tool not found
const error = new Error(`External diff tool not found at: ${diffToolPath}`);
logError("Diff tool not found", error);
throw error;

// Line 76: Invalid old revision
const error = new Error(`Invalid old revision format: ${oldRevision}`);
logError("Invalid revision format", error);
throw error;

// Line 82: Invalid new revision
const error = new Error(`Invalid new revision format: ${newRevision}`);
logError("Invalid revision format", error);
throw error;
```

## Proposed Solutions

### Option 1: Throw Strings (Simplest)
- **Pros**: No object allocation, fast
- **Cons**: No stack traces, harder to debug
- **Effort**: Tiny (5 minutes)
- **Risk**: Medium (debugging harder)

```typescript
if (!diffToolPath) {
  logError("Diff tool not configured", new Error());
  throw "External diff tool not configured. Set svn.diff.tool";
}
```

### Option 2: Reuse Singleton Error Classes
- **Pros**: Fast, maintains Error type, stack traces
- **Cons**: Shared stack traces can be confusing
- **Effort**: Small (15 minutes)
- **Risk**: Low

```typescript
class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

const configError = new ConfigurationError("...");
throw configError;
```

### Option 3: Lazy Stack Trace Capture
- **Pros**: Error objects but cheaper stack traces
- **Cons**: Requires custom Error class, complex
- **Effort**: Medium (30 minutes)
- **Risk**: Medium

### Option 4: Keep Status Quo
- **Pros**: Clear stack traces, standard Error handling
- **Cons**: Allocates in hot path
- **Effort**: None
- **Risk**: None

## Recommended Action

**Status Quo** (Option 4) - premature optimization.

**Reasoning**:
- Validation failures are exceptional, not hot path
- User unlikely to trigger validation errors repeatedly
- Code clarity > micro-optimization
- Profile first before optimizing

If profiling reveals GC pressure, revisit Option 2.

## Technical Details

- **Affected Files**: `src/util/fileOperations.ts`
- **Related Components**: Error handling, logging
- **Database Changes**: No
- **Performance Impact**: Theoretical (not measured)
- **Profiling Needed**: Yes - before optimizing

## Resources

- Code review PR: #26
- Agent report: performance-oracle
- Error performance: https://v8.dev/docs/stack-trace-api
- Premature optimization: https://wiki.c2.com/?PrematureOptimization

## Acceptance Criteria

N/A - recommended to defer until profiling shows actual issue

If implemented:
- [ ] Reduced allocations in validation path
- [ ] Stack traces still available for debugging
- [ ] Error handling behavior unchanged
- [ ] Benchmarks show measurable improvement
- [ ] No regressions in error reporting

## Work Log

### 2025-11-16 - Performance Review Discovery
**By:** performance-oracle (Multi-Agent Code Review)
**Actions:**
- Identified during comprehensive performance analysis of PR #26
- Analyzed memory allocation in validation code
- Categorized as P3 (LOW) micro-optimization opportunity

**Learnings:**
- Error object allocation has cost (stack trace capture)
- Optimization valuable only if path is truly hot
- Validation failures are exceptional cases (by definition)
- Premature optimization can harm code clarity
- Profile first, optimize second

## Notes

Source: Performance review performed on 2025-11-16
Review command: /compounding-engineering:review 26
Priority: P3 - Defer unless profiling shows issue
Impact: Theoretical performance improvement
Recommendation: YAGNI - keep status quo until proven bottleneck
