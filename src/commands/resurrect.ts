// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import * as fs from "fs";
import * as path from "path";
import { QuickPickItem, Uri, window } from "vscode";
import { IDeletedItem, ISvnErrorData } from "../common/types";
import { exists } from "../fs";
import { Repository } from "../repository";
import { Command } from "./command";
import { logError } from "../util/errorLogger";

interface DeletedItemQuickPickItem extends QuickPickItem {
  deletedItem: IDeletedItem;
}

export class Resurrect extends Command {
  constructor() {
    super("svn.resurrect", { repository: true });
  }

  public async execute(repository: Repository) {
    // Show progress while fetching deleted items
    const deleted = await window.withProgress(
      {
        location: { viewId: "workbench.scm" },
        title: "Finding deleted items..."
      },
      async () => {
        return repository.getDeletedItems(100);
      }
    );

    if (deleted.length === 0) {
      window.showInformationMessage(
        "No recently deleted items found in repository log."
      );
      return;
    }

    // Build QuickPick items
    const items: DeletedItemQuickPickItem[] = deleted.map(item => {
      const kindIcon = item.kind === "dir" ? "$(folder)" : "$(file)";
      const dateStr = new Date(item.date).toLocaleDateString();

      return {
        label: `${kindIcon} ${item.path}`,
        description: `r${item.deletedInRevision} by ${item.author}`,
        detail: `${dateStr}: ${item.msg.substring(0, 80)}${item.msg.length > 80 ? "..." : ""}`,
        deletedItem: item
      };
    });

    // Show QuickPick
    const selected = await window.showQuickPick(items, {
      placeHolder: "Select a deleted item to resurrect",
      title: "Resurrect Deleted Item",
      matchOnDescription: true,
      matchOnDetail: true
    });

    if (!selected) {
      return;
    }

    const item = selected.deletedItem;

    // Calculate target path using repository info
    const info = repository.repoInfo;
    const repoRoot = info.repository.root;
    const currentPath = info.url.replace(repoRoot, "");

    let targetPath: string;
    if (item.path.startsWith(currentPath)) {
      targetPath = item.path.substring(currentPath.length + 1);
    } else {
      targetPath = item.path.substring(item.path.lastIndexOf("/") + 1);
    }

    // Check if target already exists
    const fullTargetPath = path.join(repository.workspaceRoot, targetPath);
    const targetExists = await exists(fullTargetPath);

    if (targetExists) {
      // Check if existing target is versioned using svn info
      // Note: getResourceFromFile only returns changed files, not NORMAL versioned files
      const targetUri = Uri.file(fullTargetPath);
      let isVersioned = false;
      try {
        await repository.getInfo(fullTargetPath);
        isVersioned = true; // svn info succeeded = file is versioned
      } catch {
        // svn info failed = file is not versioned (unversioned or ignored)
      }

      const warningMsg = isVersioned
        ? `"${targetPath}" exists and is versioned. Overwriting will replace it.`
        : `"${targetPath}" already exists. How would you like to proceed?`;

      const action = await window.showWarningMessage(
        warningMsg,
        { modal: true },
        "Overwrite",
        "Choose Different Name",
        "Cancel"
      );

      if (action === "Cancel" || action === undefined) {
        return;
      }

      if (action === "Choose Different Name") {
        const newName = await window.showInputBox({
          prompt: "Enter new name for restored item",
          value: this.generateRestoredName(targetPath),
          validateInput: async value => {
            if (!value || value.trim().length === 0) {
              return "Name cannot be empty";
            }
            // Check if new path already exists
            const newFullPath = path.join(repository.workspaceRoot, value);
            if (await exists(newFullPath)) {
              return `"${value}" already exists`;
            }
            return undefined;
          }
        });

        if (!newName) {
          return;
        }

        targetPath = newName;
      } else if (action === "Overwrite") {
        // Delete existing before svn copy
        if (isVersioned) {
          // Use svn delete for versioned files
          await repository.removeFiles([targetUri.fsPath], false);
        } else {
          // Direct filesystem delete for unversioned
          try {
            const stat = fs.statSync(fullTargetPath);
            if (stat.isDirectory()) {
              fs.rmSync(fullTargetPath, { recursive: true });
            } else {
              fs.unlinkSync(fullTargetPath);
            }
          } catch (err) {
            logError("Failed to delete existing file for overwrite", err);
            window.showErrorMessage(
              `Failed to delete existing "${targetPath}": ${err instanceof Error ? err.message : "Unknown error"}`
            );
            return;
          }
        }
      }
    }

    // Execute resurrect
    try {
      await window.withProgress(
        {
          location: { viewId: "workbench.scm" },
          title: `Resurrecting ${path.basename(item.path)}...`
        },
        async () => {
          await repository.resurrect(item.path, item.lastExistingRevision, {
            targetPath
          });
        }
      );

      window.showInformationMessage(
        `Resurrected "${path.basename(item.path)}" from revision ${item.lastExistingRevision}. ` +
          `Item is scheduled for addition with history.`
      );
    } catch (error) {
      const svnError = error as ISvnErrorData;
      if (svnError.stderrFormated) {
        window.showErrorMessage(
          `Failed to resurrect: ${svnError.stderrFormated}`
        );
      } else {
        logError("Resurrect operation failed", error);
        window.showErrorMessage(
          "Failed to resurrect item. See output for details."
        );
      }
    }
  }

  /**
   * Generate a restored name: file.txt -> file_restored.txt
   */
  private generateRestoredName(originalPath: string): string {
    const lastSlash = originalPath.lastIndexOf("/");
    const dir = lastSlash >= 0 ? originalPath.substring(0, lastSlash + 1) : "";
    const filename =
      lastSlash >= 0 ? originalPath.substring(lastSlash + 1) : originalPath;

    const dotIndex = filename.lastIndexOf(".");
    const hasExt = dotIndex > 0;
    const base = hasExt ? filename.substring(0, dotIndex) : filename;
    const ext = hasExt ? filename.substring(dotIndex) : "";

    return `${dir}${base}_restored${ext}`;
  }
}
