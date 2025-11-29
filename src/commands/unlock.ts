// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { SourceControlResourceState, window } from "vscode";
import { Command } from "./command";

export class Unlock extends Command {
  constructor() {
    super("svn.unlock");
  }

  public async execute(...resourceStates: SourceControlResourceState[]) {
    const selection = await this.getResourceStatesOrExit(resourceStates);
    if (!selection) return;

    await this.executeOnResources(
      selection,
      async (repository, paths) => {
        const result = await repository.unlock(paths);
        if (result.exitCode === 0) {
          window.showInformationMessage(`Unlocked ${paths.length} file(s)`);
        }
      },
      "Unable to unlock files"
    );
  }
}

export class BreakLock extends Command {
  constructor() {
    super("svn.breakLock");
  }

  public async execute(...resourceStates: SourceControlResourceState[]) {
    const selection = await this.getResourceStatesOrExit(resourceStates);
    if (!selection) return;

    // Confirm breaking lock
    const answer = await window.showWarningMessage(
      "Break lock owned by another user? This cannot be undone.",
      { modal: true },
      "Break Lock",
      "Cancel"
    );

    if (answer !== "Break Lock") {
      return;
    }

    await this.executeOnResources(
      selection,
      async (repository, paths) => {
        const result = await repository.unlock(paths, { force: true });
        if (result.exitCode === 0) {
          window.showInformationMessage(
            `Broke lock on ${paths.length} file(s)`
          );
        }
      },
      "Unable to break lock"
    );
  }
}
