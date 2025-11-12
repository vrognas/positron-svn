/**
 * Reveal In Explorer Command
 *
 * Reveals a file from the SCM changes view in the file explorer
 */

import { commands, SourceControlResourceState, window } from "vscode";
import { Command } from "./command";
import { logError } from "../util/errorLogger";

export class RevealInExplorer extends Command {
  constructor() {
    super("svn.revealInExplorer");
  }

  public async execute(...resourceStates: SourceControlResourceState[]) {
    if (resourceStates.length === 0) {
      return;
    }

    // Reveal the first resource in the OS file explorer
    // Note: Only first file revealed when multiple selected (matches VS Code UX)
    const resource = resourceStates[0];
    if (!resource.resourceUri) {
      return;
    }

    try {
      await commands.executeCommand("revealFileInOS", resource.resourceUri);
    } catch (error) {
      logError("Reveal in explorer failed", error);
      window.showErrorMessage("Unable to reveal file in explorer");
    }
  }
}
