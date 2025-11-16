---
status: resolved
priority: p2
issue_id: "003"
tags: [security, validation, path-traversal, pr-26]
dependencies: []
---

# Security: Config Path Validation Bypass - UNC Paths & Symlinks

## Problem Statement

The `diffWithExternalTool` function validates that configured diff tool paths are absolute using `path.isAbsolute()`, but this check has platform-specific bypasses that could allow security exploits.

## Findings

- Discovered during code review by security-sentinel
- Location: `src/util/fileOperations.ts:56`
- `path.isAbsolute()` returns `true` for UNC paths on Windows (e.g., `\\server\share\evil.exe`)
- Does not validate against symlinks pointing outside expected directories
- Could allow execution of arbitrary binaries via configuration manipulation

## Current Code

```typescript
// Security: Validate path is absolute to prevent relative path exploits
if (!path.isAbsolute(diffToolPath)) {
  const error = new Error(
    `External diff tool must be an absolute path: ${diffToolPath}`
  );
  logError("Diff tool path not absolute", error);
  window.showErrorMessage(error.message);
  throw error;
}
```

## Proposed Solutions

### Option 1: Platform-Specific UNC Path Rejection (RECOMMENDED)
- **Pros**: Simple, prevents remote execution vectors
- **Cons**: May block legitimate UNC-based tools in corporate environments
- **Effort**: Small (10 minutes)
- **Risk**: Low

```typescript
// Reject UNC paths on Windows
if (process.platform === "win32" && diffToolPath.startsWith("\\\\")) {
  const error = new Error(
    `UNC paths not allowed for security: ${diffToolPath}`
  );
  logError("UNC path rejected", error);
  window.showErrorMessage(error.message);
  throw error;
}
```

### Option 2: Realpath Resolution + Validation
- **Pros**: Catches symlinks, resolves canonical paths
- **Cons**: More complex, async operation
- **Effort**: Medium (20 minutes)
- **Risk**: Medium

```typescript
const realPath = await fs.promises.realpath(diffToolPath);
if (realPath !== diffToolPath) {
  window.showWarningMessage(
    `Using canonical path: ${realPath}`
  );
}
```

### Option 3: Whitelist Approach
- **Pros**: Most secure - only known-good paths
- **Cons**: Poor UX, breaks flexibility
- **Effort**: Small
- **Risk**: High (user friction)

## Recommended Action

Implement Option 1 (reject UNC paths) for Windows platforms.
Consider Option 2 (realpath) as enhancement if symlink issues reported.

## Technical Details

- **Affected Files**: `src/util/fileOperations.ts`
- **Related Components**: Configuration system, path validation
- **Database Changes**: No
- **Platform Impact**: Windows-specific security hardening

## Resources

- Code review PR: #26
- Agent report: security-sentinel
- Related: CVE-2019-5414 (path traversal via UNC)
- Windows UNC path docs: https://docs.microsoft.com/en-us/windows/win32/fileio/naming-a-file

## Acceptance Criteria

- [x] UNC paths rejected on Windows with clear error message
- [x] Absolute paths still work (C:\, /usr/bin/, etc.)
- [x] Error message explains security rationale
- [x] Tests cover UNC rejection
- [x] Cross-platform behavior documented

## Work Log

### 2025-11-16 - Resolved - UNC Path Rejection Implemented
**By:** Claude Code (Implementation)
**Actions:**
- Added UNC path rejection in fileOperations.ts (lines 65-73)
- Added 3 security tests for UNC validation
- Updated version to 2.17.155
- Updated CHANGELOG.md with security fix details
- Updated ARCHITECTURE_ANALYSIS.md version
- All acceptance criteria met

**Technical Details:**
- Platform check: `process.platform === "win32"`
- UNC detection: `diffToolPath.startsWith("\\\\")`
- Error message: "UNC paths not allowed for security: {path}"
- Logged via logError() with window.showErrorMessage()

**Testing:**
- Tests verify UNC paths rejected on Windows
- Tests verify absolute local paths allowed (C:\, D:\, /usr/bin/)
- Tests verify relative paths not flagged as UNC (caught by isAbsolute)
- TypeScript compilation successful

### 2025-11-16 - Triaged and Approved for Implementation
**By:** User (Triage Session)
**Actions:**
- Reviewed during triage session
- Approved for implementation
- Status changed: pending → ready
- Estimated effort: Small (10 minutes)

**Decision Rationale:**
- P2 security issue worth addressing
- Simple fix with low risk
- Prevents potential remote code execution via UNC path exploit
- Trade-off acceptable: May block some corporate UNC-based tools

### 2025-11-16 - Security Review Discovery
**By:** security-sentinel (Multi-Agent Code Review)
**Actions:**
- Identified during comprehensive security audit of PR #26
- Analyzed platform-specific path.isAbsolute() behavior
- Categorized as P2 (IMPORTANT) security hardening

**Learnings:**
- path.isAbsolute() has platform quirks (UNC paths)
- Configuration-based execution requires strict validation
- Defense-in-depth: multiple validation layers needed

## Notes

Source: Security review performed on 2025-11-16
Review command: /compounding-engineering:review 26
Priority: P2 - Should fix before merge
Impact: Security hardening (prevent remote execution vectors)
