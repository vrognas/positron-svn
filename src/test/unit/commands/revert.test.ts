import * as assert from "assert";
import { Uri } from "vscode";
import { Status } from "../../../common/types";
import { Revert } from "../../../commands/revert";
import { Resource } from "../../../resource";
import * as revertInput from "../../../input/revert";

interface MockState {
  confirmRevertResult: boolean;
  executeRevertCalls: Array<{ uris: Uri[]; depth: string }>;
  getResourceStatesOrExitResult: Resource[] | null;
  confirmRevertCalled: boolean;
  executeRevertCalled: boolean;
  getResourceStatesOrExitCalled: boolean;
  lastExecuteRevertCall?: { uris: Uri[]; depth: string };
}

suite("Revert Command Tests", () => {
  let revert: Revert;
  let mockState: MockState;
  const originalConfirmRevert = revertInput.confirmRevert;

  setup(() => {
    revert = new Revert();
    mockState = {
      confirmRevertResult: true,
      executeRevertCalls: [],
      getResourceStatesOrExitResult: [],
      confirmRevertCalled: false,
      executeRevertCalled: false,
      getResourceStatesOrExitCalled: false
    };

    // Mock revertInput.confirmRevert
    (revertInput as any).confirmRevert = async () => {
      mockState.confirmRevertCalled = true;
      return mockState.confirmRevertResult;
    };

    // Mock Command.executeRevert
    (revert as any).executeRevert = async (uris: Uri[], depth: string) => {
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
    (revertInput as any).confirmRevert = originalConfirmRevert;
  });

  function resetMockCalls() {
    mockState.confirmRevertCalled = false;
    mockState.executeRevertCalled = false;
    mockState.getResourceStatesOrExitCalled = false;
    mockState.executeRevertCalls = [];
    mockState.lastExecuteRevertCall = undefined;
  }

  suite("Single Resource Revert", () => {
    test("should always use infinity depth", async () => {
      const fileUri = Uri.file("/test/file.txt");
      const resource = new Resource(fileUri, Status.MODIFIED);

      resetMockCalls();
      mockState.getResourceStatesOrExitResult = [resource];

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
        mockState.lastExecuteRevertCall.uris[0]!.fsPath,
        fileUri.fsPath
      );
    });
  });

  suite("Multiple Resources Revert", () => {
    test("should revert multiple files with infinity depth", async () => {
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
      assert.strictEqual(mockState.lastExecuteRevertCall.depth, "infinity");
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

  suite("Error Handling - No Resources", () => {
    test("should exit when no resources selected", async () => {
      resetMockCalls();
      mockState.getResourceStatesOrExitResult = null;

      await revert.execute();

      assert.ok(mockState.getResourceStatesOrExitCalled);
      assert.ok(!mockState.confirmRevertCalled);
      assert.ok(!mockState.executeRevertCalled);
    });
  });
});
