import { SourceControlResourceState, window } from "vscode";
import { getConflictPickOptions } from "../conflictItems";
import { Command } from "./command";

export class Resolve extends Command {
  constructor() {
    super("svn.resolve");
  }

  public async execute(...resourceStates: SourceControlResourceState[]) {
    const selection = await this.getResourceStates(resourceStates);

    if (selection.length === 0) {
      return;
    }

    const picks = getConflictPickOptions();
    const choice = await window.showQuickPick(picks, {
      placeHolder: "Select conflict option"
    });

    if (!choice) {
      return;
    }

    await this.executeOnResources(
      selection,
      async (repository, paths) => {
        await repository.resolve(paths, choice.label);
      },
      "Unable to resolve conflicts"
    );
  }
}
