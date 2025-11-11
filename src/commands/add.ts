import { SourceControlResourceState } from "vscode";
import { Command } from "./command";

export class Add extends Command {
  constructor() {
    super("svn.add");
  }

  public async execute(...resourceStates: SourceControlResourceState[]) {
    await this.executeOnResources(
      resourceStates,
      async (repository, paths) => {
        await repository.addFiles(paths);
      },
      "Unable to add file"
    );
  }
}
