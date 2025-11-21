// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { SourceControlResourceState, window } from "vscode";
import { Command } from "./command";

export class Remove extends Command {
  constructor() {
    super("svn.remove");
  }

  public async execute(...resourceStates: SourceControlResourceState[]) {
    const selection = await this.getResourceStatesOrExit(resourceStates);
    if (!selection) return;

    const answer = await window.showWarningMessage(
      "Would you like to keep a local copy of the files?",
      { modal: true },
      "Yes",
      "No"
    );

    if (!answer) {
      return;
    }

    const keepLocal = answer === "Yes";

    await this.executeOnResources(
      selection,
      async (repository, paths) => {
        await repository.removeFiles(paths, keepLocal);
      },
      "Unable to remove files"
    );
  }
}
