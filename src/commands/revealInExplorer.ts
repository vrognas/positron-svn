/**
 * Reveal In Explorer Command
 *
 * Reveals a file from the SCM changes view in the file explorer
 */

import { commands } from "vscode";
import { Command } from "./command";
import { Resource } from "../resource";

export class RevealInExplorer extends Command {
  constructor() {
    super("svn.revealInExplorer");
  }

  public async execute(...resources: Resource[]) {
    if (!resources || resources.length === 0) {
      return;
    }

    // Reveal the first resource in the OS file explorer
    const resource = resources[0];
    if (resource.resourceUri) {
      await commands.executeCommand("revealFileInOS", resource.resourceUri);
    }
  }
}
