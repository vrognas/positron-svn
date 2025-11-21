// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

"use strict";

import { Uri, window } from "vscode";
import { Command } from "../command";
import { blameStateManager } from "../../blame/blameStateManager";

export class ClearBlame extends Command {
  constructor() {
    super("svn.blame.clearBlame");
  }

  async execute(uri?: Uri): Promise<void> {
    if (!uri) {
      const editor = window.activeTextEditor;
      if (!editor) {
        return;
      }
      uri = editor.document.uri;
    }

    blameStateManager.clearBlame(uri);
    window.showInformationMessage(`SVN Blame cleared for ${uri.fsPath}`);
  }
}
