import * as assert from "assert";
import { Uri } from "vscode";
import { Status, SvnDepth } from "../../../common/types";
import { Revert } from "../../../commands/revert";
import { Resource } from "../../../resource";
import * as revertInput from "../../../input/revert";

interface MockState {
  confirmRevertResult: boolean;
  checkAndPromptDepthResult: keyof typeof SvnDepth | undefined;
  executeRevertCalls: Array<{ uris: Uri[]; depth: keyof typeof SvnDepth }>;
  getResourceStatesOrExitResult: Resource[] | null;
  confirmRevertCalled: boolean;
  checkAndPromptDepthCalled: boolean;
  executeRevertCalled: boolean;
  getResourceStatesOrExitCalled: boolean;
  lastExecuteRevertCall?: { uris: Uri[]; depth: keyof typeof SvnDepth };
}

suite("Revert Command Tests", () => {
  let revert: Revert;
  let mockState: MockState;
  const originalConfirmRevert = revertInput.confirmRevert;
  const originalCheckAndPromptDepth = revertInput.checkAndPromptDepth;

  setup(() => {
    revert = new Revert();
    mockState = {
      confirmRevertResult: true,
      checkAndPromptDepthResult: "empty",
      executeRevertCalls: [],
      getResourceStatesOrExitResult: [],
      confirmRevertCalled: false,
      checkAndPromptDepthCalled: false,
      executeRevertCalled: false,
      getResourceStatesOrExitCalled: false
    };

    // Mock revertInput functions
    (revertInput as any).confirmRevert = async () => {
      mockState.confirmRevertCalled = true;
      return mockState.confirmRevertResult;
    };

    (revertInput as any).checkAndPromptDepth = async () => {
      mockState.checkAndPromptDepthCalled = true;
      return mockState.checkAndPromptDepthResult;
    };

    // Mock Command.executeRevert
    (revert as any).executeRevert = async (
      uris: Uri[],
      depth: keyof typeof SvnDepth
    ) => {
      mockState.executeRevertCalled = true;
      mockState.lastExecuteRevertCall = { uris, depth };
      mockState.executeRevertCalls.push({ uris, depth });
    };

    // Mock Command.getResourceStatesOrExit
    (revert as any).getResourceStatesOrExit = async () => {
      mockState.getResourceStatesOrExitCalled = true;
      return mockState.getResourceStatesOrExitResult;
    };
  });

  teardown(() => {
    // Restore original functions
    (revertInput as any).confirmRevert = originalConfirmRevert;
    (revertInput as any).checkAndPromptDepth = originalCheckAndPromptDepth;
  });

  function resetMockCalls() {
    mockState.confirmRevertCalled = false;
    mockState.checkAndPromptDepthCalled = false;
    mockState.executeRevertCalled = false;
    mockState.getResourceStatesOrExitCalled = false;
    mockState.executeRevertCalls = [];
    mockState.lastExecuteRevertCall = undefined;
  }

  suite("Single Resource Revert", () => {
    test("should revert single file with empty depth", async () => {
      const fileUri = Uri.file("/test/file.txt");
      const resource = new Resource(fileUri, Status.MODIFIED);

      resetMockCalls();
      mockState.getResourceStatesOrExitResult = [resource];
      mockState.checkAndPromptDepthResult = "empty";

      await revert.execute(resource);

      assert.ok(mockState.getResourceStatesOrExitCalled);
      assert.ok(mockState.confirmRevertCalled);
      assert.ok(mockState.checkAndPromptDepthCalled);
      assert.ok(mockState.executeRevertCalled);
      assert.ok(mockState.lastExecuteRevertCall);
      assert.strictEqual(mockState.lastExecuteRevertCall.uris.length, 1);
      assert.strictEqual(
        mockState.lastExecuteRevertCall.uris[0].fsPath,
        fileUri.fsPath
      );
      assert.strictEqual(mockState.lastExecuteRevertCall.depth, "empty");
    });

    test("should revert single file with files depth", async () => {
      const fileUri = Uri.file("/test/file.txt");
      const resource = new Resource(fileUri, Status.MODIFIED);

      resetMockCalls();
      mockState.getResourceStatesOrExitResult = [resource];
      mockState.checkAndPromptDepthResult = "files";

      await revert.execute(resource);

      assert.ok(mockState.executeRevertCalled);
      assert.ok(mockState.lastExecuteRevertCall);
      assert.strictEqual(mockState.lastExecuteRevertCall.depth, "files");
    });

    test("should revert single file with infinity depth", async () => {
      const fileUri = Uri.file("/test/file.txt");
      const resource = new Resource(fileUri, Status.MODIFIED);

      resetMockCalls();
      mockState.getResourceStatesOrExitResult = [resource];
      mockState.checkAndPromptDepthResult = "infinity";

      await revert.execute(resource);

      assert.ok(mockState.executeRevertCalled);
      assert.ok(mockState.lastExecuteRevertCall);
      assert.strictEqual(mockState.lastExecuteRevertCall.depth, "infinity");
    });

    test("should revert single modified file", async () => {
      const fileUri = Uri.file("/test/modified.txt");
      const resource = new Resource(fileUri, Status.MODIFIED);

      resetMockCalls();
      mockState.getResourceStatesOrExitResult = [resource];

      await revert.execute(resource);

      assert.ok(mockState.executeRevertCalled);
      assert.ok(mockState.lastExecuteRevertCall);
      assert.strictEqual(
        mockState.lastExecuteRevertCall.uris[0].fsPath,
        fileUri.fsPath
      );
    });

    test("should revert single deleted file", async () => {
      const fileUri = Uri.file("/test/deleted.txt");
      const resource = new Resource(fileUri, Status.DELETED);

      resetMockCalls();
      mockState.getResourceStatesOrExitResult = [resource];

      await revert.execute(resource);

      assert.ok(mockState.executeRevertCalled);
      assert.ok(mockState.lastExecuteRevertCall);
      assert.strictEqual(
        mockState.lastExecuteRevertCall.uris[0].fsPath,
        fileUri.fsPath
      );
    });

    test("should revert single added file", async () => {
      const fileUri = Uri.file("/test/new.txt");
      const resource = new Resource(fileUri, Status.ADDED);

      resetMockCalls();
      mockState.getResourceStatesOrExitResult = [resource];

      await revert.execute(resource);

      assert.ok(mockState.executeRevertCalled);
      assert.ok(mockState.lastExecuteRevertCall);
      assert.strictEqual(
        mockState.lastExecuteRevertCall.uris[0].fsPath,
        fileUri.fsPath
      );
    });

    test("should revert single conflicted file", async () => {
      const fileUri = Uri.file("/test/conflict.txt");
      const resource = new Resource(fileUri, Status.CONFLICTED);

      resetMockCalls();
      mockState.getResourceStatesOrExitResult = [resource];

      await revert.execute(resource);

      assert.ok(mockState.executeRevertCalled);
      assert.ok(mockState.lastExecuteRevertCall);
      assert.strictEqual(
        mockState.lastExecuteRevertCall.uris[0].fsPath,
        fileUri.fsPath
      );
    });
  });

  suite("Multiple Resources Revert", () => {
    test("should revert multiple files", async () => {
      const fileUri1 = Uri.file("/test/file1.txt");
      const fileUri2 = Uri.file("/test/file2.txt");
      const resource1 = new Resource(fileUri1, Status.MODIFIED);
      const resource2 = new Resource(fileUri2, Status.MODIFIED);

      resetMockCalls();
      mockState.getResourceStatesOrExitResult = [resource1, resource2];

      await revert.execute(resource1, resource2);

      assert.ok(mockState.executeRevertCalled);
      assert.ok(mockState.lastExecuteRevertCall);
      assert.strictEqual(mockState.lastExecuteRevertCall.uris.length, 2);
      assert.strictEqual(
        mockState.lastExecuteRevertCall.uris[0].fsPath,
        fileUri1.fsPath
      );
      assert.strictEqual(
        mockState.lastExecuteRevertCall.uris[1].fsPath,
        fileUri2.fsPath
      );
    });

    test("should revert three or more files", async () => {
      const fileUri1 = Uri.file("/test/file1.txt");
      const fileUri2 = Uri.file("/test/file2.txt");
      const fileUri3 = Uri.file("/test/file3.txt");
      const resource1 = new Resource(fileUri1, Status.MODIFIED);
      const resource2 = new Resource(fileUri2, Status.ADDED);
      const resource3 = new Resource(fileUri3, Status.DELETED);

      resetMockCalls();
      mockState.getResourceStatesOrExitResult = [resource1, resource2, resource3];

      await revert.execute(resource1, resource2, resource3);

      assert.ok(mockState.executeRevertCalled);
      assert.ok(mockState.lastExecuteRevertCall);
      assert.strictEqual(mockState.lastExecuteRevertCall.uris.length, 3);
      assert.strictEqual(
        mockState.lastExecuteRevertCall.uris[0].fsPath,
        fileUri1.fsPath
      );
      assert.strictEqual(
        mockState.lastExecuteRevertCall.uris[1].fsPath,
        fileUri2.fsPath
      );
      assert.strictEqual(
        mockState.lastExecuteRevertCall.uris[2].fsPath,
        fileUri3.fsPath
      );
    });

    test("should revert multiple files with different statuses", async () => {
      const fileUri1 = Uri.file("/test/modified.txt");
      const fileUri2 = Uri.file("/test/added.txt");
      const fileUri3 = Uri.file("/test/deleted.txt");
      const resource1 = new Resource(fileUri1, Status.MODIFIED);
      const resource2 = new Resource(fileUri2, Status.ADDED);
      const resource3 = new Resource(fileUri3, Status.DELETED);

      resetMockCalls();
      mockState.getResourceStatesOrExitResult = [resource1, resource2, resource3];

      await revert.execute(resource1, resource2, resource3);

      assert.ok(mockState.executeRevertCalled);
      assert.ok(mockState.lastExecuteRevertCall);
      assert.strictEqual(mockState.lastExecuteRevertCall.uris.length, 3);
    });
  });

  suite("Depth Selection", () => {
    test("should use empty depth when no directories in selection", async () => {
      const fileUri = Uri.file("/test/file.txt");
      const resource = new Resource(fileUri, Status.MODIFIED);

      resetMockCalls();
      mockState.getResourceStatesOrExitResult = [resource];
      mockState.checkAndPromptDepthResult = "empty";

      await revert.execute(resource);

      assert.ok(mockState.checkAndPromptDepthCalled);
    });

    test("should prompt for depth when directory in selection", async () => {
      const dirUri = Uri.file("/test/directory");
      const resource = new Resource(dirUri, Status.MODIFIED);

      resetMockCalls();
      mockState.getResourceStatesOrExitResult = [resource];
      mockState.checkAndPromptDepthResult = "files";

      await revert.execute(resource);

      assert.ok(mockState.checkAndPromptDepthCalled);
    });

    test("should accept immediate depth selection", async () => {
      const fileUri = Uri.file("/test/file.txt");
      const resource = new Resource(fileUri, Status.MODIFIED);

      resetMockCalls();
      mockState.getResourceStatesOrExitResult = [resource];
      mockState.checkAndPromptDepthResult = "immediates";

      await revert.execute(resource);

      assert.ok(mockState.executeRevertCalled);
      assert.ok(mockState.lastExecuteRevertCall);
      assert.strictEqual(mockState.lastExecuteRevertCall.depth, "immediates");
    });

    test("should handle all depth values", async () => {
      const fileUri = Uri.file("/test/file.txt");
      const resource = new Resource(fileUri, Status.MODIFIED);
      const depths: Array<keyof typeof SvnDepth> = [
        "empty",
        "files",
        "immediates",
        "infinity"
      ];

      for (const depth of depths) {
        resetMockCalls();
        mockState.getResourceStatesOrExitResult = [resource];
        mockState.checkAndPromptDepthResult = depth;

        await revert.execute(resource);

        assert.ok(mockState.executeRevertCalled);
        assert.ok(mockState.lastExecuteRevertCall);
        assert.strictEqual(mockState.lastExecuteRevertCall.depth, depth);
      }
    });
  });

  suite("User Confirmation", () => {
    test("should not revert when user cancels confirmation", async () => {
      const fileUri = Uri.file("/test/file.txt");
      const resource = new Resource(fileUri, Status.MODIFIED);

      resetMockCalls();
      mockState.getResourceStatesOrExitResult = [resource];
      mockState.confirmRevertResult = false;

      await revert.execute(resource);

      assert.ok(mockState.confirmRevertCalled);
      assert.ok(!mockState.checkAndPromptDepthCalled);
      assert.ok(!mockState.executeRevertCalled);
    });

    test("should not revert when confirmation returns false", async () => {
      const fileUri = Uri.file("/test/file.txt");
      const resource = new Resource(fileUri, Status.MODIFIED);

      resetMockCalls();
      mockState.getResourceStatesOrExitResult = [resource];
      mockState.confirmRevertResult = false;

      await revert.execute(resource);

      assert.ok(!mockState.executeRevertCalled);
    });

    test("should proceed when user confirms", async () => {
      const fileUri = Uri.file("/test/file.txt");
      const resource = new Resource(fileUri, Status.MODIFIED);

      resetMockCalls();
      mockState.getResourceStatesOrExitResult = [resource];
      mockState.confirmRevertResult = true;

      await revert.execute(resource);

      assert.ok(mockState.executeRevertCalled);
    });
  });

  suite("Depth Cancellation", () => {
    test("should not revert when user cancels depth selection", async () => {
      const fileUri = Uri.file("/test/file.txt");
      const resource = new Resource(fileUri, Status.MODIFIED);

      resetMockCalls();
      mockState.getResourceStatesOrExitResult = [resource];
      mockState.confirmRevertResult = true;
      mockState.checkAndPromptDepthResult = undefined;

      await revert.execute(resource);

      assert.ok(mockState.confirmRevertCalled);
      assert.ok(mockState.checkAndPromptDepthCalled);
      assert.ok(!mockState.executeRevertCalled);
    });

    test("should handle undefined depth gracefully", async () => {
      const fileUri = Uri.file("/test/file.txt");
      const resource = new Resource(fileUri, Status.MODIFIED);

      resetMockCalls();
      mockState.getResourceStatesOrExitResult = [resource];
      mockState.checkAndPromptDepthResult = undefined;

      await revert.execute(resource);

      assert.ok(!mockState.executeRevertCalled);
    });
  });

  suite("Error Handling - No Resources", () => {
    test("should exit when no resources selected", async () => {
      resetMockCalls();
      mockState.getResourceStatesOrExitResult = null;

      await revert.execute();

      assert.ok(mockState.getResourceStatesOrExitCalled);
      assert.ok(!mockState.confirmRevertCalled);
      assert.ok(!mockState.checkAndPromptDepthCalled);
      assert.ok(!mockState.executeRevertCalled);
    });

    test("should exit when no resources in empty array", async () => {
      resetMockCalls();
      mockState.getResourceStatesOrExitResult = null;

      await revert.execute();

      assert.ok(!mockState.executeRevertCalled);
    });

    test("should handle no resource states gracefully", async () => {
      resetMockCalls();
      mockState.getResourceStatesOrExitResult = null;

      await revert.execute();

      assert.ok(mockState.getResourceStatesOrExitCalled);
    });
  });

  suite("Mixed Resources", () => {
    test("should revert mixed files and directories", async () => {
      const fileUri = Uri.file("/test/file.txt");
      const dirUri = Uri.file("/test/directory");
      const fileResource = new Resource(fileUri, Status.MODIFIED);
      const dirResource = new Resource(dirUri, Status.MODIFIED);

      resetMockCalls();
      mockState.getResourceStatesOrExitResult = [fileResource, dirResource];
      mockState.checkAndPromptDepthResult = "files";

      await revert.execute(fileResource, dirResource);

      assert.ok(mockState.executeRevertCalled);
      assert.ok(mockState.lastExecuteRevertCall);
      assert.strictEqual(mockState.lastExecuteRevertCall.uris.length, 2);
      assert.strictEqual(mockState.lastExecuteRevertCall.depth, "files");
    });

    test("should map URIs correctly for mixed resources", async () => {
      const fileUri1 = Uri.file("/test/file1.txt");
      const fileUri2 = Uri.file("/test/file2.txt");
      const dirUri = Uri.file("/test/directory");
      const resource1 = new Resource(fileUri1, Status.MODIFIED);
      const resource2 = new Resource(fileUri2, Status.ADDED);
      const dirResource = new Resource(dirUri, Status.MODIFIED);

      resetMockCalls();
      mockState.getResourceStatesOrExitResult = [resource1, resource2, dirResource];
      mockState.checkAndPromptDepthResult = "infinity";

      await revert.execute(resource1, resource2, dirResource);

      assert.ok(mockState.executeRevertCalled);
      assert.ok(mockState.lastExecuteRevertCall);
      assert.strictEqual(mockState.lastExecuteRevertCall.uris.length, 3);
      assert.strictEqual(
        mockState.lastExecuteRevertCall.uris[0].fsPath,
        fileUri1.fsPath
      );
      assert.strictEqual(
        mockState.lastExecuteRevertCall.uris[1].fsPath,
        fileUri2.fsPath
      );
      assert.strictEqual(
        mockState.lastExecuteRevertCall.uris[2].fsPath,
        dirUri.fsPath
      );
    });
  });

  suite("Directory Revert", () => {
    test("should revert directory with empty depth", async () => {
      const dirUri = Uri.file("/test/directory");
      const resource = new Resource(dirUri, Status.MODIFIED);

      resetMockCalls();
      mockState.getResourceStatesOrExitResult = [resource];
      mockState.checkAndPromptDepthResult = "empty";

      await revert.execute(resource);

      assert.ok(mockState.executeRevertCalled);
      assert.ok(mockState.lastExecuteRevertCall);
      assert.strictEqual(
        mockState.lastExecuteRevertCall.uris[0].fsPath,
        dirUri.fsPath
      );
      assert.strictEqual(mockState.lastExecuteRevertCall.depth, "empty");
    });

    test("should revert directory with files depth", async () => {
      const dirUri = Uri.file("/test/directory");
      const resource = new Resource(dirUri, Status.MODIFIED);

      resetMockCalls();
      mockState.getResourceStatesOrExitResult = [resource];
      mockState.checkAndPromptDepthResult = "files";

      await revert.execute(resource);

      assert.ok(mockState.lastExecuteRevertCall);
      assert.strictEqual(mockState.lastExecuteRevertCall.depth, "files");
    });

    test("should revert directory with infinity depth", async () => {
      const dirUri = Uri.file("/test/directory");
      const resource = new Resource(dirUri, Status.MODIFIED);

      resetMockCalls();
      mockState.getResourceStatesOrExitResult = [resource];
      mockState.checkAndPromptDepthResult = "infinity";

      await revert.execute(resource);

      assert.ok(mockState.lastExecuteRevertCall);
      assert.strictEqual(mockState.lastExecuteRevertCall.depth, "infinity");
    });

    test("should revert nested directory structure", async () => {
      const dirUri = Uri.file("/test/directory/nested");
      const resource = new Resource(dirUri, Status.MODIFIED);

      resetMockCalls();
      mockState.getResourceStatesOrExitResult = [resource];
      mockState.checkAndPromptDepthResult = "infinity";

      await revert.execute(resource);

      assert.ok(mockState.executeRevertCalled);
      assert.ok(mockState.lastExecuteRevertCall);
      assert.strictEqual(
        mockState.lastExecuteRevertCall.uris[0].fsPath,
        dirUri.fsPath
      );
    });
  });

  suite("Resource Status Variations", () => {
    test("should revert replaced file", async () => {
      const fileUri = Uri.file("/test/replaced.txt");
      const resource = new Resource(fileUri, Status.REPLACED);

      resetMockCalls();
      mockState.getResourceStatesOrExitResult = [resource];

      await revert.execute(resource);

      assert.ok(mockState.executeRevertCalled);
    });

    test("should revert missing file", async () => {
      const fileUri = Uri.file("/test/missing.txt");
      const resource = new Resource(fileUri, Status.MISSING);

      resetMockCalls();
      mockState.getResourceStatesOrExitResult = [resource];

      await revert.execute(resource);

      assert.ok(mockState.executeRevertCalled);
    });

    test("should revert ignored file", async () => {
      const fileUri = Uri.file("/test/ignored.txt");
      const resource = new Resource(fileUri, Status.IGNORED);

      resetMockCalls();
      mockState.getResourceStatesOrExitResult = [resource];

      await revert.execute(resource);

      assert.ok(mockState.executeRevertCalled);
    });

    test("should revert unversioned file", async () => {
      const fileUri = Uri.file("/test/unversioned.txt");
      const resource = new Resource(fileUri, Status.UNVERSIONED);

      resetMockCalls();
      mockState.getResourceStatesOrExitResult = [resource];

      await revert.execute(resource);

      assert.ok(mockState.executeRevertCalled);
    });
  });

  suite("URI Mapping", () => {
    test("should map resource URI correctly", async () => {
      const fileUri = Uri.file("/test/file.txt");
      const resource = new Resource(fileUri, Status.MODIFIED);

      resetMockCalls();
      mockState.getResourceStatesOrExitResult = [resource];

      await revert.execute(resource);

      assert.ok(mockState.lastExecuteRevertCall);
      assert.strictEqual(
        mockState.lastExecuteRevertCall.uris[0].fsPath,
        fileUri.fsPath
      );
    });

    test("should preserve URI scheme in mapped URIs", async () => {
      const fileUri = Uri.file("/test/file.txt");
      const resource = new Resource(fileUri, Status.MODIFIED);

      resetMockCalls();
      mockState.getResourceStatesOrExitResult = [resource];

      await revert.execute(resource);

      assert.ok(mockState.lastExecuteRevertCall);
      assert.strictEqual(mockState.lastExecuteRevertCall.uris[0].scheme, "file");
    });

    test("should maintain URI order in mapped URIs", async () => {
      const fileUri1 = Uri.file("/test/file1.txt");
      const fileUri2 = Uri.file("/test/file2.txt");
      const fileUri3 = Uri.file("/test/file3.txt");
      const resource1 = new Resource(fileUri1, Status.MODIFIED);
      const resource2 = new Resource(fileUri2, Status.ADDED);
      const resource3 = new Resource(fileUri3, Status.DELETED);

      resetMockCalls();
      mockState.getResourceStatesOrExitResult = [resource1, resource2, resource3];

      await revert.execute(resource1, resource2, resource3);

      assert.ok(mockState.lastExecuteRevertCall);
      const uris = mockState.lastExecuteRevertCall.uris;
      assert.strictEqual(uris[0].fsPath, fileUri1.fsPath);
      assert.strictEqual(uris[1].fsPath, fileUri2.fsPath);
      assert.strictEqual(uris[2].fsPath, fileUri3.fsPath);
    });
  });
});
