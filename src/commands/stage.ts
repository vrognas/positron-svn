// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { SourceControlResourceState, window } from "vscode";
import { Resource } from "../resource";
import { STAGING_CHANGELIST } from "../services/stagingService";
import { Command } from "./command";

/**
 * Check if any resources are in changelists (other than staging).
 * Returns list of changelist names that will be affected.
 */
function getAffectedChangelists(resources: Resource[]): string[] {
  const changelists = new Set<string>();
  for (const resource of resources) {
    if (resource.changelist && resource.changelist !== STAGING_CHANGELIST) {
      changelists.add(resource.changelist);
    }
  }
  return Array.from(changelists);
}

/**
 * Build a map of file path → original changelist for resources.
 * Used to restore changelists on unstage.
 */
function buildOriginalChangelistMap(
  resources: Resource[]
): Map<string, string> {
  const map = new Map<string, string>();
  for (const resource of resources) {
    if (resource.changelist && resource.changelist !== STAGING_CHANGELIST) {
      map.set(resource.resourceUri.fsPath, resource.changelist);
    }
  }
  return map;
}

/**
 * Warn user if staging will remove files from existing changelists.
 * Returns true if user wants to proceed, false to cancel.
 */
async function warnAboutChangelists(changelists: string[]): Promise<boolean> {
  if (changelists.length === 0) return true;

  const listStr = changelists.join(", ");
  const message =
    changelists.length === 1
      ? `This will remove files from changelist "${listStr}". Continue?`
      : `This will remove files from changelists: ${listStr}. Continue?`;

  const choice = await window.showWarningMessage(message, "Stage", "Cancel");
  return choice === "Stage";
}

export class Stage extends Command {
  constructor() {
    super("svn.stage");
  }

  public async execute(...resourceStates: SourceControlResourceState[]) {
    const selection = await this.getResourceStatesOrExit(resourceStates);
    if (!selection) return;

    // Warn if files are in other changelists
    const affected = getAffectedChangelists(selection);
    if (!(await warnAboutChangelists(affected))) return;

    // Build map of original changelists before staging
    const originalChangelists = buildOriginalChangelistMap(selection);

    const uris = selection.map(resource => resource.resourceUri);

    await this.runByRepository(uris, async (repository, resources) => {
      const paths = resources.map(r => r.fsPath);

      // Save original changelists for restore on unstage
      for (const path of paths) {
        const original = originalChangelists.get(path);
        if (original) {
          repository.staging.saveOriginalChangelist(path, original);
        }
      }

      // Use optimistic update - skips full status refresh
      await this.handleRepositoryOperation(
        async () => repository.stageOptimistic(paths),
        "Unable to stage files"
      );
    });
  }
}

export class StageAll extends Command {
  constructor() {
    super("svn.stageAll");
  }

  public async execute(...resourceStates: SourceControlResourceState[]) {
    const selection = await this.getResourceStates(resourceStates);

    // If called with resources, stage those; otherwise stage all changes
    if (selection.length > 0) {
      // Warn if files are in other changelists
      const affected = getAffectedChangelists(selection);
      if (!(await warnAboutChangelists(affected))) return;

      // Build map of original changelists before staging
      const originalChangelists = buildOriginalChangelistMap(selection);

      const uris = selection.map(resource => resource.resourceUri);
      await this.runByRepository(uris, async (repository, resources) => {
        const paths = resources.map(r => r.fsPath);

        // Save original changelists for restore on unstage
        for (const path of paths) {
          const original = originalChangelists.get(path);
          if (original) {
            repository.staging.saveOriginalChangelist(path, original);
          }
        }

        // Use optimistic update - skips full status refresh
        await this.handleRepositoryOperation(
          async () => repository.stageOptimistic(paths),
          "Unable to stage files"
        );
      });
    } else {
      // Stage all changes in all repositories - these are in "Changes" group
      // so they shouldn't be in any changelist (no original changelist to save)
      await this.runByRepository([], async repository => {
        const changes = repository.changes.resourceStates;
        const paths = changes.map(r => r.resourceUri.fsPath);
        if (paths.length > 0) {
          // Use optimistic update - skips full status refresh
          await this.handleRepositoryOperation(
            async () => repository.stageOptimistic(paths),
            "Unable to stage files"
          );
        }
      });
    }
  }
}
