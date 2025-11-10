import * as path from "path";
import { Uri, window } from "vscode";
import { Repository } from "../repository";
import { fixPathSeparator } from "../util";
import { validateFilePath } from "../validation";
import { Command } from "./command";

export class RenameExplorer extends Command {
  constructor() {
    super("svn.renameExplorer", { repository: true });
  }

  public async execute(
    repository: Repository,
    mainUri?: Uri,
    _allUris?: Uri[]
  ) {
    if (!mainUri) {
      return;
    }

    const oldName = mainUri.fsPath;

    return this.rename(repository, oldName);
  }

  private async rename(
    repository: Repository,
    oldFile: string,
    newName?: string
  ) {
    oldFile = fixPathSeparator(oldFile);

    if (!newName) {
      const root = fixPathSeparator(repository.workspaceRoot);
      const oldName = path.relative(root, oldFile);
      newName = await window.showInputBox({
        value: path.basename(oldFile),
        prompt: `New name name for ${oldName}`
      });
    }
    if (!newName) {
      return;
    }

    // Validate user input to prevent path traversal
    if (!validateFilePath(newName)) {
      window.showErrorMessage("Invalid file name: path traversal attempts are not allowed");
      return;
    }

    const basepath = path.dirname(oldFile);
    newName = path.join(basepath, newName);

    await repository.rename(oldFile, newName);
  }
}
