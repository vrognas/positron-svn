// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { window, commands } from "vscode";

/**
 * Track if notification has been shown this session.
 * Prevents spam when multiple auth failures occur.
 */
let notificationShownThisSession = false;

/**
 * Shows notification when GPG-agent/native store auth fails.
 * Guides user to authenticate via terminal.
 *
 * Only shows once per session to avoid spam.
 */
export async function showNativeStoreAuthNotification(): Promise<void> {
  if (notificationShownThisSession) {
    return;
  }

  notificationShownThisSession = true;

  const openTerminal = "Open Terminal";
  const learnMore = "Learn More";

  const message =
    "SVN authentication failed. GPG-agent may need your password. " +
    "Run 'svn info <url>' in terminal to authenticate.";

  const result = await window.showWarningMessage(
    message,
    openTerminal,
    learnMore
  );

  if (result === openTerminal) {
    await commands.executeCommand("workbench.action.terminal.new");
  } else if (result === learnMore) {
    await commands.executeCommand(
      "vscode.open",
      "https://github.com/vrognas/positron-svn#gpg-agent-setup"
    );
  }
}

/**
 * Reset notification state (for testing)
 */
export function resetNativeStoreAuthNotification(): void {
  notificationShownThisSession = false;
}
