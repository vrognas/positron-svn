import { SourceControlResourceState } from "vscode";
import { checkAndPromptDepth, confirmRevert } from "../input/revert";
import { Command } from "./command";

export class Revert extends Command {
  constructor() {
    super("svn.revert");
  }

  public async execute(...resourceStates: SourceControlResourceState[]) {
    const selection = await this.getResourceStates(resourceStates);

    if (selection.length === 0 || !(await confirmRevert())) {
      return;
    }

    const uris = selection.map(resource => resource.resourceUri);
    const depth = await checkAndPromptDepth(uris);

    if (!depth) {
      return;
    }

    await this.executeRevert(uris, depth);
  }
}
