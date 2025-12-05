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

    // Use Set to avoid duplicates when multiple files share parent dirs
    // Display paths: shown in picker (only new names for renames)
    const displayPathSet = new Set(
      stagedResources.map(state => state.resourceUri.fsPath)
    );

    // Track renamed files: map new path -> old path (for SVN commit)
    const renameMap = new Map<string, string>();

    // Handle renamed files and parent directories
    stagedResources.forEach(state => {
      // Track old paths for renamed files (needed for SVN commit, not for display)
      if (state.type === Status.ADDED && state.renameResourceUri) {
        renameMap.set(state.resourceUri.fsPath, state.renameResourceUri.fsPath);
      }

      let dir = path.dirname(state.resourceUri.fsPath);
      let parent = repository.getResourceFromFile(dir);

      while (parent) {
        if (parent.type === Status.ADDED) {
          displayPathSet.add(dir);
        }
        dir = path.dirname(dir);
        parent = repository.getResourceFromFile(dir);
      }
    });

    // Display paths for file picker (excludes old paths of renamed files)
    const displayPaths = Array.from(displayPathSet);

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
    let selectedPaths: string[] | undefined;

    if (useQuickPick) {
      // QuickPick flow (skips file selection since user already staged)
      const result = await this.commitFlowService.runCommitFlow(
        repository,
        displayPaths,
        {
          conventionalCommits,
          updateBeforeCommit
        }
      );

      if (result.cancelled) {
        return;
      }
      message = result.message;
      selectedPaths = result.selectedFiles;
    } else {
      // Legacy flow
      message = await inputCommitMessage(
        repository.inputBox.value,
        true,
        displayPaths
      );
      selectedPaths = displayPaths;
    }

    if (message === undefined || !selectedPaths) {
      return;
    }

    // Add old paths for renamed files (required for SVN commit)
    const commitPaths = [...selectedPaths];
    for (const selectedPath of selectedPaths) {
      const oldPath = renameMap.get(selectedPath);
      if (oldPath) {
        commitPaths.push(oldPath);
      }
    }

    await this.handleRepositoryOperation(async () => {
      const result = await repository.commitFiles(message!, commitPaths);
      window.showInformationMessage(result);
      repository.inputBox.value = "";
      // Note: SVN automatically removes files from changelists after commit
      // No need to call removeChangelist - it's handled by SVN
      // Clear original changelist tracking for committed files
      repository.staging.clearOriginalChangelists(commitPaths);
    }, "Unable to commit");
  }
}
