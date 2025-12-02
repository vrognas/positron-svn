// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { ProgressLocation, QuickPickItem, window } from "vscode";
import { ICleanupOptions } from "../common/types";
import { Repository } from "../repository";
import { Command } from "./command";

interface CleanupQuickPickItem extends QuickPickItem {
  id: keyof ICleanupOptions;
  destructive?: boolean;
  /** Short name for progress/completion messages */
  shortName: string;
}

/**
 * Cleanup options for multi-select dialog.
 *
 * Note: Basic cleanup always fixes timestamps automatically
 * (hardcoded in SVN CLI svn_client_cleanup2 with fix_timestamps=TRUE).
 * See: https://github.com/freebsd/freebsd-src/blob/master/contrib/subversion/subversion/svn/cleanup-cmd.c
 */
const cleanupOptions: CleanupQuickPickItem[] = [
  {
    label: "$(trash) Remove Unversioned Files",
    description: "Delete untracked files",
    detail:
      "Deletes files not in SVN (e.g. temp files, local configs). Cannot be undone!",
    id: "removeUnversioned",
    shortName: "unversioned files",
    destructive: true,
    picked: false
  },
  {
    label: "$(exclude) Remove Ignored Files",
    description: "Delete build artifacts & ignored files",
    detail:
      "Deletes files matching ignore patterns (e.g. node_modules, *.log). Cannot be undone!",
    id: "removeIgnored",
    shortName: "ignored files",
    destructive: true,
    picked: false
  },
  {
    label: "$(database) Reclaim Disk Space",
    description: "Remove old cached file copies (SVN 1.10+)",
    detail: "Cleans up internal SVN cache to free disk space. Safe operation.",
    id: "vacuumPristines",
    shortName: "disk space",
    picked: false
  },
  {
    label: "$(link-external) Include External Folders",
    description: "Also clean linked external repositories",
    detail: "Applies cleanup to external working copies (if any).",
    id: "includeExternals",
    shortName: "externals",
    picked: false // Safe default - user must opt-in
  }
];

export class CleanupAdvanced extends Command {
  constructor() {
    super("svn.cleanupAdvanced", { repository: true });
  }

  public async execute(repository: Repository) {
    // Show multi-select picker
    const selected = await window.showQuickPick(cleanupOptions, {
      canPickMany: true,
      placeHolder: "Select cleanup options (Space to toggle, Enter to confirm)",
      title: "SVN Cleanup Options"
    });

    if (!selected || selected.length === 0) {
      return; // User cancelled
    }

    // Check for destructive options
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

    // Build options object and collect operation names
    const options: ICleanupOptions = {};
    const operations: string[] = [];
    for (const item of selected) {
      options[item.id] = true;
      if (item.id !== "includeExternals") {
        operations.push(item.shortName);
      }
    }

    // Build progress title
    const progressTitle =
      operations.length > 0
        ? `Cleaning: ${operations.join(", ")}...`
        : "Running SVN Cleanup...";

    // Run cleanup with progress (not cancellable - SVN ops run to completion)
    try {
      await window.withProgress(
        {
          location: ProgressLocation.Notification,
          title: progressTitle,
          cancellable: false
        },
        async () => {
          await repository.cleanupAdvanced(options);
        }
      );

      // Show descriptive completion message
      const completedOps =
        operations.length > 0 ? `Removed ${formatList(operations)}. ` : "";
      const externalsNote = options.includeExternals
        ? "Included externals."
        : "";
      window.showInformationMessage(
        `Cleanup completed. ${completedOps}${externalsNote}`.trim()
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      window.showErrorMessage(`Cleanup failed: ${message}`);
    }
  }
}

/** Format list with commas and "and" (e.g., "a, b, and c") */
function formatList(items: string[]): string {
  if (items.length <= 2) {
    return items.join(" and ");
  }
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}
