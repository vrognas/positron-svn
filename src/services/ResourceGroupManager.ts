import { Disposable, SourceControl, Uri } from "vscode";
import { ISvnResourceGroup } from "../common/types";
import { Resource } from "../resource";
import { StatusResult } from "./StatusService";
import { toDisposable } from "../util";

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
   * Access to static groups
   */
  readonly changes: ISvnResourceGroup;
  readonly conflicts: ISvnResourceGroup;
  readonly unversioned: ISvnResourceGroup;
  readonly changelists: ReadonlyMap<string, ISvnResourceGroup>;

  /**
   * Remote changes group (may be undefined if not enabled)
   */
  readonly remoteChanges: ISvnResourceGroup | undefined;

  /**
   * Dispose all managed groups
   */
  dispose(): void;
}

/**
 * Implementation of resource group manager
 */
export class ResourceGroupManager implements IResourceGroupManager {
  private _changes: ISvnResourceGroup;
  private _conflicts: ISvnResourceGroup;
  private _unversioned: ISvnResourceGroup;
  private _changelists = new Map<string, ISvnResourceGroup>();
  private _remoteChanges?: ISvnResourceGroup;
  private _disposables: Disposable[] = [];
  private _prevChangelistsSize = 0;
  private _resourceIndex = new Map<string, Resource>(); // Phase 8.1 perf fix - O(1) lookup

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

  /**
   * @param sourceControl VS Code SourceControl instance
   * @param parentDisposables Parent's disposable array to register cleanup
   */
  constructor(
    private readonly sourceControl: SourceControl,
    parentDisposables: Disposable[]
  ) {
    // Create static groups
    this._changes = this.createGroup("changes", "Changes");
    this._changes.hideWhenEmpty = true;

    this._conflicts = this.createGroup("conflicts", "Conflicts");
    this._conflicts.hideWhenEmpty = true;

    this._unversioned = this.createGroup("unversioned", "Unversioned");
    this._unversioned.hideWhenEmpty = true;

    // Register with parent for disposal
    this._disposables.push(this._changes, this._conflicts);

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
    parentDisposables.push(
      toDisposable(() => this.dispose())
    );
  }

  /**
   * Update all resource groups from status result.
   * Returns the total count for source control badge.
   */
  updateGroups(data: ResourceGroupUpdateData): number {
    const { result, config } = data;

    // Update static groups (no spread needed - StatusService returns new arrays)
    this._changes.resourceStates = result.changes;
    this._conflicts.resourceStates = result.conflicts;

    // Clear existing changelist groups
    this._changelists.forEach((group) => {
      group.resourceStates = [];
    });

    // Update or create changelist groups
    result.changelists.forEach((resources, changelist) => {
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

    // Dispose removed changelists
    const currentChangelists = new Set(result.changelists.keys());
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
    if (!this._remoteChanges || this._prevChangelistsSize !== this._changelists.size) {
      const tempResourceStates: Resource[] = this._remoteChanges?.resourceStates ?? [];
      this._remoteChanges?.dispose();

      this._remoteChanges = this.createGroup("remotechanges", "Remote Changes");
      this._remoteChanges.hideWhenEmpty = true;
      this._remoteChanges.resourceStates = tempResourceStates;
    }

    // Always update remote changes (clear when empty)
    this._remoteChanges.resourceStates = result.remoteChanges;

    // Update tracked size
    this._prevChangelistsSize = this._changelists.size;

    // Rebuild resource index for O(1) lookups (Phase 8.1 perf fix)
    this.rebuildResourceIndex();

    // Calculate count
    return this.calculateCount(config);
  }

  /**
   * Rebuild resource index from all groups (Phase 8.1 perf fix)
   * Called after updating resource groups
   */
  private rebuildResourceIndex(): void {
    this._resourceIndex.clear();

    const allResources = [
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
        const uriString = resource.resourceUri.toString();
        this._resourceIndex.set(uriString, resource);
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

    const uriString = uri.toString();
    return this._resourceIndex.get(uriString);
  }

  /**
   * Calculate source control count based on configuration
   */
  private calculateCount(config: ResourceGroupConfig): number {
    const counts: ISvnResourceGroup[] = [this._changes, this._conflicts];

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
