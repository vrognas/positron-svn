/**
 * Shared file operation utilities for reveal and diff commands
 * Used by both SCM changes view and repository log tree view
 */

import { commands, Uri, window, workspace } from "vscode";
import { logError } from "./errorLogger";
import { existsSync } from "fs";

/**
 * Reveal file in OS file explorer
 * @param fsPath Absolute file system path or Uri
 */
export async function revealFileInOS(fsPath: string | Uri): Promise<void> {
  try {
    const uri = typeof fsPath === "string" ? Uri.file(fsPath) : fsPath;
    await commands.executeCommand("revealFileInOS", uri);
  } catch (error) {
    logError("Reveal in explorer failed", error);
    throw error;
  }
}

/**
 * Open file with external diff tool using SVN's --diff-cmd
 * @param workspaceRoot Workspace root path
 * @param filePath Absolute file system path or remote URL
 * @param svnExec SVN exec function (repository.exec for Repository or sourceControlManager.svn.exec for RemoteRepository)
 * @param oldRevision Optional: old revision for historical diff (e.g., "123")
 * @param newRevision Optional: new revision for historical diff (e.g., "124")
 */
export async function diffWithExternalTool(
  workspaceRoot: string,
  filePath: string,
  svnExec: (cwd: string, args: string[]) => Promise<any>,
  oldRevision?: string,
  newRevision?: string
): Promise<void> {
  // Read external diff tool configuration
  const config = workspace.getConfiguration("svn");
  const diffToolPath = config.get<string>("diff.tool");

  if (!diffToolPath) {
    window.showErrorMessage(
      "External diff tool not configured. Set svn.diff.tool to path of bcsvn.bat"
    );
    return;
  }

  if (!existsSync(diffToolPath)) {
    window.showErrorMessage(
      `External diff tool not found at: ${diffToolPath}`
    );
    return;
  }

  try {
    const args = ["diff", `--diff-cmd=${diffToolPath}`];

    // Add revision range if provided
    if (oldRevision && newRevision) {
      args.push(`-r${oldRevision}:${newRevision}`);
    }

    args.push(filePath);

    // Call svn diff with --diff-cmd pointing to external tool
    await svnExec(workspaceRoot, args);
  } catch (error) {
    logError("Failed to launch external diff", error);
    throw error;
  }
}
