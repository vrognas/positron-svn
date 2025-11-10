import * as assert from "assert";
import { Disposable, SourceControl } from "vscode";
import { ISvnResourceGroup } from "../common/types";
import { Resource } from "../resource";
import { ResourceGroupManager } from "../services/ResourceGroupManager";

/**
 * Mock SourceControl for testing
 */
class MockSourceControl implements Partial<SourceControl> {
  private groups: Map<string, ISvnResourceGroup> = new Map();

  createResourceGroup(id: string, label: string): ISvnResourceGroup {
    const group: ISvnResourceGroup = {
      id,
      label,
      hideWhenEmpty: false,
      resourceStates: [],
      dispose: () => {
        this.groups.delete(id);
      }
    };
    this.groups.set(id, group);
    return group;
  }

  getGroups(): ISvnResourceGroup[] {
    return Array.from(this.groups.values());
  }

  getGroup(id: string): ISvnResourceGroup | undefined {
    return this.groups.get(id);
  }

  hasGroup(id: string): boolean {
    return this.groups.has(id);
  }
}

suite("ResourceGroupManager Tests", () => {
  let mockSourceControl: MockSourceControl;
  let disposables: Disposable[];
  let manager: ResourceGroupManager;

  setup(() => {
    mockSourceControl = new MockSourceControl();
    disposables = [];
    manager = new ResourceGroupManager(
      mockSourceControl as any,
      disposables
    );
  });

  teardown(() => {
    manager.dispose();
    disposables.forEach(d => d.dispose());
  });

  test("Creates basic resource groups on initialization", () => {
    assert.ok(manager.changes, "Changes group should exist");
    assert.ok(manager.conflicts, "Conflicts group should exist");
    assert.ok(manager.unversioned, "Unversioned group should exist");
    assert.equal(manager.changes.id, "changes");
    assert.equal(manager.conflicts.id, "conflicts");
    assert.equal(manager.unversioned.id, "unversioned");
    assert.equal(manager.changes.hideWhenEmpty, true);
    assert.equal(manager.conflicts.hideWhenEmpty, true);
    assert.equal(manager.unversioned.hideWhenEmpty, true);
  });

  test("Updates changelist groups correctly", () => {
    const changelists = new Map<string, Resource[]>();
    const mockResources: Resource[] = [];

    changelists.set("feature-1", mockResources);
    changelists.set("bugfix-1", mockResources);

    manager.updateChangelists(changelists);

    assert.equal(manager.changelists.size, 2);
    assert.ok(manager.changelists.has("feature-1"));
    assert.ok(manager.changelists.has("bugfix-1"));

    const featureGroup = manager.changelists.get("feature-1");
    assert.ok(featureGroup);
    assert.equal(featureGroup.id, "changelist-feature-1");
    assert.equal(featureGroup.label, 'Changelist "feature-1"');
    assert.equal(featureGroup.hideWhenEmpty, true);
  });

  test("Reuses existing changelist groups", () => {
    const changelists = new Map<string, Resource[]>();
    changelists.set("feature-1", []);

    manager.updateChangelists(changelists);
    const firstGroup = manager.changelists.get("feature-1");

    // Update again with same changelist
    manager.updateChangelists(changelists);
    const secondGroup = manager.changelists.get("feature-1");

    assert.strictEqual(firstGroup, secondGroup, "Should reuse same group instance");
  });

  test("Clears resource states when updating changelists", () => {
    const changelists1 = new Map<string, Resource[]>();
    changelists1.set("feature-1", [{} as Resource]);

    manager.updateChangelists(changelists1);
    const group = manager.changelists.get("feature-1")!;
    assert.equal(group.resourceStates.length, 1);

    // Update with empty resources
    const changelists2 = new Map<string, Resource[]>();
    changelists2.set("feature-1", []);

    manager.updateChangelists(changelists2);
    assert.equal(group.resourceStates.length, 0);
  });

  test("Recreates unversioned group maintaining state", () => {
    const mockStates: Resource[] = [{} as Resource, {} as Resource];
    manager.unversioned.resourceStates = mockStates;

    const oldGroup = manager.unversioned;
    manager.recreateUnversionedGroup();

    assert.notStrictEqual(manager.unversioned, oldGroup, "Should be new instance");
    assert.equal(manager.unversioned.resourceStates.length, 2);
    assert.equal(manager.unversioned.id, "unversioned");
    assert.equal(manager.unversioned.hideWhenEmpty, true);
  });

  test("Recreates remote changes group maintaining state", () => {
    manager.recreateRemoteChangesGroup();
    assert.ok(manager.remoteChanges);

    const mockStates: Resource[] = [{} as Resource];
    manager.remoteChanges.resourceStates = mockStates;

    const oldGroup = manager.remoteChanges;
    manager.recreateRemoteChangesGroup();

    assert.notStrictEqual(manager.remoteChanges, oldGroup, "Should be new instance");
    assert.equal(manager.remoteChanges.resourceStates.length, 1);
    assert.equal(manager.remoteChanges.id, "remotechanges");
    assert.equal(manager.remoteChanges.hideWhenEmpty, true);
  });

  test("Clears all resource states", () => {
    // Setup some states
    manager.changes.resourceStates = [{} as Resource];
    manager.conflicts.resourceStates = [{} as Resource];
    manager.unversioned.resourceStates = [{} as Resource];

    const changelists = new Map<string, Resource[]>();
    changelists.set("feature-1", [{} as Resource]);
    manager.updateChangelists(changelists);

    // Clear all
    manager.clearAll();

    assert.equal(manager.changes.resourceStates.length, 0);
    assert.equal(manager.conflicts.resourceStates.length, 0);
    assert.equal(manager.unversioned.resourceStates.length, 0);
    manager.changelists.forEach(group => {
      assert.equal(group.resourceStates.length, 0);
    });
  });

  test("Disposes remote changes group", () => {
    manager.recreateRemoteChangesGroup();
    assert.ok(manager.remoteChanges);
    assert.ok(mockSourceControl.hasGroup("remotechanges"));

    manager.dispose();

    assert.ok(!mockSourceControl.hasGroup("remotechanges"));
  });
});
