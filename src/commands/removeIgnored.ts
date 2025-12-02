// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { window } from "vscode";
import { Repository } from "../repository";
import { Command } from "./command";

export class RemoveIgnored extends Command {
  constructor() {
    super("svn.removeIgnored", { repository: true });
  }

  public async execute(repository: Repository) {
    const answer = await window.showWarningMessage(
      "Delete all ignored files? This cannot be undone.",
      { modal: true },
      "Delete",
      "Cancel"
    );

    if (answer !== "Delete") {
      return;
    }

    try {
      await repository.removeIgnored();
      window.showInformationMessage("Ignored files removed");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      window.showErrorMessage(`Failed to remove ignored files: ${message}`);
    }
  }
}
