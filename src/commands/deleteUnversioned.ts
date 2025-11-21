// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { SourceControlResourceState, window } from "vscode";
import { exists, lstat, unlink } from "../fs";
import { deleteDirectory } from "../util";
import { Command } from "./command";

export class DeleteUnversioned extends Command {
  constructor() {
    super("svn.deleteUnversioned");
  }

  public async execute(...resourceStates: SourceControlResourceState[]) {
    const selection = await this.getResourceStatesOrExit(resourceStates);
    if (!selection) return;
    const uris = selection.map(resource => resource.resourceUri);
    const answer = await window.showWarningMessage(
      "Would you like to delete selected files?",
      { modal: true },
      "Yes",
      "No"
    );
    if (answer === "Yes") {
      for (const uri of uris) {
        const fsPath = uri.fsPath;

        await this.handleRepositoryOperation(async () => {
          if (!(await exists(fsPath))) {
            return;
          }

          const stat = await lstat(fsPath);

          if (stat.isDirectory()) {
            await deleteDirectory(fsPath);
          } else {
            await unlink(fsPath);
          }
        }, "Unable to delete file");
      }
    }
  }
}
