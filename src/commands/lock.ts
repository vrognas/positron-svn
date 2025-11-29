// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { SourceControlResourceState, window } from "vscode";
import { Command } from "./command";

export class Lock extends Command {
  constructor() {
    super("svn.lock");
  }

  public async execute(...resourceStates: SourceControlResourceState[]) {
    const selection = await this.getResourceStatesOrExit(resourceStates);
    if (!selection) return;

    // Prompt for optional lock comment
    const comment = await window.showInputBox({
      prompt: "Enter a lock comment (optional)",
      placeHolder: "e.g., Editing large dataset"
    });

    // User cancelled the input box
    if (comment === undefined) {
      return;
    }

    await this.executeOnResources(
      selection,
      async (repository, paths) => {
        const result = await repository.lock(paths, comment ? { comment } : {});
        if (result.exitCode === 0) {
          window.showInformationMessage(`Locked ${paths.length} file(s)`);
        } else {
          window.showErrorMessage(
            `Lock failed: ${result.stderr || "Unknown error"}`
          );
        }
      },
      "Unable to lock files"
    );
  }
}

/**
 * Steal lock from another user (atomic break + relock via svn lock --force)
 */
export class StealLock extends Command {
  constructor() {
    super("svn.stealLock");
  }

  public async execute(...resourceStates: SourceControlResourceState[]) {
    const selection = await this.getResourceStatesOrExit(resourceStates);
    if (!selection) return;

    // Confirm stealing lock
    const answer = await window.showWarningMessage(
      "Steal lock from another user? They will lose their lock.",
      { modal: true },
      "Steal Lock",
      "Cancel"
    );

    if (answer !== "Steal Lock") {
      return;
    }

    await this.executeOnResources(
      selection,
      async (repository, paths) => {
        const result = await repository.lock(paths, { force: true });
        if (result.exitCode === 0) {
          window.showInformationMessage(
            `Stole lock on ${paths.length} file(s)`
          );
        } else {
          window.showErrorMessage(
            `Steal lock failed: ${result.stderr || "Unknown error"}`
          );
        }
      },
      "Unable to steal lock"
    );
  }
}
