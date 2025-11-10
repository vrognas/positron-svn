import { Disposable, SourceControl } from "vscode";
import { ISvnResourceGroup } from "../common/types";
import { Resource } from "../resource";

/**
 * ResourceGroupManager
 *
 * Manages VS Code SourceControl resource groups for SVN status display.
 * Handles creation, disposal, and ordering of groups including:
 * - Basic groups: changes, conflicts, unversioned
 * - Dynamic changelist groups
 * - Remote changes group
 *
 * Extracted from Repository.ts (Phase 2 refactoring)
 */
export class ResourceGroupManager {
  public changes: ISvnResourceGroup;
  public unversioned: ISvnResourceGroup;
  public conflicts: ISvnResourceGroup;
  public remoteChanges?: ISvnResourceGroup;
  public changelists: Map<string, ISvnResourceGroup> = new Map();

  constructor(
    private sourceControl: SourceControl,
    private disposables: Disposable[]
  ) {
    // Create basic resource groups
    this.changes = this.sourceControl.createResourceGroup(
      "changes",
      "Changes"
    ) as ISvnResourceGroup;

    this.conflicts = this.sourceControl.createResourceGroup(
      "conflicts",
      "Conflicts"
    ) as ISvnResourceGroup;

    this.unversioned = this.sourceControl.createResourceGroup(
      "unversioned",
      "Unversioned"
    ) as ISvnResourceGroup;

    // Configure groups
    this.changes.hideWhenEmpty = true;
    this.unversioned.hideWhenEmpty = true;
    this.conflicts.hideWhenEmpty = true;

    // Register for disposal
    this.disposables.push(this.changes);
    this.disposables.push(this.conflicts);
    this.disposables.push(this.unversioned);
  }

  /**
   * Update changelist groups from status result.
   * Creates new groups for changelists that don't exist yet,
   * reuses existing groups, and updates resource states.
   *
   * @param changelists Map of changelist names to resources
   */
  updateChangelists(changelists: Map<string, Resource[]>): void {
    // Clear existing changelist resource states
    this.changelists.forEach((group) => {
      group.resourceStates = [];
    });

    // Update or create changelist groups
    changelists.forEach((resources, changelist) => {
      let group = this.changelists.get(changelist);
      if (!group) {
        // Create new group for this changelist
        // Prefix 'changelist-' to prevent double id with 'change' or 'external'
        group = this.sourceControl.createResourceGroup(
          `changelist-${changelist}`,
          `Changelist "${changelist}"`
        ) as ISvnResourceGroup;
        group.hideWhenEmpty = true;
        this.disposables.push(group);
        this.changelists.set(changelist, group);
      }
      group.resourceStates = resources;
    });
  }

  /**
   * Recreate unversioned group to maintain ordering.
   * VS Code shows groups in creation order, so we recreate
   * the unversioned group after changelists are created to
   * ensure it appears after them in the UI.
   */
  recreateUnversionedGroup(): void {
    const currentStates = this.unversioned.resourceStates;
    this.unversioned.dispose();

    this.unversioned = this.sourceControl.createResourceGroup(
      "unversioned",
      "Unversioned"
    ) as ISvnResourceGroup;

    this.unversioned.hideWhenEmpty = true;
    this.unversioned.resourceStates = currentStates;
  }

  /**
   * Recreate remote changes group to maintain ordering.
   * Ensures remote changes appear last in the UI.
   *
   * @param repository Optional repository reference to attach to group
   */
  recreateRemoteChangesGroup(repository?: unknown): void {
    const tempResourceStates: Resource[] = this.remoteChanges?.resourceStates ?? [];
    this.remoteChanges?.dispose();

    this.remoteChanges = this.sourceControl.createResourceGroup(
      "remotechanges",
      "Remote Changes"
    ) as ISvnResourceGroup;

    if (repository) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.remoteChanges.repository = repository as any;
    }
    this.remoteChanges.hideWhenEmpty = true;
    this.remoteChanges.resourceStates = tempResourceStates;
  }

  /**
   * Clear all resource states.
   * Called when repository state changes.
   */
  clearAll(): void {
    this.changes.resourceStates = [];
    this.unversioned.resourceStates = [];
    this.conflicts.resourceStates = [];
    this.changelists.forEach((group) => {
      group.resourceStates = [];
    });
  }

  /**
   * Get all resource groups for iteration
   */
  getAllGroups(): ISvnResourceGroup[] {
    return [
      this.changes,
      this.conflicts,
      this.unversioned,
      ...this.changelists.values()
    ];
  }

  /**
   * Dispose of remote changes group
   */
  dispose(): void {
    this.remoteChanges?.dispose();
  }
}
