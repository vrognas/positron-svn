// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { SourceControlResourceState } from "vscode";
import { Command } from "./command";

export class Patch extends Command {
  constructor() {
    super("svn.patch");
  }

  public async execute(...resourceStates: SourceControlResourceState[]) {
    const selection = await this.getResourceStatesOrExit(resourceStates);
    if (!selection) return;

    const uris = selection.map(resource => resource.resourceUri);

    await this.runByRepository(uris, async (repository, resources) => {
      const files = resources.map(resource => resource.fsPath);
      const content = await repository.patch(files);
      await this.showDiffPath(repository, content);
    });
  }
}
