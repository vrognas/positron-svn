// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { SourceControlResourceGroup } from "vscode";
import { confirmRevert } from "../input/revert";
import { Command } from "./command";

export class RevertAll extends Command {
  constructor() {
    super("svn.revertAll");
  }

  public async execute(resourceGroup: SourceControlResourceGroup) {
    const resourceStates = resourceGroup.resourceStates;

    if (resourceStates.length === 0 || !(await confirmRevert())) {
      return;
    }

    const uris = resourceStates.map(resource => resource.resourceUri);

    // Always use infinity depth - for files it's ignored by SVN,
    // for directories it ensures full recursive revert including deleted paths
    await this.runByRepository(uris, async (repository, resources) => {
      const paths = resources.map(resource => resource.fsPath).reverse();
      await this.handleRepositoryOperation(
        async () => await repository.revert(paths, "infinity"),
        "Unable to revert"
      );
    });
  }
}
