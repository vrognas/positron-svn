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
    await repository.vacuumPristines();
    window.showInformationMessage("Pristine copies cleaned up");
  }
}
