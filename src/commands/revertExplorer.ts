import { Uri } from "vscode";
import { checkAndPromptDepth, confirmRevert } from "../input/revert";
import { Command } from "./command";

export class RevertExplorer extends Command {
  constructor() {
    super("svn.revertExplorer");
  }

  public async execute(_mainUri?: Uri, allUris?: Uri[]) {
    if (!allUris || allUris.length === 0 || !(await confirmRevert())) {
      return;
    }

    const depth = await checkAndPromptDepth(allUris);

    if (!depth) {
      return;
    }

    await this.executeRevert(allUris, depth);
  }
}
