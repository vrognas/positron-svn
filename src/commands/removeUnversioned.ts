// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { Repository } from "../repository";
import { Command } from "./command";
import { window } from "vscode";

export class RemoveUnversioned extends Command {
  constructor() {
    super("svn.removeUnversioned", { repository: true });
  }

  public async execute(repository: Repository) {
    const answer = await window.showWarningMessage(
      "Are you sure? This will remove all unversioned files except for ignored.",
      { modal: true },
      "Yes",
      "No"
    );
    if (answer !== "Yes") {
      return;
    }
    await repository.removeUnversioned();
  }
}
