// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { Disposable, SourceControl, Uri } from "vscode";
import { ISvnResourceGroup } from "../common/types";
import { Resource } from "../resource";
import { StatusResult } from "./StatusService";
import { StagingService, STAGING_CHANGELIST } from "./stagingService";
import { normalizePath, toDisposable } from "../util";

/**
 * Configuration for resource group updates
 */
export type ResourceGroupConfig = {
  readonly ignoreOnStatusCountList: readonly string[];
  readonly countUnversioned: boolean;
};

/**
 * Combined data for resource group updates
 */
export type ResourceGroupUpdateData = {
  readonly result: StatusResult;
  readonly config: ResourceGroupConfig;
};

/**
 * Manages VS Code source control resource groups.
 * Extracted from Repository.updateModelState() (lines 463-552).
 *
 * Responsibilities:
 * - Create/dispose resource groups
 * - Update resource states from StatusResult
 * - Manage dynamic changelist groups
 * - Handle group ordering (recreate when needed)
 * - Calculate source control count
 *
 * Does NOT:
 * - Parse SVN status (StatusService concern)
 * - Execute SVN commands (Repository concern)
 * - Emit status events (Repository concern)
 */
export interface IResourceGroupManager {
  /**
   * Update all resource groups from status result
   */
  updateGroups(data: ResourceGroupUpdateData): number;

  /**
   * Find resource by URI across all groups
   */
  getResourceFromFile(uri: string | Uri): Resource | undefined;

  /**
   * Get flat resource map for batch operations (Phase 21.A perf)
   * Returns map of file paths (as strings) to resources
   */
  getResourceMap(): Map<string, Resource>;

  /**
   * Access to static groups
   */
  readonly staged: ISvnResourceGroup;
  readonly changes: ISvnResourceGroup;
  readonly conflicts: ISvnResourceGroup;
  readonly unversioned: ISvnResourceGroup;
  readonly changelists: ReadonlyMap<string, ISvnResourceGroup>;

  /**
   * Remote changes group (may be undefined if not enabled)
   */
  readonly remoteChanges: ISvnResourceGroup | undefined;

  /**
   * Staging service for managing staged files
   */
  readonly staging: StagingService;

  /**
   * Dispose all managed groups
   */
  dispose(): void;
}

/**
 * Implementation of resource group manager
 */
export class ResourceGroupManager implements IResourceGroupManager {
  private _staged: ISvnResourceGroup;
  private _changes: ISvnResourceGroup;
  private _conflicts: ISvnResourceGroup;
  private _unversioned: ISvnResourceGroup;
  private _changelists = new Map<string, ISvnResourceGroup>();
  private _remoteChanges?: ISvnResourceGroup;
  private _disposables: Disposable[] = [];
  private _prevChangelistsSize = 0;
  private _resourceIndex = new Map<string, Resource>(); // Phase 8.1 perf fix - O(1) lookup
  private _resourceHash = ""; // Phase 16 perf fix - conditional rebuild
  private _staging: StagingService;

  get staged(): ISvnResourceGroup {
    return this._staged;
  }

  get changes(): ISvnResourceGroup {
    return this._changes;
  }

  get conflicts(): ISvnResourceGroup {
    return this._conflicts;
  }

  get unversioned(): ISvnResourceGroup {
    return this._unversioned;
  }

  get changelists(): ReadonlyMap<string, ISvnResourceGroup> {
    return this._changelists;
  }

  get remoteChanges(): ISvnResourceGroup | undefined {
    return this._remoteChanges;
  }

  get staging(): StagingService {
    return this._staging;
  }

  /**
   * @param sourceControl VS Code SourceControl instance
   * @param parentDisposables Parent's disposable array to register cleanup
   */
  constructor(
    private readonly sourceControl: SourceControl,
    parentDisposables: Disposable[]
  ) {
    // Create staging service (uses SVN changelist for persistence)
    this._staging = new StagingService();

    // Create static groups (order matters for UI display)
    // Staged appears first
    this._staged = this.createGroup("staged", "Staged for Commit");
    this._staged.hideWhenEmpty = true;

    this._changes = this.createGroup("changes", "Changes");
    this._changes.hideWhenEmpty = true;

    this._conflicts = this.createGroup("conflicts", "Conflicts");
    this._conflicts.hideWhenEmpty = true;

    this._unversioned = this.createGroup("unversioned", "Unversioned");
    this._unversioned.hideWhenEmpty = true;

    // Register with parent for disposal
    this._disposables.push(this._staged, this._changes, this._conflicts);
    this._disposables.push(this._staging);

    // Unversioned can be recreated, use toDisposable wrapper
    this._disposables.push(toDisposable(() => this._unversioned.dispose()));

    // Remote changes can be recreated and may be undefined
    this._disposables.push(
      toDisposable(() => {
        if (this._remoteChanges) {
          this._remoteChanges.dispose();
        }
      })
    );

    // Add to parent disposables for cleanup
    parentDisposables.push(toDisposable(() => this.dispose()));
  }

