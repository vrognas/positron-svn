# SVN Cleanup Feature - Implementation Plan

**Version**: 2.0.0
**Date**: 2025-12-02
**Status**: Complete

---

## Executive Summary

Single consolidated `SVN: Cleanup...` command with TortoiseSVN-inspired options dialog.

**Implemented**: v2.30.0 - Single command with multi-select dialog
**Removed**: Separate `Cleanup (Advanced)`, `Remove ignored files`, `Vacuum pristine copies` commands

---

## Timestamp Fix Note

**Important**: Basic `svn cleanup` already repairs timestamps automatically.

The SVN CLI hardcodes `fix_timestamps = TRUE` in `svn_client_cleanup2()`:

```c
// From subversion/svn/cleanup-cmd.c
svn_error_t *err = svn_client_cleanup2(target_abspath,
                                       TRUE /* break_locks */,
                                       TRUE /* fix_timestamps */,  // <-- Always TRUE
                                       TRUE /* clear_dav_cache */,
                                       TRUE /* vacuum_pristines */,
                                       opt_state->include_externals,
                                       ctx, iterpool);
```

**Source**: [subversion/svn/cleanup-cmd.c](https://github.com/freebsd/freebsd-src/blob/master/contrib/subversion/subversion/svn/cleanup-cmd.c)

**Why TortoiseSVN has separate option**: TortoiseSVN calls `svn_client_cleanup2()` API directly, allowing granular control over each parameter. This is useful for users who want to skip timestamp repair (performance on large repos). The CLI doesn't expose this because it's always beneficial to run.

**Implication for us**: No separate "Fix Timestamps" feature needed - users get it automatically.

---

## Phase Overview

| Phase | Description           | Effort | Priority |
| ----- | --------------------- | ------ | -------- |
| **0** | Tests first (TDD)     | 2h     | P0       |
| **1** | Core API methods      | 2h     | P0       |
| **2** | Simple commands       | 1h     | P0       |
| **3** | Cleanup dialog UI     | 3h     | P1       |
| **4** | SVN version detection | 1h     | P1       |
| **5** | Progress & safety     | 2h     | P2       |
| **6** | Documentation         | 1h     | P2       |

**Total**: ~12h

---

## Phase 0: Tests First (TDD)

Per CLAUDE.md: Write tests BEFORE implementation.

### 0.1 Unit tests (Vitest)

**File**: `src/test/unit/cleanup.test.ts`

```typescript
describe("Cleanup operations", () => {
  // Test 1: Basic cleanup builds correct args
  it("cleanup() calls svn cleanup", async () => {
    const result = await repository.cleanup();
    expect(execMock).toHaveBeenCalledWith(["cleanup"]);
  });

  // Test 2: Advanced cleanup with options
  it("cleanupAdvanced() builds correct args", async () => {
    await repository.cleanupAdvanced({
      vacuumPristines: true,
      removeIgnored: true,
      includeExternals: true
    });
    expect(execMock).toHaveBeenCalledWith([
      "cleanup",
      "--vacuum-pristines",
      "--remove-ignored",
      "--include-externals"
    ]);
  });

  // Test 3: Options interface validation
  it("cleanupAdvanced() with no options calls basic cleanup", async () => {
    await repository.cleanupAdvanced({});
    expect(execMock).toHaveBeenCalledWith(["cleanup"]);
  });
});
```

### 0.2 E2E tests (Mocha)

**File**: `src/test/suite/cleanup.test.ts`

```typescript
suite("Cleanup E2E", () => {
  // Test 1: Basic cleanup on real working copy
  test("cleanup resolves working copy state", async () => {
    // Create interrupted state, run cleanup, verify fixed
  });

  // Test 2: Remove ignored deletes matching files
  test("removeIgnored deletes svn:ignore matches", async () => {
    // Create ignored file, run removeIgnored, verify deleted
  });

  // Test 3: Include externals processes nested WCs
  test("cleanupWithExternals processes svn:externals", async () => {
    // Setup external, dirty it, run cleanup --include-externals
  });
});
```

---

## Phase 1: Core API Methods

### 1.1 Add types

**File**: `src/common/types.ts`

```typescript
// Add after line 136 (after Operation.List)
export enum Operation {
  // ... existing ...
  VacuumPristines = "VacuumPristines",
  RemoveIgnored = "RemoveIgnored"
}

// Add new interface
export interface ICleanupOptions {
  /** Remove unreferenced pristine copies (SVN 1.10+) */
  vacuumPristines?: boolean;
  /** Remove files matching svn:ignore patterns */
  removeIgnored?: boolean;
  /** Remove unversioned files (?) */
  removeUnversioned?: boolean;
  /** Process svn:externals directories */
  includeExternals?: boolean;
}
```

### 1.2 Add svnRepository methods

**File**: `src/svnRepository.ts` (after line 1357)

```typescript
/**
 * Remove files matching svn:ignore patterns.
 * WARNING: Permanent deletion, no recovery via SVN.
 * @requires SVN 1.9+
 */
public async removeIgnored(): Promise<string> {
  const result = await this.exec(["cleanup", "--remove-ignored"]);
  this.svn.logOutput(result.stdout);
  return result.stdout;
}

/**
 * Reclaim disk space by removing unreferenced pristine copies.
 * Safe operation - only removes truly unreferenced files.
 * @requires SVN 1.10+
 */
public async vacuumPristines(): Promise<string> {
  const result = await this.exec(["cleanup", "--vacuum-pristines"]);
  return result.stdout;
}

/**
 * Run cleanup with externals support.
 * Processes all svn:externals directories recursively.
 * @requires SVN 1.9+
 */
public async cleanupWithExternals(): Promise<string> {
  const result = await this.exec(["cleanup", "--include-externals"]);
  return result.stdout;
}

/**
 * Advanced cleanup with multiple options.
 * Combines multiple cleanup operations in single SVN call.
 * @param options Cleanup options to enable
 * @requires SVN 1.9+ for most options, 1.10+ for vacuumPristines
 */
public async cleanupAdvanced(options: ICleanupOptions): Promise<string> {
  const args = ["cleanup"];

  if (options.vacuumPristines) {
    args.push("--vacuum-pristines");
  }
  if (options.removeUnversioned) {
    args.push("--remove-unversioned");
  }
  if (options.removeIgnored) {
    args.push("--remove-ignored");
  }
  if (options.includeExternals) {
    args.push("--include-externals");
  }

  const result = await this.exec(args);
  this.svn.logOutput(result.stdout);
  return result.stdout;
}
```

### 1.3 Add Repository wrappers

**File**: `src/repository.ts` (after line 856)

```typescript
public async removeIgnored() {
  return this.run(Operation.CleanUp, () =>
    this.repository.removeIgnored()
  );
}

public async vacuumPristines() {
  return this.run(Operation.CleanUp, () =>
    this.repository.vacuumPristines()
  );
}

public async cleanupWithExternals() {
  return this.run(Operation.CleanUp, () =>
    this.repository.cleanupWithExternals()
  );
}

public async cleanupAdvanced(options: ICleanupOptions) {
  return this.run(Operation.CleanUp, () =>
    this.repository.cleanupAdvanced(options)
  );
}
```

---

## Phase 2: Simple Commands

### 2.1 Update existing cleanup command

**File**: `src/commands/cleanup.ts`

Keep as-is for basic cleanup (backwards compatible).

### 2.2 Add removeIgnored command

**File**: `src/commands/removeIgnored.ts`

```typescript
import { window } from "vscode";
import { Repository } from "../repository";
import { Command } from "./command";

export class RemoveIgnored extends Command {
  constructor() {
    super("svn.removeIgnored", { repository: true });
  }

  public async execute(repository: Repository) {
    const answer = await window.showWarningMessage(
      "Delete all ignored files? This cannot be undone.",
      { modal: true },
      "Delete",
      "Cancel"
    );

    if (answer !== "Delete") return;

    await repository.removeIgnored();
    window.showInformationMessage("Ignored files removed");
  }
}
```

### 2.3 Add vacuumPristines command

**File**: `src/commands/vacuumPristines.ts`

```typescript
import { window } from "vscode";
import { Repository } from "../repository";
import { Command } from "./command";

export class VacuumPristines extends Command {
  constructor() {
    super("svn.vacuumPristines", { repository: true });
  }

  public async execute(repository: Repository) {
    await repository.vacuumPristines();
    window.showInformationMessage("Pristine copies cleaned up");
  }
}
```

### 2.4 Register commands

**File**: `src/commands.ts` (in registerCommands)

```typescript
// Add imports
import { RemoveIgnored } from "./commands/removeIgnored";
import { VacuumPristines } from "./commands/vacuumPristines";
import { CleanupAdvanced } from "./commands/cleanupAdvanced";

// Add registrations
disposables.push(new RemoveIgnored());
disposables.push(new VacuumPristines());
disposables.push(new CleanupAdvanced());
```

---

## Phase 3: Cleanup Dialog UI

### 3.1 Design: Multi-Select QuickPick

TortoiseSVN uses checkboxes. VS Code equivalent: `showQuickPick` with `canPickMany: true`.

**File**: `src/commands/cleanupAdvanced.ts`

```typescript
import { QuickPickItem, window } from "vscode";
import { Repository } from "../repository";
import { Command } from "./command";
import { ICleanupOptions } from "../common/types";

interface CleanupQuickPickItem extends QuickPickItem {
  id: keyof ICleanupOptions;
  destructive?: boolean;
  requiresVersion?: string;
}

const cleanupOptions: CleanupQuickPickItem[] = [
  {
    label: "$(trash) Remove Unversioned Files",
    description: "Delete files not tracked by SVN",
    detail: "Removes files with '?' status. Cannot be undone!",
    id: "removeUnversioned",
    destructive: true,
    picked: false
  },
  {
    label: "$(exclude) Remove Ignored Files",
    description: "Delete files matching ignore patterns",
    detail:
      "Removes files with 'I' status (build artifacts, etc). Cannot be undone!",
    id: "removeIgnored",
    destructive: true,
    picked: false
  },
  {
    label: "$(database) Vacuum Pristine Copies",
    description: "Reclaim disk space",
    detail:
      "Removes unreferenced base copies from .svn/pristine/. Safe operation.",
    id: "vacuumPristines",
    picked: false,
    requiresVersion: "1.10"
  },
  {
    label: "$(link-external) Include Externals",
    description: "Process svn:externals directories",
    detail: "Applies cleanup to external working copies too.",
    id: "includeExternals",
    picked: true // Default on
  }
];

export class CleanupAdvanced extends Command {
  constructor() {
    super("svn.cleanupAdvanced", { repository: true });
  }

  public async execute(repository: Repository) {
    // Step 1: Show multi-select picker
    const selected = await window.showQuickPick(cleanupOptions, {
      canPickMany: true,
      placeHolder: "Select cleanup options (Space to toggle, Enter to confirm)",
      title: "SVN Cleanup Options"
    });

    if (!selected || selected.length === 0) {
      return; // User cancelled
    }

    // Step 2: Check for destructive options
    const destructive = selected.filter(s => s.destructive);
    if (destructive.length > 0) {
      const names = destructive
        .map(d => d.label.replace(/\$\([^)]+\)\s*/, ""))
        .join(", ");
      const confirm = await window.showWarningMessage(
        `WARNING: "${names}" will permanently delete files. Continue?`,
        { modal: true },
        "Delete Files",
        "Cancel"
      );
      if (confirm !== "Delete Files") {
        return;
      }
    }

    // Step 3: Build options object
    const options: ICleanupOptions = {};
    for (const item of selected) {
      options[item.id] = true;
    }

    // Step 4: Run cleanup with progress
    await window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Running SVN Cleanup...",
        cancellable: false
      },
      async () => {
        await repository.cleanupAdvanced(options);
      }
    );

    window.showInformationMessage("Cleanup completed");
  }
}
```

### 3.2 UI Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                   SVN Cleanup Options                       │
├─────────────────────────────────────────────────────────────┤
│ [ ] $(trash) Remove Unversioned Files                       │
│     Delete files not tracked by SVN                         │
│                                                             │
│ [ ] $(exclude) Remove Ignored Files                         │
│     Delete files matching ignore patterns                   │
│                                                             │
│ [ ] $(database) Vacuum Pristine Copies                      │
│     Reclaim disk space                                      │
│                                                             │
│ [✓] $(link-external) Include Externals                      │
│     Process svn:externals directories                       │
├─────────────────────────────────────────────────────────────┤
│ Space to toggle, Enter to confirm                           │
└─────────────────────────────────────────────────────────────┘
           │
           ▼ (if destructive selected)
┌─────────────────────────────────────────────────────────────┐
│ ⚠️ WARNING                                                   │
│                                                             │
│ "Remove Unversioned Files, Remove Ignored Files"            │
│ will permanently delete files. Continue?                    │
│                                                             │
│              [Delete Files]  [Cancel]                       │
└─────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│ Running SVN Cleanup...                                      │
│ ████████████████░░░░░░░░                                    │
└─────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│ ✓ Cleanup completed                                         │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 package.json contributions

```json
{
  "commands": [
    {
      "command": "svn.cleanup",
      "title": "Cleanup",
      "category": "SVN"
    },
    {
      "command": "svn.cleanupAdvanced",
      "title": "Cleanup (Advanced)...",
      "category": "SVN"
    },
    {
      "command": "svn.removeIgnored",
      "title": "Remove Ignored Files",
      "category": "SVN"
    },
    {
      "command": "svn.vacuumPristines",
      "title": "Vacuum Pristine Copies",
      "category": "SVN"
    }
  ],
  "menus": {
    "scm/title": [
      {
        "command": "svn.cleanupAdvanced",
        "group": "4_cleanup@1",
        "when": "scmProvider == svn"
      }
    ],
    "commandPalette": [
      {
        "command": "svn.cleanupAdvanced",
        "when": "config.svn.enabled"
      }
    ]
  }
}
```

---

## Phase 4: SVN Version Detection

### 4.1 Add version check utility

**File**: `src/svn.ts` (add method)

```typescript
/**
 * Get SVN version tuple [major, minor, patch]
 * Cached after first call.
 */
private _svnVersion?: [number, number, number];

public async getSvnVersion(): Promise<[number, number, number]> {
  if (this._svnVersion) {
    return this._svnVersion;
  }

  const result = await this.exec(".", ["--version", "--quiet"]);
  // Output: "1.14.2" or similar
  const match = result.stdout.trim().match(/^(\d+)\.(\d+)\.(\d+)/);
  if (match) {
    this._svnVersion = [
      parseInt(match[1], 10),
      parseInt(match[2], 10),
      parseInt(match[3], 10)
    ];
  } else {
    this._svnVersion = [1, 0, 0]; // Fallback
  }
  return this._svnVersion;
}

/**
 * Check if SVN version meets minimum requirement
 */
public async hasMinVersion(major: number, minor: number): Promise<boolean> {
  const [svnMajor, svnMinor] = await this.getSvnVersion();
  return svnMajor > major || (svnMajor === major && svnMinor >= minor);
}
```

### 4.2 Filter options by version

**File**: `src/commands/cleanupAdvanced.ts` (update execute)

```typescript
public async execute(repository: Repository) {
  // Filter options by SVN version
  const svn = repository.repository.svn;
  const has19 = await svn.hasMinVersion(1, 9);
  const has110 = await svn.hasMinVersion(1, 10);

  let availableOptions = cleanupOptions;

  if (!has110) {
    availableOptions = availableOptions.filter(
      o => o.id !== "vacuumPristines"
    );
  }

  if (!has19) {
    // SVN < 1.9: Only basic cleanup available
    window.showInformationMessage(
      "Advanced cleanup requires SVN 1.9+. Running basic cleanup."
    );
    await repository.cleanup();
    return;
  }

  // ... rest of implementation
}
```

---

## Phase 5: Progress & Safety

### 5.1 Pre-deletion preview

Show what will be deleted before destructive operations.

```typescript
async function previewDeletion(
  repository: Repository,
  removeUnversioned: boolean,
  removeIgnored: boolean
): Promise<{ unversioned: string[]; ignored: string[] }> {
  const status = await repository.repository.getStatus({
    includeIgnored: removeIgnored
  });

  return {
    unversioned: removeUnversioned
      ? status.filter(s => s.status === Status.UNVERSIONED).map(s => s.path)
      : [],
    ignored: removeIgnored
      ? status.filter(s => s.status === Status.IGNORED).map(s => s.path)
      : []
  };
}
```

### 5.2 Enhanced confirmation dialog

```typescript
// Show file count in warning
const preview = await previewDeletion(
  repository,
  options.removeUnversioned,
  options.removeIgnored
);

const totalFiles = preview.unversioned.length + preview.ignored.length;

if (totalFiles > 0) {
  const confirm = await window.showWarningMessage(
    `This will permanently delete ${totalFiles} files:\n` +
      `• ${preview.unversioned.length} unversioned\n` +
      `• ${preview.ignored.length} ignored\n\n` +
      `Continue?`,
    { modal: true },
    "Delete Files",
    "Show Files",
    "Cancel"
  );

  if (confirm === "Show Files") {
    // Open output channel with file list
    const output = window.createOutputChannel("SVN Cleanup Preview");
    output.appendLine("Files to be deleted:");
    output.appendLine("");
    preview.unversioned.forEach(f => output.appendLine(`[?] ${f}`));
    preview.ignored.forEach(f => output.appendLine(`[I] ${f}`));
    output.show();
    return; // Let user review and run again
  }

  if (confirm !== "Delete Files") {
    return;
  }
}
```

### 5.3 Progress reporting

```typescript
await window.withProgress(
  {
    location: ProgressLocation.Notification,
    title: "SVN Cleanup",
    cancellable: false
  },
  async progress => {
    const steps = Object.values(options).filter(Boolean).length + 1;
    let step = 0;

    progress.report({ message: "Running cleanup...", increment: 0 });

    // Basic cleanup always runs
    await repository.repository.exec(["cleanup"]);
    progress.report({
      message: "Working copy cleaned",
      increment: 100 / steps
    });
    step++;

    if (options.vacuumPristines) {
      progress.report({ message: "Vacuuming pristines..." });
      await repository.repository.exec(["cleanup", "--vacuum-pristines"]);
      progress.report({ increment: 100 / steps });
      step++;
    }

    // ... etc for each option
  }
);
```

---

## Phase 6: Documentation & Polish

### 6.1 Update CHANGELOG.md

```markdown
## [2.28.0] - 2025-12-XX

### Added

- **Advanced Cleanup Dialog**: New `SVN: Cleanup (Advanced)...` command with options:
  - Remove unversioned files (deletes ? status files)
  - Remove ignored files (deletes I status files)
  - Vacuum pristine copies (reclaims disk space, SVN 1.10+)
  - Include externals (processes svn:externals)
- **SVN Version Detection**: Automatically disables options not supported by installed SVN
- **Deletion Preview**: Shows file count before destructive operations
- **New Commands**: `svn.removeIgnored`, `svn.vacuumPristines`

### Changed

- Basic `svn.cleanup` unchanged for backwards compatibility
```

### 6.2 Update README.md

```markdown
## Cleanup Operations

### Basic Cleanup

- **SVN: Cleanup** - Fixes working copy state, removes locks

### Advanced Cleanup

- **SVN: Cleanup (Advanced)...** - Multi-option cleanup dialog:
  - ☐ Remove Unversioned Files - Delete untracked files
  - ☐ Remove Ignored Files - Delete build artifacts
  - ☐ Vacuum Pristine Copies - Reclaim disk space
  - ☑ Include Externals - Process nested repositories

> ⚠️ **Warning**: File deletion is permanent and cannot be undone via SVN.
```

### 6.3 Configuration settings

```json
{
  "svn.cleanup.defaultIncludeExternals": {
    "type": "boolean",
    "default": true,
    "description": "Include externals by default in cleanup operations"
  },
  "svn.cleanup.confirmDestructive": {
    "type": "boolean",
    "default": true,
    "description": "Show confirmation before deleting files"
  }
}
```

---

## Commit Strategy

Per LESSONS_LEARNED.md: Small focused commits, one concern each.

| Commit | Description                                      |
| ------ | ------------------------------------------------ |
| 1      | `test: add cleanup unit tests`                   |
| 2      | `feat: add ICleanupOptions type`                 |
| 3      | `feat: add svnRepository.cleanupAdvanced()`      |
| 4      | `feat: add Repository.cleanupAdvanced() wrapper` |
| 5      | `feat: add removeIgnored command`                |
| 6      | `feat: add vacuumPristines command`              |
| 7      | `feat: add cleanupAdvanced dialog command`       |
| 8      | `feat: add SVN version detection`                |
| 9      | `feat: add deletion preview`                     |
| 10     | `feat: add progress reporting`                   |
| 11     | `docs: update changelog and readme`              |
| 12     | `chore: bump version to 2.28.0`                  |

---

## Files Changed Summary

| File                              | Changes                       |
| --------------------------------- | ----------------------------- |
| `src/common/types.ts`             | +15 lines (ICleanupOptions)   |
| `src/svnRepository.ts`            | +45 lines (4 methods)         |
| `src/repository.ts`               | +20 lines (4 wrappers)        |
| `src/svn.ts`                      | +25 lines (version detection) |
| `src/commands/cleanupAdvanced.ts` | +120 lines (new file)         |
| `src/commands/removeIgnored.ts`   | +25 lines (new file)          |
| `src/commands/vacuumPristines.ts` | +20 lines (new file)          |
| `src/commands.ts`                 | +5 lines (registrations)      |
| `package.json`                    | +30 lines (commands, menus)   |
| `src/test/unit/cleanup.test.ts`   | +50 lines (new file)          |
| `src/test/suite/cleanup.test.ts`  | +80 lines (new file)          |

**Total**: ~435 new lines

---

## Unresolved Questions

1. **Revert in cleanup?** TortoiseSVN includes "Revert all changes" - include in dialog or keep separate?

2. ~~**Fix timestamps?**~~ **RESOLVED**: Basic `svn cleanup` already does this automatically (see Timestamp Fix Note above).

3. **Shell overlays?** Document as Windows-only TortoiseSVN feature, not implementable?

4. **Preview channel?** Output channel vs QuickPick for file preview?

5. **Externals default?** Should `includeExternals` default to true (more complete) or false (safer)?

6. **Confirmation threshold?** Skip confirmation if <5 files? Or always confirm destructive?

7. **Pristine size estimate?** Show estimated disk space savings before vacuum? (requires pre-scan)

---

## Risk Assessment

| Risk                                     | Likelihood | Impact | Mitigation                           |
| ---------------------------------------- | ---------- | ------ | ------------------------------------ |
| Data loss from removeUnversioned/Ignored | Medium     | High   | Mandatory confirmation, preview      |
| SVN version incompatibility              | Low        | Medium | Version detection, graceful fallback |
| WC corruption if cleanup interrupted     | Low        | High   | Use SVN's built-in atomicity         |
| Externals missed                         | Low        | Low    | Default includeExternals=true        |

---

## Testing Checklist

- [ ] Basic cleanup still works
- [ ] removeUnversioned deletes ? files
- [ ] removeIgnored deletes I files
- [ ] vacuumPristines runs without error on SVN 1.10+
- [ ] vacuumPristines hidden on SVN < 1.10
- [ ] includeExternals processes external WCs
- [ ] Confirmation dialog appears for destructive ops
- [ ] Cancel works at each step
- [ ] Progress notification shows during operation
- [ ] Error messages display on failure
- [ ] Commands appear in palette
- [ ] Menu item appears in SCM title area

---

**Document Version**: 1.1
**Author**: Claude
**Last Updated**: 2025-12-02
