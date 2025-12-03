import * as assert from "assert";
import { SourceControlResourceGroup, Uri } from "vscode";
import { RevertAll } from "../../../commands/revertAll";
import { RevertExplorer } from "../../../commands/revertExplorer";
import { Status } from "../../../common/types";
import { Repository } from "../../../repository";
import { Resource } from "../../../resource";
import * as revertInput from "../../../input/revert";

interface MockState {
  confirmRevertResult: boolean;
  revertCalls: Array<{ paths: string[]; depth: string }>;
  confirmRevertCalled: boolean;
  revertCalled: boolean;
  lastRevertCall?: { paths: string[]; depth: string };
}

suite("RevertAll & RevertExplorer Commands Tests", () => {
  let mockState: MockState;
  let mockRepository: Partial<Repository>;
  const originalConfirmRevert = revertInput.confirmRevert;

  setup(() => {
    mockState = {
      confirmRevertResult: true,
      revertCalls: [],
      confirmRevertCalled: false,
      revertCalled: false
    };

    mockRepository = {
      root: "/test/repo",
      revert: async (paths: string[], depth: string) => {
        mockState.revertCalled = true;
        mockState.lastRevertCall = { paths, depth };
        mockState.revertCalls.push({ paths, depth });
        return "Reverted successfully";
      }
    };

    // Mock revertInput.confirmRevert
    (revertInput as any).confirmRevert = async () => {
      mockState.confirmRevertCalled = true;
      return mockState.confirmRevertResult;
    };
  });

  teardown(() => {
    (revertInput as any).confirmRevert = originalConfirmRevert;
  });

  function resetMockCalls() {
    mockState.confirmRevertCalled = false;
    mockState.revertCalled = false;
    mockState.revertCalls = [];
    mockState.lastRevertCall = undefined;
  }

  function createMockResourceGroup(
    resources: Resource[]
  ): SourceControlResourceGroup {
    return {
      id: "changes",
      label: "Changes",
      hideWhenEmpty: false,
      resourceStates: resources,
      dispose: () => {}
    } as SourceControlResourceGroup;
  }

  suite("RevertAll Command", () => {
    let revertAll: RevertAll;

    setup(() => {
      revertAll = new RevertAll();
    });

    test("always uses infinity depth", async () => {
      const fileUri1 = Uri.file("/test/repo/file1.txt");
      const fileUri2 = Uri.file("/test/repo/file2.txt");
      const resource1 = new Resource(fileUri1, Status.MODIFIED);
      const resource2 = new Resource(fileUri2, Status.MODIFIED);
      const resourceGroup = createMockResourceGroup([resource1, resource2]);

      resetMockCalls();

      (revertAll as any).runByRepository = async (
        _uris: Uri[],
        operation: any
      ) => {
        await operation(mockRepository, [fileUri1, fileUri2]);
      };

      await revertAll.execute(resourceGroup);

      assert.ok(mockState.confirmRevertCalled);
      assert.ok(mockState.revertCalled);
      assert.ok(mockState.lastRevertCall);
      assert.strictEqual(mockState.lastRevertCall.depth, "infinity");
      assert.strictEqual(mockState.lastRevertCall.paths.length, 2);
    });

    test("user cancels confirmation", async () => {
      const fileUri = Uri.file("/test/repo/file.txt");
      const resource = new Resource(fileUri, Status.MODIFIED);
      const resourceGroup = createMockResourceGroup([resource]);

      resetMockCalls();
      mockState.confirmRevertResult = false;

      await revertAll.execute(resourceGroup);

      assert.ok(mockState.confirmRevertCalled);
      assert.ok(!mockState.revertCalled);
    });

    test("empty resource group", async () => {
      const resourceGroup = createMockResourceGroup([]);

      resetMockCalls();

      await revertAll.execute(resourceGroup);

      assert.ok(!mockState.confirmRevertCalled);
      assert.ok(!mockState.revertCalled);
    });

    test("path reversal for revert operation", async () => {
      const fileUri1 = Uri.file("/test/repo/file1.txt");
      const fileUri2 = Uri.file("/test/repo/file2.txt");
      const fileUri3 = Uri.file("/test/repo/file3.txt");
      const resource1 = new Resource(fileUri1, Status.MODIFIED);
      const resource2 = new Resource(fileUri2, Status.MODIFIED);
      const resource3 = new Resource(fileUri3, Status.MODIFIED);
      const resourceGroup = createMockResourceGroup([
        resource1,
        resource2,
        resource3
      ]);

      resetMockCalls();

      (revertAll as any).runByRepository = async (
        _uris: Uri[],
        operation: any
      ) => {
        await operation(mockRepository, [fileUri1, fileUri2, fileUri3]);
      };

      await revertAll.execute(resourceGroup);

      assert.ok(mockState.lastRevertCall);
      // Paths should be reversed
      const paths = mockState.lastRevertCall.paths;
      assert.strictEqual(paths[0], fileUri3.fsPath);
      assert.strictEqual(paths[1], fileUri2.fsPath);
      assert.strictEqual(paths[2], fileUri1.fsPath);
    });
  });

  suite("RevertExplorer Command", () => {
    let revertExplorer: RevertExplorer;

    setup(() => {
      revertExplorer = new RevertExplorer();
    });

    test("always uses infinity depth", async () => {
      const fileUri = Uri.file("/test/repo/file.txt");

      resetMockCalls();

      (revertExplorer as any).executeRevert = async (
        uris: Uri[],
        depth: string
      ) => {
        mockState.revertCalled = true;
        mockState.lastRevertCall = {
          paths: uris.map(u => u.fsPath),
          depth
        };
      };

      await revertExplorer.execute(fileUri, [fileUri]);

      assert.ok(mockState.confirmRevertCalled);
      assert.ok(mockState.revertCalled);
      assert.ok(mockState.lastRevertCall);
      assert.strictEqual(mockState.lastRevertCall.depth, "infinity");
    });

    test("user cancels confirmation", async () => {
      const fileUri = Uri.file("/test/repo/file.txt");

      resetMockCalls();
      mockState.confirmRevertResult = false;

      (revertExplorer as any).executeRevert = async () => {
        mockState.revertCalled = true;
      };

      await revertExplorer.execute(fileUri, [fileUri]);

      assert.ok(mockState.confirmRevertCalled);
      assert.ok(!mockState.revertCalled);
    });

    test("no URIs provided", async () => {
      resetMockCalls();

      (revertExplorer as any).executeRevert = async () => {
        mockState.revertCalled = true;
      };

      await revertExplorer.execute(undefined, undefined);

      assert.ok(!mockState.confirmRevertCalled);
      assert.ok(!mockState.revertCalled);
    });

    test("empty URIs array", async () => {
      resetMockCalls();

      (revertExplorer as any).executeRevert = async () => {
        mockState.revertCalled = true;
      };

      await revertExplorer.execute(undefined, []);

      assert.ok(!mockState.confirmRevertCalled);
      assert.ok(!mockState.revertCalled);
    });
  });
});
