// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import * as path from "path";
import { SourceControlResourceState, Uri } from "vscode";
import { Status } from "../common/types";
import { confirmRevert } from "../input/revert";
import { Resource } from "../resource";
import { STAGING_CHANGELIST } from "../services/stagingService";
import { Command } from "./command";

export class Revert extends Command {
  constructor() {
    super("svn.revert");
  }

  public async execute(...resourceStates: SourceControlResourceState[]) {
    const selection = await this.getResourceStatesOrExit(resourceStates);
    if (!selection || !(await confirmRevert())) return;

    const uris = selection.map(resource => resource.resourceUri);

    // Track staged files to unstage after revert
    const stagedPaths = selection
      .filter(r => r instanceof Resource && r.changelist === STAGING_CHANGELIST)
      .map(r => r.resourceUri.fsPath);

    // Track renamed files - need to revert both old and new paths
    // Otherwise reverting renamed.txt leaves file.txt deleted
    const renamedFromPaths = selection
      .filter(
        r =>
          r instanceof Resource &&
          r.type === Status.ADDED &&
          r.renameResourceUri
      )
      .map(r => (r as Resource).renameResourceUri!.fsPath);

    // Always use infinity depth - for files it's ignored by SVN,
    // for directories it ensures full recursive revert including deleted paths
    await this.runByRepository(uris, async (repository, resources) => {
      const paths = resources.map(r => r.fsPath);

      // Include original paths of renamed files (relative to this repo)
      const renamePaths = renamedFromPaths.filter(p =>
        p.startsWith(repository.workspaceRoot + path.sep)
      );
      const allPaths = [...paths, ...renamePaths];

      await this.handleRepositoryOperation(async () => {
        await repository.revert(allPaths, "infinity");
        // Invalidate needs-lock cache (revert may have changed svn:needs-lock)
        repository.invalidateNeedsLockCache();
        // Refresh Explorer decorations for reverted files (L badge, etc)
        repository.refreshExplorerDecorations(allPaths.map(p => Uri.file(p)));
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
