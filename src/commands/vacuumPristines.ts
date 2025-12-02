// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { window } from "vscode";
import { Repository } from "../repository";
import { Command } from "./command";

export class VacuumPristines extends Command {
  constructor() {
    super("svn.vacuumPristines", { repository: true });
  }

  public async execute(repository: Repository) {
    const answer = await window.showWarningMessage(
      "Reclaim disk space by removing unreferenced pristine copies?",
      { modal: true },
      "Clean Up",
      "Cancel"
    );

    if (answer !== "Clean Up") {
      return;
    }

    try {
      await repository.vacuumPristines();
      window.showInformationMessage("Pristine copies cleaned up");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      window.showErrorMessage(`Failed to vacuum pristines: ${message}`);
    }
  }
}
