// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { ProgressLocation, QuickPickItem, window } from "vscode";
import { ICleanupOptions } from "../common/types";
import { Repository } from "../repository";
import { Command } from "./command";

interface CleanupQuickPickItem extends QuickPickItem {
  id: keyof ICleanupOptions;
  destructive?: boolean;
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
    description: "Reclaim disk space (SVN 1.10+)",
    detail:
      "Removes unreferenced base copies from .svn/pristine/. Safe operation.",
    id: "vacuumPristines",
    picked: false
  },
  {
    label: "$(link-external) Include Externals",
    description: "Process svn:externals directories",
    detail: "Applies cleanup to external working copies too.",
    id: "includeExternals",
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

    // Build options object
    const options: ICleanupOptions = {};
    for (const item of selected) {
      options[item.id] = true;
    }

    // Run cleanup with progress
    try {
      await window.withProgress(
        {
          location: ProgressLocation.Notification,
          title: "Running SVN Cleanup...",
          cancellable: false
        },
        async () => {
          await repository.cleanupAdvanced(options);
        }
      );
      window.showInformationMessage("Cleanup completed");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      window.showErrorMessage(`Cleanup failed: ${message}`);
    }
  }
}