  /**
   * Update all resource groups from status result.
   * Returns the total count for source control badge.
   */
  updateGroups(data: ResourceGroupUpdateData): number {
    const { result, config } = data;

    // Extract staged files from __staged__ changelist
    const stagedResources = result.changelists.get(STAGING_CHANGELIST) ?? [];

    // Sync staging service cache with SVN changelist data
    this._staging.syncFromChangelist(
      stagedResources.map(r => r.resourceUri.fsPath)
    );

    // Update staged and changes groups
    this._staged.resourceStates = stagedResources;
    this._changes.resourceStates = result.changes;
    this._conflicts.resourceStates = result.conflicts;

    // Clear existing changelist groups
    this._changelists.forEach(group => {
      group.resourceStates = [];
    });

    // Update or create changelist groups (excluding __staged__)
    result.changelists.forEach((resources, changelist) => {
      // Skip staging changelist - handled separately as "Staged for Commit"
      if (changelist === STAGING_CHANGELIST) {
        return;
      }

      let group = this._changelists.get(changelist);
      if (!group) {
        // Prefix 'changelist-' to prevent ID collision with 'changes'
        group = this.createGroup(
          `changelist-${changelist}`,
          `Changelist "${changelist}"`
        );
        group.hideWhenEmpty = true;
        this._disposables.push(group);
        this._changelists.set(changelist, group);
      }

      group.resourceStates = resources;
    });

    // Dispose removed changelists (excluding __staged__ which is never in _changelists)
    const currentChangelists = new Set(
      [...result.changelists.keys()].filter(k => k !== STAGING_CHANGELIST)
    );
    this._changelists.forEach((group, changelist) => {
      if (!currentChangelists.has(changelist)) {
        group.dispose();
        this._changelists.delete(changelist);
      }
    });

    // Recreate unversioned if changelist count changed (for ordering)
    if (this._prevChangelistsSize !== this._changelists.size) {
      this._unversioned.dispose();
      this._unversioned = this.createGroup("unversioned", "Unversioned");
      this._unversioned.hideWhenEmpty = true;
    }

    this._unversioned.resourceStates = result.unversioned;

    // Recreate or create remote changes group (must be last)
    if (
      !this._remoteChanges ||
      this._prevChangelistsSize !== this._changelists.size
    ) {
      const tempResourceStates: Resource[] =
        this._remoteChanges?.resourceStates ?? [];
      this._remoteChanges?.dispose();

      this._remoteChanges = this.createGroup("remotechanges", "Remote Changes");
      this._remoteChanges.hideWhenEmpty = true;
      this._remoteChanges.resourceStates = tempResourceStates;
    }

    // Always update remote changes (clear when empty)
    this._remoteChanges.resourceStates = result.remoteChanges;

    // Update tracked size
    this._prevChangelistsSize = this._changelists.size;

    // Phase 16 perf fix: Only rebuild index if resources changed
    // Calculate hash of current resource state
    const currentHash = this.calculateResourceHash(result);
    if (currentHash !== this._resourceHash) {
      this.rebuildResourceIndex();
      this._resourceHash = currentHash;
    }

    // Calculate count
    return this.calculateCount(config);
  }

  /**
   * Calculate hash of resource state for change detection (Phase 16 perf fix)
   * Used to skip unnecessary index rebuilds when resources haven't changed
   */
  private calculateResourceHash(result: StatusResult): string {
    const changelistSize = result.changelists.size;
    // Build hash from resource counts per group
    // Format: changes-conflicts-unversioned-changelists-remote
    const counts = [
      result.changes.length,
      result.conflicts.length,
      result.unversioned.length,
      changelistSize,
      result.remoteChanges.length
    ];

    // Include changelist names and counts for more precise detection
    const changelistData: string[] = [];
    result.changelists.forEach((resources, name) => {
      changelistData.push(`${name}:${resources.length}`);
    });

    return `${counts.join("-")}|${changelistData.join(",")}`;
  }

  /**
   * Rebuild resource index from all groups (Phase 8.1 perf fix)
   * Called conditionally after updating resource groups (Phase 16 perf fix)
   */
  private rebuildResourceIndex(): void {
    this._resourceIndex.clear();

    const allResources = [
      ...this._staged.resourceStates,
      ...this._changes.resourceStates,
      ...this._conflicts.resourceStates,
      ...this._unversioned.resourceStates
    ];

    // Add changelist resources
    this._changelists.forEach(group => {
      allResources.push(...group.resourceStates);
    });

    // Add remote changes if exists
    if (this._remoteChanges) {
      allResources.push(...this._remoteChanges.resourceStates);
    }

    // Build index
    for (const resource of allResources) {
      if (resource instanceof Resource) {
        const normalizedPath = normalizePath(resource.resourceUri.fsPath);
        this._resourceIndex.set(normalizedPath, resource);
      }
    }
  }

