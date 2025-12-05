// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

/**
 * Reveal In Explorer View Command
 *
 * Reveals a file from the SCM changes view in VS Code's Explorer sidebar
 */

import { commands, SourceControlResourceState, window } from "vscode";
import { Command } from "./command";

export class RevealInExplorerView extends Command {
  constructor() {
    super("svn.revealInExplorerView");
  }

  public async execute(...resourceStates: SourceControlResourceState[]) {
    if (resourceStates.length === 0) {
      return;
    }

    const resource = resourceStates[0]!;
    if (!resource.resourceUri) {
      return;
    }

    try {
      // Use VS Code's built-in command to reveal in Explorer sidebar
      await commands.executeCommand("revealInExplorer", resource.resourceUri);
    } catch (error) {
      window.showErrorMessage("Unable to reveal file in Explorer view");
    }
  }
}
