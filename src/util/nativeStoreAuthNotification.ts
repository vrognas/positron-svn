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

  const openTerminal = "Open Terminal";
  const disableKeyring = "Disable Keyring";

  const message =
    "SVN authentication failed. System keyring may need unlock. " +
    "Run 'svn info <url>' in terminal, or disable keyring in settings.";

  const result = await window.showWarningMessage(
    message,
    openTerminal,
    disableKeyring
  );

  if (result === openTerminal) {
    await commands.executeCommand("workbench.action.terminal.new");
  } else if (result === disableKeyring) {
    await commands.executeCommand(
      "workbench.action.openSettings",
      "svn.auth.useSystemKeyring"
    );
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
