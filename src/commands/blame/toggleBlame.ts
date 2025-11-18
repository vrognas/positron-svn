"use strict";

import { Uri, window } from "vscode";
import { Command } from "../command";
import { blameStateManager } from "../../blame/blameStateManager";

export class ToggleBlame extends Command {
  constructor() {
    super("svn.blame.toggleBlame");
  }

  async execute(uri?: Uri): Promise<void> {
    if (!uri) {
      const editor = window.activeTextEditor;
      if (!editor) {
        return;
      }
      uri = editor.document.uri;
    }

    const newState = blameStateManager.toggleBlame(uri);
    const action = newState ? "enabled" : "disabled";

    window.showInformationMessage(`SVN Blame ${action} for ${uri.fsPath}`);
  }
}
