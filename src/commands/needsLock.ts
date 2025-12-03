// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { SourceControlResourceState, window } from "vscode";
import { Command } from "./command";

/**
 * Toggle svn:needs-lock property on files.
 * Files with this property are read-only until locked.
 */
export class ToggleNeedsLock extends Command {
  constructor() {
    super("svn.toggleNeedsLock");
  }

  public async execute(...resourceStates: SourceControlResourceState[]) {
    const selection = await this.getResourceStatesOrExit(resourceStates);
    if (!selection) return;

    await this.executeOnResources(
      selection,
      async (repository, paths) => {
        let successCount = 0;
        let action = "";

        for (const filePath of paths) {
          const hasProperty = await repository.hasNeedsLock(filePath);

          if (hasProperty) {
            const result = await repository.removeNeedsLock(filePath);
            if (result.exitCode === 0) {
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
              successCount++;
              action = "set";
            } else {
              window.showErrorMessage(
                `Failed to set needs-lock: ${result.stderr || "Unknown error"}`
              );
            }
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
      },
      "Unable to toggle needs-lock property"
    );
  }
}
