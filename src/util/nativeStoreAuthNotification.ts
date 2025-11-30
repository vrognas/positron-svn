// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { window, commands } from "vscode";

/**
 * Track if notification has been shown this session.
 * Prevents spam when multiple auth failures occur.
 */
let notificationShownThisSession = false;

/**
 * Shows notification when system keyring auth fails.
 * Guides user to authenticate via terminal or disable keyring.
 *
 * Only shows once per session to avoid spam.
 */
export async function showSystemKeyringAuthNotification(): Promise<void> {
  if (notificationShownThisSession) {
    return;
  }

  notificationShownThisSession = true;

  const useExtStorage = "Use Extension Storage";
  const openTerminal = "Open Terminal";

  const message =
    "SVN authentication failed. Your OS password manager may be locked or unavailable. " +
    "Switch to extension storage, or run 'svn info <url>' in terminal to unlock.";

  const result = await window.showWarningMessage(
    message,
    useExtStorage,
    openTerminal
  );

  if (result === useExtStorage) {
    await commands.executeCommand(
      "workbench.action.openSettings",
      "svn.auth.credentialMode"
    );
  } else if (result === openTerminal) {
    await commands.executeCommand("workbench.action.terminal.new");
  }
}

// Legacy alias for backwards compatibility
export const showNativeStoreAuthNotification =
  showSystemKeyringAuthNotification;

/**
 * Reset notification state (for testing)
 */
export function resetSystemKeyringAuthNotification(): void {
  notificationShownThisSession = false;
}

// Legacy alias
export const resetNativeStoreAuthNotification =
  resetSystemKeyringAuthNotification;
