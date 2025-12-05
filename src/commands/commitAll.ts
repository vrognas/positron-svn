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
    // Display paths: shown in picker (only new names for renames)
    const displayPathSet = new Set(
      resourcesToCommit.map(state => state.resourceUri.fsPath)
    );

    // Track renamed files: map new path -> old path (for SVN commit)
    const renameMap = new Map<string, string>();

    // Handle renamed files and parent directories
    resourcesToCommit.forEach(state => {
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
      message = await inputCommitMessage(
        repository.inputBox.value,
        true,
        displayPaths
      );
      selectedPaths = displayPaths; // All paths when not using QuickPick
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
      repository.staging.clearOriginalChangelists(commitPaths);
    }, "Unable to commit");
  }
}
