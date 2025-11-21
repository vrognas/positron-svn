// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import * as path from "path";
import { window } from "vscode";
import { Status } from "../common/types";
import { inputCommitMessage } from "../messages";
import { Repository } from "../repository";
import { Resource } from "../resource";
import { Command } from "./command";

/**
 * Commit all changes in the Changes group
 */
export class CommitAll extends Command {
  constructor() {
    super("svn.commitAll", { repository: true });
  }

  public async execute(repository: Repository) {
    // Get all resources from changes group
    const changes = repository.changes.resourceStates.filter(
      s => s instanceof Resource
    ) as Resource[];

    if (changes.length === 0) {
      window.showInformationMessage("No changes to commit");
      return;
    }

    const filePaths = changes.map(state => state.resourceUri.fsPath);

    // Go directly to message input (like Commit Selected does)
    const message = await inputCommitMessage(
      repository.inputBox.value,
      true,
      filePaths
    );

    if (message === undefined) {
      return;
    }

    // Handle renamed files and parent directories
    changes.forEach(state => {
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
    });

    await this.handleRepositoryOperation(async () => {
      const result = await repository.commitFiles(message, filePaths);
      window.showInformationMessage(result);
      repository.inputBox.value = "";
    }, "Unable to commit");
  }
}
