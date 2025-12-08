// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { SourceControlResourceState, Uri, window } from "vscode";
import { Command } from "./command";
import { makeReadOnly, makeWritable } from "../fs";

/**
 * Toggle svn:needs-lock property on files.
 * Files with this property are read-only until locked.
 */
export class ToggleNeedsLock extends Command {
  // Prevent concurrent toggles on same paths
  private inProgress = new Set<string>();

  constructor() {
    super("svn.toggleNeedsLock");
  }

  public async execute(...args: (SourceControlResourceState | Uri)[]) {
    // Handle Uri from Explorer context menu
    // args[0] = clicked item, args[1] = array of all selected items (multi-select)
    if (args.length > 0 && args[0] instanceof Uri) {
      const uris = Array.isArray(args[1])
        ? (args[1] as Uri[]).filter((a): a is Uri => a instanceof Uri)
        : [args[0]];
      await this.runByRepository(uris, async (repository, resources) => {
        const paths = resources.map(r => r.fsPath);
        await this.toggleNeedsLockOnPaths(repository, paths);
      });
      return;
    }

    // Handle SourceControlResourceState from SCM view
    const selection = await this.getResourceStatesOrExit(
      args as SourceControlResourceState[]
    );
    if (!selection) return;

    await this.executeOnResources(
      selection,
      async (repository, paths) => {
        await this.toggleNeedsLockOnPaths(repository, paths);
      },
      "Unable to toggle needs-lock property"
    );
  }

  private async toggleNeedsLockOnPaths(
    repository: Parameters<Parameters<typeof this.executeOnResources>[1]>[0],
    paths: string[]
  ): Promise<void> {
    let successCount = 0;
    let action = "";

    for (const filePath of paths) {
      // Skip if already toggling this path
      if (this.inProgress.has(filePath)) {
        continue;
      }
      this.inProgress.add(filePath);

      try {
        // Use cached check to avoid propget warning when property doesn't exist
        const hasProperty = repository.hasNeedsLockCached(filePath);

        if (hasProperty) {
          const result = await repository.removeNeedsLock(filePath);
          if (result.exitCode === 0) {
            // Make file writable since needs-lock is removed
            try {
              await makeWritable(filePath);
            } catch {
              // Ignore permission errors
            }
            successCount++;
            action = "removed";
          } else {
            window.showErrorMessage(
              `Failed to remove needs-lock: ${result.stderr || "Unknown error"}`
            );
          }
        } else {
          const result = await repository.setNeedsLock(filePath);
          if (result.exitCode === 0) {
            // Make file read-only since needs-lock is set
            try {
              await makeReadOnly(filePath);
            } catch {
              // Ignore permission errors
            }
            successCount++;
            action = "set";
          } else {
            window.showErrorMessage(
              `Failed to set needs-lock: ${result.stderr || "Unknown error"}`
            );
          }
        }
      } finally {
        this.inProgress.delete(filePath);
      }
    }

    if (successCount > 0) {
      if (action === "removed") {
        window.showInformationMessage(
          `Removed svn:needs-lock from ${successCount} file(s)`
        );
      } else {
        window.showInformationMessage(
          `Set svn:needs-lock on ${successCount} file(s). Files are now read-only until locked.`
        );
      }
    }
  }
}
