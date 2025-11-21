// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import * as path from "path";
import { window } from "vscode";
import { inputCommitFiles } from "../changelistItems";
import { Status } from "../common/types";
import { inputCommitMessage } from "../messages";
import { Repository } from "../repository";
import { Resource } from "../resource";
import { Command } from "./command";

export class CommitWithMessage extends Command {
  constructor() {
    super("svn.commitWithMessage", { repository: true });
  }

  public async execute(repository: Repository) {
    const resourceStates = await inputCommitFiles(repository);
    if (!resourceStates || resourceStates.length === 0) {
      return;
    }

    const filePaths = resourceStates.map(state => {
      return state.resourceUri.fsPath;
    });

    const message = await inputCommitMessage(
      repository.inputBox.value,
      false,
      filePaths
    );
    if (message === undefined) {
      return;
    }

    // If files is renamed, the commit need previous file
    resourceStates.forEach(state => {
      if (state instanceof Resource) {
        if (state.type === Status.ADDED && state.renameResourceUri) {
          filePaths.push(state.renameResourceUri.fsPath);
        }

        let dir = path.dirname(state.resourceUri.fsPath);
        let parent = repository.getResourceFromFile(dir);

        while (parent) {
          if (parent.type === Status.ADDED) {
            filePaths.push(dir);
          }
          dir = path.dirname(dir);
          parent = repository.getResourceFromFile(dir);
        }
      }
    });

    await this.handleRepositoryOperation(async () => {
      const result = await repository.commitFiles(message, filePaths);
      window.showInformationMessage(result);
      repository.inputBox.value = "";
    }, "Unable to commit");
  }
}
