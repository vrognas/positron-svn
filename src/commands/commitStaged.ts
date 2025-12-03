// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import * as path from "path";
import { window } from "vscode";
import { Status } from "../common/types";
import { configuration } from "../helpers/configuration";
import { inputCommitMessage } from "../messages";
import { Repository } from "../repository";
import { Resource } from "../resource";
import { CommitFlowService } from "../services/commitFlowService";
import { Command } from "./command";

/**
 * Commit only staged files.
 * Uses QuickPick flow or legacy webview based on config.
 */
export class CommitStaged extends Command {
  private commitFlowService: CommitFlowService;

  constructor() {
    super("svn.commitStaged", { repository: true });
    this.commitFlowService = new CommitFlowService();
  }

  public async execute(repository: Repository) {
    // Get staged resources
    const stagedResources = repository.staged.resourceStates.filter(
      s => s instanceof Resource
    ) as Resource[];

    if (stagedResources.length === 0) {
      window.showInformationMessage("No staged files to commit");
      return;
    }

    const filePaths = stagedResources.map(state => state.resourceUri.fsPath);

    // Handle renamed files and parent directories
    stagedResources.forEach(state => {
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

    // Get config options
    const useQuickPick = configuration.get<boolean>(
      "commit.useQuickPick",
      true
    );
    const conventionalCommits = configuration.get<boolean>(
      "commit.conventionalCommits",
      true
    );
    const updateBeforeCommit = configuration.get<boolean>(
      "commit.updateBeforeCommit",
      true
    );

    let message: string | undefined;
    let selectedFiles: string[] = filePaths;

    if (useQuickPick) {
      // QuickPick flow (skips file selection since user already staged)
      const result = await this.commitFlowService.runCommitFlow(
        repository,
        filePaths,
        {
          conventionalCommits,
          updateBeforeCommit
        }
      );

      if (result.cancelled) {
        return;
      }
      message = result.message;
      selectedFiles = result.selectedFiles || filePaths;
    } else {
      // Legacy flow
      message = await inputCommitMessage(
        repository.inputBox.value,
        true,
        filePaths
      );
    }

    if (message === undefined) {
      return;
    }

    await this.handleRepositoryOperation(async () => {
      const result = await repository.commitFiles(message!, selectedFiles);
      window.showInformationMessage(result);
      repository.inputBox.value = "";
      // Note: SVN automatically removes files from changelists after commit
      // No need to call removeChangelist - it's handled by SVN
      // Clear original changelist tracking for committed files
      repository.staging.clearOriginalChangelists(selectedFiles);
    }, "Unable to commit");
  }
}
