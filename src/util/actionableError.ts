// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

/**
 * Actionable error utility - shows error messages with recovery action buttons.
 * Helps users fix common SVN issues without searching for commands.
 */

import { commands, Uri, window } from "vscode";

/**
 * Show error with "Run Cleanup" action button.
 * Use when SVN reports working copy lock issues (E155004, E155037).
 */
export async function showLockedError(
  message: string,
  repositoryRoot?: Uri
): Promise<void> {
  const action = await window.showErrorMessage(message, "Run Cleanup");
  if (action === "Run Cleanup") {
    if (repositoryRoot) {
      commands.executeCommand("svn.cleanup", repositoryRoot);
    } else {
      commands.executeCommand("svn.cleanup");
    }
  }
}

/**
 * Show error with "Clear Credentials" action button.
 * Use when authentication repeatedly fails.
 */
export async function showAuthError(message: string): Promise<void> {
  const action = await window.showErrorMessage(message, "Clear Credentials");
  if (action === "Clear Credentials") {
    commands.executeCommand("svn.clearCredentials");
  }
}

/**
 * Show error with "Update" action button.
 * Use when commit fails due to out-of-date working copy.
 */
export async function showOutOfDateError(
  message: string,
  repositoryRoot?: Uri
): Promise<void> {
  const action = await window.showErrorMessage(message, "Update");
  if (action === "Update") {
    if (repositoryRoot) {
      commands.executeCommand("svn.update", repositoryRoot);
    } else {
      commands.executeCommand("svn.update");
    }
  }
}

/**
 * Show error with "Show Output" action button.
 * Generic fallback for errors where output panel has details.
 */
export async function showErrorWithOutput(message: string): Promise<void> {
  const action = await window.showErrorMessage(message, "Show Output");
  if (action === "Show Output") {
    commands.executeCommand("svn.showOutput");
  }
}
