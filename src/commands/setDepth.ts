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
    label: "$(eye-closed) Exclude from Working Copy",
    description: "Don't download this folder",
    detail:
      "Removes the folder and all contents. Use this for large folders you don't need.",
    depth: "exclude"
  },
  {
    label: "$(folder) Folder Only (No Contents)",
    description: "Keep empty folder",
    detail: "Keeps the folder as a placeholder but removes all files inside.",
    depth: "empty"
  },
  {
    label: "$(file) Files Only (No Subfolders)",
    description: "Skip nested folders",
    detail: "Downloads files directly in this folder, but not any subfolders.",
    depth: "files"
  },
  {
    label: "$(list-tree) Shallow (One Level)",
    description: "First level only",
    detail:
      "Downloads files and shows subfolders as empty. Good for exploring structure.",
    depth: "immediates"
  },
  {
    label: "$(folder-opened) Full (All Contents)",
    description: "Download everything",
    detail: "Downloads the folder and all its contents recursively.",
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

    // Get folder name for display
    const folderName = uri.fsPath.split(/[\\/]/).pop() || "folder";

    // Show QuickPick for depth selection
    const selected = await window.showQuickPick(depthOptions, {
      placeHolder: "What should be downloaded for this folder?",
      title: `SVN: Sparse Checkout - ${folderName}`
    });

    if (!selected) {
      return; // User cancelled
    }

    // Confirm for destructive operations (all except infinity add content)
    if (selected.depth !== "infinity") {
      const warningMessages: Record<string, string> = {
        exclude:
          "This will remove the folder and all its contents from your working copy. " +
          "The files still exist in the repository and can be restored later.",
        empty:
          "This will remove all files and subfolders inside this folder. " +
          "The folder itself will remain as an empty placeholder.",
        files:
          "This will remove all subfolders (but keep files). " +
          "Subfolder contents can be restored later.",
        immediates:
          "This will remove contents of subfolders (keeping them as empty). " +
          "Deeper contents can be restored later."
      };

      const confirm = await window.showWarningMessage(
        warningMessages[selected.depth] ||
          "This operation may remove local files.",
        { modal: true },
        "Continue",
        "Cancel"
      );
      if (confirm !== "Continue") {
        return;
      }
    }

    try {
      const result = await repository.setDepth(uri.fsPath, selected.depth);
      if (result.exitCode === 0) {
        const successMessages: Record<string, string> = {
          exclude: `"${folderName}" excluded from working copy`,
          empty: `"${folderName}" contents removed (folder kept)`,
          files: `"${folderName}" set to files only`,
          immediates: `"${folderName}" set to shallow checkout`,
          infinity: `"${folderName}" fully restored`
        };
        window.showInformationMessage(
          successMessages[selected.depth] || `Checkout depth changed`
        );
      } else {
        window.showErrorMessage(
          `Failed to change checkout: ${result.stderr || "Unknown error"}`
        );
      }
    } catch (error) {
      window.showErrorMessage(`Failed to change checkout: ${error}`);
    }
  }
}
