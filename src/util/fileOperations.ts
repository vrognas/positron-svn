/**
 * Shared file operation utilities for reveal and diff commands
 * Used by both SCM changes view and repository log tree view
 */

import * as path from "path";
import { commands, Uri, window, workspace } from "vscode";
import { logError } from "./errorLogger";
import { exists } from "../fs";

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
 * @param workspaceRoot Workspace root path (or empty for current directory)
 * @param filePath Absolute file system path or remote URL
 * @param svnExec SVN exec function (sourceControlManager.svn.exec)
 * @param oldRevision Optional: old revision for historical diff (e.g., "123")
 * @param newRevision Optional: new revision for historical diff (e.g., "124")
 * @throws Error if configuration invalid, tool not found, or execution fails
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

  // Validate configuration exists
  if (!diffToolPath) {
    const error = new Error(
      "External diff tool not configured. Set svn.diff.tool to path of bcsvn.bat"
    );
    logError("Diff tool not configured", error);
    window.showErrorMessage(error.message);
    throw error;
  }

  // Security: Validate path is absolute to prevent relative path exploits
  if (!path.isAbsolute(diffToolPath)) {
    const error = new Error(
      `External diff tool must be an absolute path: ${diffToolPath}`
    );
    logError("Diff tool path not absolute", error);
    window.showErrorMessage(error.message);
    throw error;
  }

  // Security: Reject UNC paths on Windows to prevent remote code execution
  if (process.platform === "win32" && diffToolPath.startsWith("\\\\")) {
    const error = new Error(
      `UNC paths not allowed for security: ${diffToolPath}`
    );
    logError("UNC path rejected", error);
    window.showErrorMessage(error.message);
    throw error;
  }

  // Validate tool exists
  if (!(await exists(diffToolPath))) {
    const error = new Error(`External diff tool not found at: ${diffToolPath}`);
    logError("Diff tool not found", error);
    window.showErrorMessage(error.message);
    throw error;
  }

  // Security: Validate revision format (must be numeric)
  const revisionRegex = /^\d+$/;
  if (oldRevision && !revisionRegex.test(oldRevision)) {
    const error = new Error(`Invalid old revision format: ${oldRevision}`);
    logError("Invalid revision format", error);
    window.showErrorMessage(error.message);
    throw error;
  }
  if (newRevision && !revisionRegex.test(newRevision)) {
    const error = new Error(`Invalid new revision format: ${newRevision}`);
    logError("Invalid revision format", error);
    window.showErrorMessage(error.message);
    throw error;
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
    // External diff tools (like Beyond Compare) stay open, causing SVN to timeout
    // Exit code 124 = timeout, but tool launched successfully - treat as success
    if (
      typeof error === "object" &&
      error !== null &&
      "exitCode" in error &&
      "svnCommand" in error &&
      (error as { exitCode: number; svnCommand: string }).exitCode === 124 &&
      (error as { exitCode: number; svnCommand: string }).svnCommand === "diff"
    ) {
      // Tool launched successfully, just timed out waiting for close
      return;
    }

    logError("Failed to launch external diff", error);
    throw error;
  }
}
