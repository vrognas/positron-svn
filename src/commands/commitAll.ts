// Copyright (c) 2017-2020 Christopher Johnston
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
 * Commit all staged files (or offer to stage all if none staged).
 * Enforces "stage before commit" workflow.
 */
export class CommitAll extends Command {
  private commitFlowService: CommitFlowService;

  constructor() {
    super("svn.commitAll", { repository: true });
    this.commitFlowService = new CommitFlowService();
  }

  public async execute(repository: Repository) {
    // Get staged and changed files
    const staged = repository.staged.resourceStates.filter(
      s => s instanceof Resource
    ) as Resource[];

    const changes = repository.changes.resourceStates.filter(
      s => s instanceof Resource
    ) as Resource[];

    // Require files to be staged before commit
    if (staged.length === 0) {
      if (changes.length === 0) {
        window.showInformationMessage("No changes to commit");
        return;
      }

      // Offer to stage all and commit
      const choice = await window.showInformationMessage(
        `${changes.length} file(s) not staged. Stage all and commit?`,
        "Stage All",
        "Cancel"
      );

      if (choice !== "Stage All") {
        return;
      }

      // Stage all changes
      const changePaths = changes.map(r => r.resourceUri.fsPath);
      await repository.stageOptimistic(changePaths);
    }

    // Get staged files (possibly just auto-staged)
    const resourcesToCommit = repository.staged.resourceStates.filter(
      s => s instanceof Resource
    ) as Resource[];

    // Use Set to avoid duplicates when multiple files share parent dirs
    const filePathSet = new Set(
      resourcesToCommit.map(state => state.resourceUri.fsPath)
    );

    // Handle renamed files and parent directories
    resourcesToCommit.forEach(state => {
      if (state.type === Status.ADDED && state.renameResourceUri) {
        filePathSet.add(state.renameResourceUri.fsPath);
      }

      let dir = path.dirname(state.resourceUri.fsPath);
      let parent = repository.getResourceFromFile(dir);

      while (parent) {
        if (parent.type === Status.ADDED) {
          filePathSet.add(dir);
        }
        dir = path.dirname(dir);
        parent = repository.getResourceFromFile(dir);
      }
    });

    const filePaths = Array.from(filePathSet);

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

    if (useQuickPick) {
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
    } else {
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
      const result = await repository.commitFiles(message!, filePaths);
      window.showInformationMessage(result);
      repository.inputBox.value = "";
      repository.staging.clearOriginalChangelists(filePaths);
    }, "Unable to commit");
  }
}
