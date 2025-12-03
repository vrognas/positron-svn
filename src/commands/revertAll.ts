// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { SourceControlResourceGroup } from "vscode";
import { confirmRevert } from "../input/revert";
import { Resource } from "../resource";
import { STAGING_CHANGELIST } from "../services/stagingService";
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

    // Track staged files to unstage after revert
    const stagedPaths = resourceStates
      .filter(r => r instanceof Resource && r.changelist === STAGING_CHANGELIST)
      .map(r => r.resourceUri.fsPath);

    // Always use infinity depth - for files it's ignored by SVN,
    // for directories it ensures full recursive revert including deleted paths
    await this.runByRepository(uris, async (repository, resources) => {
      const paths = resources.map(resource => resource.fsPath).reverse();
      await this.handleRepositoryOperation(async () => {
        await repository.revert(paths, "infinity");
        // Auto-unstage reverted files (they have no changes to commit)
        const revertedStaged = paths.filter(p => stagedPaths.includes(p));
        if (revertedStaged.length > 0) {
          await repository.removeChangelist(revertedStaged);
          repository.staging.clearOriginalChangelists(revertedStaged);
        }
      }, "Unable to revert");
    });
  }
}
