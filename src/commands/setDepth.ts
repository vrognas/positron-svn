// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { commands, QuickPickItem, Uri, window } from "vscode";
import { SvnDepth } from "../common/types";
import { Command } from "./command";
import { SourceControlManager } from "../source_control_manager";

interface DepthQuickPickItem extends QuickPickItem {
  depth: keyof typeof SvnDepth;
}

const depthOptions: DepthQuickPickItem[] = [
  {
    label: "$(eye-closed) Exclude",
    description: "Remove from working copy",
    detail:
      "Completely removes the folder and its contents from the working copy",
    depth: "exclude"
  },
  {
    label: "$(folder) Empty",
    description: "Only this folder",
    detail: "Keep only the folder itself, remove all contents",
    depth: "empty"
  },
  {
    label: "$(file) Files only",
    description: "Immediate file children",
    detail: "Keep the folder and its immediate files, but not subfolders",
    depth: "files"
  },
  {
    label: "$(list-tree) Immediates",
    description: "Immediate children",
    detail: "Keep files and subfolders (as empty), but not deeper content",
    depth: "immediates"
  },
  {
    label: "$(folder-opened) Fully recursive",
    description: "All descendants",
    detail: "Include the folder and all its contents recursively",
    depth: "infinity"
  }
];

export class SetDepth extends Command {
  constructor() {
    super("svn.setDepth");
  }

  public async execute(uri?: Uri): Promise<void> {
    // Get URI from argument or active explorer selection
    if (!uri) {
      return;
    }

    // Get repository for this path
    const sourceControlManager = (await commands.executeCommand(
      "svn.getSourceControlManager",
      ""
    )) as SourceControlManager;

    const repository = sourceControlManager.getRepository(uri);
    if (!repository) {
      window.showErrorMessage("No SVN repository found for this folder");
      return;
    }

    // Show QuickPick for depth selection
    const selected = await window.showQuickPick(depthOptions, {
      placeHolder: "Select checkout depth for this folder",
      title: "SVN: Set Folder Depth"
    });

    if (!selected) {
      return; // User cancelled
    }

    // Confirm for destructive operations
    if (selected.depth === "exclude" || selected.depth === "empty") {
      const confirm = await window.showWarningMessage(
        `This will remove local files. Continue?`,
        { modal: true },
        "Yes",
        "No"
      );
      if (confirm !== "Yes") {
        return;
      }
    }

    try {
      const result = await repository.setDepth(uri.fsPath, selected.depth);
      if (result.exitCode === 0) {
        window.showInformationMessage(
          `Folder depth set to "${selected.depth}"`
        );
      }
    } catch (error) {
      window.showErrorMessage(`Failed to set depth: ${error}`);
    }
  }
}