  /**
   * Find resource by URI across all groups
   * Phase 8.1 perf fix - O(1) Map lookup instead of O(n*m) nested loops
   */
  getResourceFromFile(uri: string | Uri): Resource | undefined {
    if (typeof uri === "string") {
      uri = Uri.file(uri);
    }

    const normalizedPath = normalizePath(uri.fsPath);
    return this._resourceIndex.get(normalizedPath);
  }

  /**
   * Get flat resource map for batch operations (Phase 21.A perf)
   * Exposes internal map to avoid repeated URI conversion overhead
   * @returns Map keyed by URI string (use Uri.file(path).toString())
   */
  getResourceMap(): Map<string, Resource> {
    return this._resourceIndex;
  }

  /**
   * Optimistically move resources to staged group without SVN status refresh.
   * Used for instant UI feedback after staging operations.
   * @param paths File paths to move to staged
   * @returns Resources that were moved (for potential rollback)
   */
  moveToStaged(paths: string[]): Resource[] {
    const movedResources: Resource[] = [];
    const pathSet = new Set(paths.map(p => normalizePath(p)));

    // Find and remove from changes group
    const remainingChanges = this._changes.resourceStates.filter(r => {
      if (
        r instanceof Resource &&
        pathSet.has(normalizePath(r.resourceUri.fsPath))
      ) {
        movedResources.push(r);
        return false;
      }
      return true;
    });
    this._changes.resourceStates = remainingChanges;

    // Find and remove from changelist groups
    this._changelists.forEach(group => {
      const remaining = group.resourceStates.filter(r => {
        if (
          r instanceof Resource &&
          pathSet.has(normalizePath(r.resourceUri.fsPath))
        ) {
          if (!movedResources.includes(r)) {
            movedResources.push(r);
          }
          return false;
        }
        return true;
      });
      group.resourceStates = remaining;
    });

    // Add to staged group
    this._staged.resourceStates = [
      ...this._staged.resourceStates,
      ...movedResources
    ];

    // Update staging cache
    this._staging.syncFromChangelist(
      this._staged.resourceStates.map(r => r.resourceUri.fsPath)
    );

    return movedResources;
  }

  /**
   * Optimistically move resources from staged group without SVN status refresh.
   * Used for instant UI feedback after unstaging operations.
   * @param paths File paths to move from staged
   * @param targetChangelist Optional changelist to move to (otherwise goes to changes)
   * @returns Resources that were moved
   */
  moveFromStaged(paths: string[], targetChangelist?: string): Resource[] {
    const movedResources: Resource[] = [];
    const pathSet = new Set(paths.map(p => normalizePath(p)));

    // Find and remove from staged group
    const remainingStaged = this._staged.resourceStates.filter(r => {
      if (
        r instanceof Resource &&
        pathSet.has(normalizePath(r.resourceUri.fsPath))
      ) {
        movedResources.push(r);
        return false;
      }
      return true;
    });
    this._staged.resourceStates = remainingStaged;

    // Add to target group
    if (targetChangelist) {
      let group = this._changelists.get(targetChangelist);
      if (!group) {
        // Create changelist group if it doesn't exist
        group = this.createGroup(
          `changelist-${targetChangelist}`,
          `Changelist "${targetChangelist}"`
        );
        group.hideWhenEmpty = true;
        this._disposables.push(group);
        this._changelists.set(targetChangelist, group);
      }
      group.resourceStates = [...group.resourceStates, ...movedResources];
    } else {
      // Add to changes group
      this._changes.resourceStates = [
        ...this._changes.resourceStates,
        ...movedResources
      ];
    }

    // Update staging cache
    this._staging.syncFromChangelist(
      this._staged.resourceStates.map(r => r.resourceUri.fsPath)
    );

    return movedResources;
  }

  /**
   * Calculate source control count based on configuration
   */
  private calculateCount(config: ResourceGroupConfig): number {
    const counts: ISvnResourceGroup[] = [
      this._staged,
      this._changes,
      this._conflicts
    ];

    // Add changelists not in ignore list
    this._changelists.forEach((group, changelist) => {
      if (!config.ignoreOnStatusCountList.includes(changelist)) {
        counts.push(group);
      }
    });

    // Optionally include unversioned
    if (config.countUnversioned) {
      counts.push(this._unversioned);
    }

    return counts.reduce((sum, group) => sum + group.resourceStates.length, 0);
  }

  /**
   * Create a resource group
   */
  private createGroup(id: string, label: string): ISvnResourceGroup {
    return this.sourceControl.createResourceGroup(
      id,
      label
    ) as ISvnResourceGroup;
  }

  /**
   * Clear all resource states and dispose remote changes
   */
  clearAll(): void {
    this._staged.resourceStates = [];
    this._changes.resourceStates = [];
    this._unversioned.resourceStates = [];
    this._conflicts.resourceStates = [];
    this._changelists.forEach((group, _changelist) => {
      group.resourceStates = [];
    });
    this._remoteChanges?.dispose();
    this._remoteChanges = undefined;
  }

  /**
   * Dispose all managed groups
   */
  dispose(): void {
    this._disposables.forEach(d => d.dispose());
    this._disposables = [];
    this._changelists.clear();
  }
}
