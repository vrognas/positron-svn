// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { SourceControlResourceState } from "vscode";
import { Command } from "./command";

export class Add extends Command {
  constructor() {
    super("svn.add");
  }

  public async execute(...resourceStates: SourceControlResourceState[]) {
    await this.executeOnResources(
      resourceStates,
      async (repository, paths) => {
        await repository.addFiles(paths);
      },
      "Unable to add file"
    );
  }
}
