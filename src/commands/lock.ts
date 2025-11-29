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
        }
      },
      "Unable to lock files"
    );
  }
}
