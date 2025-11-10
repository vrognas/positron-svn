import * as assert from "assert";
import { SourceControl, SourceControlResourceGroup, Disposable } from "vscode";
import { Resource } from "../../../resource";
import { Status } from "../../../common/types";
import { StatusResult } from "../../../services/StatusService";

// Mock interfaces for testing
interface MockResourceGroup extends SourceControlResourceGroup {
  resourceStates: Resource[];
}

suite("ResourceGroupManager Tests", () => {
  let mockSourceControl: Partial<SourceControl>;
  let mockGroups: Map<string, MockResourceGroup>;
  let disposables: Disposable[];

  const createMockResource = (path: string, status: Status): Resource => {
    return new Resource(
      { fsPath: `/workspace/${path}`, path } as any,
      status,
      undefined,
      Status.NONE
    );
  };

  setup(() => {
    mockGroups = new Map();
    disposables = [];

    // Mock SourceControl.createResourceGroup
    mockSourceControl = {
      createResourceGroup: (id: string, label: string) => {
        const group: MockResourceGroup = {
          id,
          label,
          resourceStates: [],
          hideWhenEmpty: false,
          dispose: () => {
            mockGroups.delete(id);
          }
        };
        mockGroups.set(id, group);
        return group;
      }
    };
  });

  teardown(() => {
    disposables.forEach(d => d.dispose());
    disposables = [];
    mockGroups.clear();
  });

  test("Group creation - static groups created on construction", () => {
    // Arrange & Act
    const ResourceGroupManager = require("../../../services/ResourceGroupManager").ResourceGroupManager;
    void new ResourceGroupManager(
      mockSourceControl as SourceControl,
      disposables
    );

    // Assert - verify static groups created
    assert.ok(mockGroups.has("changes"), "Changes group created");
    assert.ok(mockGroups.has("conflicts"), "Conflicts group created");
    assert.ok(mockGroups.has("unversioned"), "Unversioned group created");

    assert.strictEqual(mockGroups.get("changes")?.label, "Changes");
    assert.strictEqual(mockGroups.get("conflicts")?.label, "Conflicts");
    assert.strictEqual(mockGroups.get("unversioned")?.label, "Unversioned");

    assert.strictEqual(mockGroups.size, 3, "Only 3 static groups created");
  });

  test("Group updates - updateGroups correctly updates all groups from StatusResult", () => {
    // Arrange
    const ResourceGroupManager = require("../../../services/ResourceGroupManager").ResourceGroupManager;
    const manager = new ResourceGroupManager(
      mockSourceControl as SourceControl,
      disposables
    );

    const statusResult: StatusResult = {
      changes: [
        createMockResource("file1.txt", Status.MODIFIED),
        createMockResource("file2.txt", Status.ADDED)
      ],
      conflicts: [
        createMockResource("file3.txt", Status.CONFLICTED)
      ],
      unversioned: [
        createMockResource("file4.txt", Status.UNVERSIONED)
      ],
      changelists: new Map(),
      remoteChanges: [],
      statusExternal: [],
      statusIgnored: [],
      isIncomplete: false,
      needCleanUp: false
    };

    // Act
    manager.updateGroups(statusResult);

    // Assert - verify groups updated with correct resources
    const changesGroup = mockGroups.get("changes");
    assert.strictEqual(changesGroup?.resourceStates.length, 2, "2 changes");
    assert.strictEqual(
      changesGroup?.resourceStates[0].resourceUri.fsPath,
      "/workspace/file1.txt"
    );
    assert.strictEqual(
      changesGroup?.resourceStates[1].resourceUri.fsPath,
      "/workspace/file2.txt"
    );

    const conflictsGroup = mockGroups.get("conflicts");
    assert.strictEqual(conflictsGroup?.resourceStates.length, 1, "1 conflict");
    assert.strictEqual(
      conflictsGroup?.resourceStates[0].resourceUri.fsPath,
      "/workspace/file3.txt"
    );

    const unversionedGroup = mockGroups.get("unversioned");
    assert.strictEqual(unversionedGroup?.resourceStates.length, 1, "1 unversioned");
    assert.strictEqual(
      unversionedGroup?.resourceStates[0].resourceUri.fsPath,
      "/workspace/file4.txt"
    );
  });

  test("Changelist management - dynamic changelist groups created and disposed", () => {
    // Arrange
    const ResourceGroupManager = require("../../../services/ResourceGroupManager").ResourceGroupManager;
    const manager = new ResourceGroupManager(
      mockSourceControl as SourceControl,
      disposables
    );

    // Act 1 - Create changelists
    const changelists1 = new Map<string, Resource[]>();
    changelists1.set("feature-x", [
      createMockResource("file1.txt", Status.MODIFIED),
      createMockResource("file2.txt", Status.ADDED)
    ]);
    changelists1.set("bugfix-y", [
      createMockResource("file3.txt", Status.MODIFIED)
    ]);

    const result1: StatusResult = {
      changes: [],
      conflicts: [],
      unversioned: [],
      changelists: changelists1,
      remoteChanges: [],
      statusExternal: [],
      statusIgnored: [],
      isIncomplete: false,
      needCleanUp: false
    };

    manager.updateGroups(result1);

    // Assert 1 - verify changelist groups created
    assert.ok(mockGroups.has("changelist-feature-x"), "feature-x group created");
    assert.ok(mockGroups.has("changelist-bugfix-y"), "bugfix-y group created");

    assert.strictEqual(
      mockGroups.get("changelist-feature-x")?.label,
      'Changelist "feature-x"'
    );
    assert.strictEqual(
      mockGroups.get("changelist-feature-x")?.resourceStates.length,
      2,
      "feature-x has 2 files"
    );
    assert.strictEqual(
      mockGroups.get("changelist-bugfix-y")?.resourceStates.length,
      1,
      "bugfix-y has 1 file"
    );

    // Act 2 - Update with removed changelist
    const changelists2 = new Map<string, Resource[]>();
    changelists2.set("feature-x", [
      createMockResource("file1.txt", Status.MODIFIED)
    ]);
    // bugfix-y removed

    const result2: StatusResult = {
      changes: [],
      conflicts: [],
      unversioned: [],
      changelists: changelists2,
      remoteChanges: [],
      statusExternal: [],
      statusIgnored: [],
      isIncomplete: false,
      needCleanUp: false
    };

    manager.updateGroups(result2);

    // Assert 2 - verify bugfix-y disposed, feature-x updated
    assert.ok(mockGroups.has("changelist-feature-x"), "feature-x still exists");
    assert.ok(!mockGroups.has("changelist-bugfix-y"), "bugfix-y disposed");
    assert.strictEqual(
      mockGroups.get("changelist-feature-x")?.resourceStates.length,
      1,
      "feature-x updated to 1 file"
    );
  });
});
