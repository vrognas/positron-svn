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
        for (const filePath of paths) {
          const hasProperty = await repository.hasNeedsLock(filePath);

          if (hasProperty) {
            const result = await repository.removeNeedsLock(filePath);
            if (result.exitCode === 0) {
              window.showInformationMessage(
                `Removed svn:needs-lock from ${paths.length} file(s)`
              );
            } else {
              window.showErrorMessage(
                `Failed to remove needs-lock: ${result.stderr || "Unknown error"}`
              );
            }
          } else {
            const result = await repository.setNeedsLock(filePath);
            if (result.exitCode === 0) {
              window.showInformationMessage(
                `Set svn:needs-lock on ${paths.length} file(s). Files are now read-only until locked.`
              );
            } else {
              window.showErrorMessage(
                `Failed to set needs-lock: ${result.stderr || "Unknown error"}`
              );
            }
          }
        }
      },
      "Unable to toggle needs-lock property"
    );
  }
}
