"use strict";

import { Uri, window } from "vscode";
import { Command } from "../command";
import { blameStateManager } from "../../blame/blameStateManager";

export class ShowBlame extends Command {
  constructor() {
    super("svn.blame.showBlame");
  }

  async execute(uri?: Uri): Promise<void> {
    if (!uri) {
      const editor = window.activeTextEditor;
      if (!editor) {
        return;
      }
      uri = editor.document.uri;
    }

    blameStateManager.setBlameEnabled(uri, true);
    window.showInformationMessage(`SVN Blame enabled for ${uri.fsPath}`);
  }
}
