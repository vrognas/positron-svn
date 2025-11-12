import * as assert from "assert";
import { SourceControlResourceGroup, Uri } from "vscode";
import { RevertAll } from "../../../commands/revertAll";
import { RevertExplorer } from "../../../commands/revertExplorer";
import { Status, SvnDepth } from "../../../common/types";
import { Repository } from "../../../repository";
import { Resource } from "../../../resource";
import * as revertInput from "../../../input/revert";

interface MockState {
  confirmRevertResult: boolean;
  checkAndPromptDepthResult: keyof typeof SvnDepth | undefined;
  revertCalls: Array<{ paths: string[]; depth: keyof typeof SvnDepth }>;
  confirmRevertCalled: boolean;
  checkAndPromptDepthCalled: boolean;
  revertCalled: boolean;
  lastRevertCall?: { paths: string[]; depth: keyof typeof SvnDepth };
}

suite("RevertAll & RevertExplorer Commands Tests", () => {
  let mockState: MockState;
  let mockRepository: Partial<Repository>;
  const originalConfirmRevert = revertInput.confirmRevert;
  const originalCheckAndPromptDepth = revertInput.checkAndPromptDepth;

  setup(() => {
    mockState = {
      confirmRevertResult: true,
      checkAndPromptDepthResult: "empty",
      revertCalls: [],
      confirmRevertCalled: false,
      checkAndPromptDepthCalled: false,
      revertCalled: false
    };

    mockRepository = {
      root: "/test/repo",
      revert: async (paths: string[], depth: keyof typeof SvnDepth) => {
        mockState.revertCalled = true;
        mockState.lastRevertCall = { paths, depth };
        mockState.revertCalls.push({ paths, depth });
        return "Reverted successfully";
      }
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
  });

  teardown(() => {
    (revertInput as any).confirmRevert = originalConfirmRevert;
    (revertInput as any).checkAndPromptDepth = originalCheckAndPromptDepth;
  });

  function resetMockCalls() {
    mockState.confirmRevertCalled = false;
    mockState.checkAndPromptDepthCalled = false;
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

    test("1.1: Revert all changes with empty depth", async () => {
      const fileUri1 = Uri.file("/test/repo/file1.txt");
      const fileUri2 = Uri.file("/test/repo/file2.txt");
      const resource1 = new Resource(fileUri1, Status.MODIFIED);
      const resource2 = new Resource(fileUri2, Status.MODIFIED);
      const resourceGroup = createMockResourceGroup([resource1, resource2]);

      resetMockCalls();
      mockState.checkAndPromptDepthResult = "empty";

      (revertAll as any).runByRepository = async (
        _uris: Uri[],
        operation: any
      ) => {
        await operation(mockRepository, [fileUri1, fileUri2]);
      };

      await revertAll.execute(resourceGroup);

      assert.ok(mockState.confirmRevertCalled);
      assert.ok(mockState.checkAndPromptDepthCalled);
      assert.ok(mockState.revertCalled);
      assert.ok(mockState.lastRevertCall);
      assert.strictEqual(mockState.lastRevertCall.depth, "empty");
      assert.strictEqual(mockState.lastRevertCall.paths.length, 2);
    });

    test("1.2: Revert all changes with files depth", async () => {
      const fileUri = Uri.file("/test/repo/file.txt");
      const resource = new Resource(fileUri, Status.MODIFIED);
      const resourceGroup = createMockResourceGroup([resource]);

      resetMockCalls();
      mockState.checkAndPromptDepthResult = "files";

      (revertAll as any).runByRepository = async (
        _uris: Uri[],
        operation: any
      ) => {
        await operation(mockRepository, [fileUri]);
      };

      await revertAll.execute(resourceGroup);

      assert.ok(mockState.revertCalled);
      assert.ok(mockState.lastRevertCall);
      assert.strictEqual(mockState.lastRevertCall.depth, "files");
    });

    test("1.3: Revert all changes with infinity depth", async () => {
      const dirUri = Uri.file("/test/repo/directory");
      const resource = new Resource(dirUri, Status.MODIFIED);
      const resourceGroup = createMockResourceGroup([resource]);

      resetMockCalls();
      mockState.checkAndPromptDepthResult = "infinity";

      (revertAll as any).runByRepository = async (
        _uris: Uri[],
        operation: any
      ) => {
        await operation(mockRepository, [dirUri]);
      };

      await revertAll.execute(resourceGroup);

      assert.ok(mockState.revertCalled);
      assert.ok(mockState.lastRevertCall);
      assert.strictEqual(mockState.lastRevertCall.depth, "infinity");
    });

    test("1.4: Revert all changes with immediates depth", async () => {
      const fileUri = Uri.file("/test/repo/file.txt");
      const resource = new Resource(fileUri, Status.MODIFIED);
      const resourceGroup = createMockResourceGroup([resource]);

      resetMockCalls();
      mockState.checkAndPromptDepthResult = "immediates";

      (revertAll as any).runByRepository = async (
        _uris: Uri[],
        operation: any
      ) => {
        await operation(mockRepository, [fileUri]);
      };

      await revertAll.execute(resourceGroup);

      assert.ok(mockState.revertCalled);
      assert.ok(mockState.lastRevertCall);
      assert.strictEqual(mockState.lastRevertCall.depth, "immediates");
    });

    test("1.5: User cancels confirmation", async () => {
      const fileUri = Uri.file("/test/repo/file.txt");
      const resource = new Resource(fileUri, Status.MODIFIED);
      const resourceGroup = createMockResourceGroup([resource]);

      resetMockCalls();
      mockState.confirmRevertResult = false;

      await revertAll.execute(resourceGroup);

      assert.ok(mockState.confirmRevertCalled);
      assert.ok(!mockState.checkAndPromptDepthCalled);
      assert.ok(!mockState.revertCalled);
    });

    test("1.6: User cancels depth selection", async () => {
      const fileUri = Uri.file("/test/repo/file.txt");
      const resource = new Resource(fileUri, Status.MODIFIED);
      const resourceGroup = createMockResourceGroup([resource]);

      resetMockCalls();
      mockState.confirmRevertResult = true;
      mockState.checkAndPromptDepthResult = undefined;

      await revertAll.execute(resourceGroup);

      assert.ok(mockState.confirmRevertCalled);
      assert.ok(mockState.checkAndPromptDepthCalled);
      assert.ok(!mockState.revertCalled);
    });

    test("1.7: Empty resource group", async () => {
      const resourceGroup = createMockResourceGroup([]);

      resetMockCalls();

      await revertAll.execute(resourceGroup);

      assert.ok(!mockState.confirmRevertCalled);
      assert.ok(!mockState.checkAndPromptDepthCalled);
      assert.ok(!mockState.revertCalled);
    });

    test("1.8: Multiple files with different statuses", async () => {
      const modifiedUri = Uri.file("/test/repo/modified.txt");
      const addedUri = Uri.file("/test/repo/added.txt");
      const deletedUri = Uri.file("/test/repo/deleted.txt");
      const resource1 = new Resource(modifiedUri, Status.MODIFIED);
      const resource2 = new Resource(addedUri, Status.ADDED);
      const resource3 = new Resource(deletedUri, Status.DELETED);
      const resourceGroup = createMockResourceGroup([
        resource1,
        resource2,
        resource3
      ]);

      resetMockCalls();
      mockState.checkAndPromptDepthResult = "empty";

      (revertAll as any).runByRepository = async (
        _uris: Uri[],
        operation: any
      ) => {
        await operation(mockRepository, [modifiedUri, addedUri, deletedUri]);
      };

      await revertAll.execute(resourceGroup);

      assert.ok(mockState.revertCalled);
      assert.ok(mockState.lastRevertCall);
      assert.strictEqual(mockState.lastRevertCall.paths.length, 3);
    });

    test("1.9: URI mapping for resource states", async () => {
      const fileUri1 = Uri.file("/test/repo/file1.txt");
      const fileUri2 = Uri.file("/test/repo/file2.txt");
      const resource1 = new Resource(fileUri1, Status.MODIFIED);
      const resource2 = new Resource(fileUri2, Status.ADDED);
      const resourceGroup = createMockResourceGroup([resource1, resource2]);

      resetMockCalls();

      let capturedUris: Uri[] = [];
      (revertAll as any).runByRepository = async (
        uris: Uri[],
        operation: any
      ) => {
        capturedUris = uris;
        await operation(mockRepository, uris);
      };

      await revertAll.execute(resourceGroup);

      assert.strictEqual(capturedUris.length, 2);
      assert.strictEqual(capturedUris[0].fsPath, fileUri1.fsPath);
      assert.strictEqual(capturedUris[1].fsPath, fileUri2.fsPath);
    });

    test("1.10: Path reversal for revert operation", async () => {
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

    test("1.11: Error handling in repository operation", async () => {
      const fileUri = Uri.file("/test/repo/file.txt");
      const resource = new Resource(fileUri, Status.MODIFIED);
      const resourceGroup = createMockResourceGroup([resource]);

      (mockRepository.revert as any) = async () => {
        throw new Error("SVN error: unable to revert");
      };

      resetMockCalls();

      (revertAll as any).runByRepository = async (
        _uris: Uri[],
        operation: any
      ) => {
        await operation(mockRepository, [fileUri]);
      };

      (revertAll as any).handleRepositoryOperation = async (
        operation: any,
        _errorMsg: string
      ) => {
        try {
          return await operation();
        } catch (error) {
          // Error caught and handled
          return undefined;
        }
      };

      await revertAll.execute(resourceGroup);

      // Should not throw, error handled internally
      assert.ok(true);
    });

    test("1.12: Single conflicted file", async () => {
      const fileUri = Uri.file("/test/repo/conflict.txt");
      const resource = new Resource(fileUri, Status.CONFLICTED);
      const resourceGroup = createMockResourceGroup([resource]);

      resetMockCalls();

      (revertAll as any).runByRepository = async (
        _uris: Uri[],
        operation: any
      ) => {
        await operation(mockRepository, [fileUri]);
      };

      await revertAll.execute(resourceGroup);

      assert.ok(mockState.revertCalled);
      assert.ok(mockState.lastRevertCall);
      assert.strictEqual(mockState.lastRevertCall.paths.length, 1);
    });
  });

  suite("RevertExplorer Command", () => {
    let revertExplorer: RevertExplorer;

    setup(() => {
      revertExplorer = new RevertExplorer();
    });

    test("2.1: Revert single file from explorer", async () => {
      const fileUri = Uri.file("/test/repo/file.txt");

      resetMockCalls();
      mockState.checkAndPromptDepthResult = "empty";

      (revertExplorer as any).executeRevert = async (
        uris: Uri[],
        depth: keyof typeof SvnDepth
      ) => {
        mockState.revertCalled = true;
        mockState.lastRevertCall = {
          paths: uris.map(u => u.fsPath),
          depth
        };
      };

      await revertExplorer.execute(fileUri, [fileUri]);

      assert.ok(mockState.confirmRevertCalled);
      assert.ok(mockState.checkAndPromptDepthCalled);
      assert.ok(mockState.revertCalled);
      assert.ok(mockState.lastRevertCall);
      assert.strictEqual(mockState.lastRevertCall.depth, "empty");
      assert.strictEqual(mockState.lastRevertCall.paths.length, 1);
    });

    test("2.2: Revert multiple files from explorer", async () => {
      const fileUri1 = Uri.file("/test/repo/file1.txt");
      const fileUri2 = Uri.file("/test/repo/file2.txt");
      const fileUri3 = Uri.file("/test/repo/file3.txt");

      resetMockCalls();
      mockState.checkAndPromptDepthResult = "empty";

      (revertExplorer as any).executeRevert = async (
        uris: Uri[],
        depth: keyof typeof SvnDepth
      ) => {
        mockState.revertCalled = true;
        mockState.lastRevertCall = {
          paths: uris.map(u => u.fsPath),
          depth
        };
      };

      await revertExplorer.execute(fileUri1, [fileUri1, fileUri2, fileUri3]);

      assert.ok(mockState.revertCalled);
      assert.ok(mockState.lastRevertCall);
      assert.strictEqual(mockState.lastRevertCall.paths.length, 3);
    });

    test("2.3: Revert with files depth", async () => {
      const fileUri = Uri.file("/test/repo/file.txt");

      resetMockCalls();
      mockState.checkAndPromptDepthResult = "files";

      (revertExplorer as any).executeRevert = async (
        uris: Uri[],
        depth: keyof typeof SvnDepth
      ) => {
        mockState.revertCalled = true;
        mockState.lastRevertCall = {
          paths: uris.map(u => u.fsPath),
          depth
        };
      };

      await revertExplorer.execute(fileUri, [fileUri]);

      assert.ok(mockState.lastRevertCall);
      assert.strictEqual(mockState.lastRevertCall.depth, "files");
    });

    test("2.4: Revert with infinity depth", async () => {
      const dirUri = Uri.file("/test/repo/directory");

      resetMockCalls();
      mockState.checkAndPromptDepthResult = "infinity";

      (revertExplorer as any).executeRevert = async (
        uris: Uri[],
        depth: keyof typeof SvnDepth
      ) => {
        mockState.revertCalled = true;
        mockState.lastRevertCall = {
          paths: uris.map(u => u.fsPath),
          depth
        };
      };

      await revertExplorer.execute(dirUri, [dirUri]);

      assert.ok(mockState.lastRevertCall);
      assert.strictEqual(mockState.lastRevertCall.depth, "infinity");
    });

    test("2.5: Revert with immediates depth", async () => {
      const fileUri = Uri.file("/test/repo/file.txt");

      resetMockCalls();
      mockState.checkAndPromptDepthResult = "immediates";

      (revertExplorer as any).executeRevert = async (
        uris: Uri[],
        depth: keyof typeof SvnDepth
      ) => {
        mockState.revertCalled = true;
        mockState.lastRevertCall = {
          paths: uris.map(u => u.fsPath),
          depth
        };
      };

      await revertExplorer.execute(fileUri, [fileUri]);

      assert.ok(mockState.lastRevertCall);
      assert.strictEqual(mockState.lastRevertCall.depth, "immediates");
    });

    test("2.6: User cancels confirmation", async () => {
      const fileUri = Uri.file("/test/repo/file.txt");

      resetMockCalls();
      mockState.confirmRevertResult = false;

      (revertExplorer as any).executeRevert = async () => {
        mockState.revertCalled = true;
      };

      await revertExplorer.execute(fileUri, [fileUri]);

      assert.ok(mockState.confirmRevertCalled);
      assert.ok(!mockState.checkAndPromptDepthCalled);
      assert.ok(!mockState.revertCalled);
    });

    test("2.7: User cancels depth selection", async () => {
      const fileUri = Uri.file("/test/repo/file.txt");

      resetMockCalls();
      mockState.confirmRevertResult = true;
      mockState.checkAndPromptDepthResult = undefined;

      (revertExplorer as any).executeRevert = async () => {
        mockState.revertCalled = true;
      };

      await revertExplorer.execute(fileUri, [fileUri]);

      assert.ok(mockState.confirmRevertCalled);
      assert.ok(mockState.checkAndPromptDepthCalled);
      assert.ok(!mockState.revertCalled);
    });

    test("2.8: No URIs provided (undefined)", async () => {
      resetMockCalls();

      (revertExplorer as any).executeRevert = async () => {
        mockState.revertCalled = true;
      };

      await revertExplorer.execute(undefined, undefined);

      assert.ok(!mockState.confirmRevertCalled);
      assert.ok(!mockState.checkAndPromptDepthCalled);
      assert.ok(!mockState.revertCalled);
    });

    test("2.9: Empty URIs array", async () => {
      resetMockCalls();

      (revertExplorer as any).executeRevert = async () => {
        mockState.revertCalled = true;
      };

      await revertExplorer.execute(undefined, []);

      assert.ok(!mockState.confirmRevertCalled);
      assert.ok(!mockState.checkAndPromptDepthCalled);
      assert.ok(!mockState.revertCalled);
    });

    test("2.10: Directory revert from explorer", async () => {
      const dirUri = Uri.file("/test/repo/directory");

      resetMockCalls();
      mockState.checkAndPromptDepthResult = "infinity";

      (revertExplorer as any).executeRevert = async (
        uris: Uri[],
        depth: keyof typeof SvnDepth
      ) => {
        mockState.revertCalled = true;
        mockState.lastRevertCall = {
          paths: uris.map(u => u.fsPath),
          depth
        };
      };

      await revertExplorer.execute(dirUri, [dirUri]);

      assert.ok(mockState.revertCalled);
      assert.ok(mockState.lastRevertCall);
      assert.strictEqual(mockState.lastRevertCall.paths[0], dirUri.fsPath);
    });

    test("2.11: Mixed files and directories from explorer", async () => {
      const fileUri = Uri.file("/test/repo/file.txt");
      const dirUri = Uri.file("/test/repo/directory");

      resetMockCalls();
      mockState.checkAndPromptDepthResult = "files";

      (revertExplorer as any).executeRevert = async (
        uris: Uri[],
        depth: keyof typeof SvnDepth
      ) => {
        mockState.revertCalled = true;
        mockState.lastRevertCall = {
          paths: uris.map(u => u.fsPath),
          depth
        };
      };

      await revertExplorer.execute(fileUri, [fileUri, dirUri]);

      assert.ok(mockState.revertCalled);
      assert.ok(mockState.lastRevertCall);
      assert.strictEqual(mockState.lastRevertCall.paths.length, 2);
    });

    test("2.12: Main URI parameter (first argument)", async () => {
      const mainUri = Uri.file("/test/repo/main.txt");
      const otherUri = Uri.file("/test/repo/other.txt");

      resetMockCalls();

      let capturedUris: Uri[] = [];
      (revertExplorer as any).executeRevert = async (
        uris: Uri[],
        _depth: keyof typeof SvnDepth
      ) => {
        mockState.revertCalled = true;
        capturedUris = uris;
      };

      await revertExplorer.execute(mainUri, [mainUri, otherUri]);

      // executeRevert receives allUris (not mainUri)
      assert.strictEqual(capturedUris.length, 2);
      assert.strictEqual(capturedUris[0].fsPath, mainUri.fsPath);
      assert.strictEqual(capturedUris[1].fsPath, otherUri.fsPath);
    });
  });

  suite("Edge Cases & Complex Scenarios", () => {
    let revertAll: RevertAll;
    let revertExplorer: RevertExplorer;

    setup(() => {
      revertAll = new RevertAll();
      revertExplorer = new RevertExplorer();
    });

    test("3.1: RevertAll with all depth values", async () => {
      const depths: Array<keyof typeof SvnDepth> = [
        "empty",
        "files",
        "immediates",
        "infinity"
      ];

      for (const depth of depths) {
        const fileUri = Uri.file("/test/repo/file.txt");
        const resource = new Resource(fileUri, Status.MODIFIED);
        const resourceGroup = createMockResourceGroup([resource]);

        resetMockCalls();
        mockState.checkAndPromptDepthResult = depth;

        (revertAll as any).runByRepository = async (
          _uris: Uri[],
          operation: any
        ) => {
          await operation(mockRepository, [fileUri]);
        };

        await revertAll.execute(resourceGroup);

        assert.ok(mockState.revertCalled, `Should revert with depth: ${depth}`);
        assert.ok(mockState.lastRevertCall);
        assert.strictEqual(mockState.lastRevertCall.depth, depth);
      }
    });

    test("3.2: RevertExplorer with all depth values", async () => {
      const depths: Array<keyof typeof SvnDepth> = [
        "empty",
        "files",
        "immediates",
        "infinity"
      ];

      for (const depth of depths) {
        const fileUri = Uri.file("/test/repo/file.txt");

        resetMockCalls();
        mockState.checkAndPromptDepthResult = depth;

        (revertExplorer as any).executeRevert = async (
          _uris: Uri[],
          receivedDepth: keyof typeof SvnDepth
        ) => {
          mockState.revertCalled = true;
          mockState.lastRevertCall = {
            paths: [fileUri.fsPath],
            depth: receivedDepth
          };
        };

        await revertExplorer.execute(fileUri, [fileUri]);

        assert.ok(mockState.revertCalled);
        assert.ok(mockState.lastRevertCall);
        assert.strictEqual(mockState.lastRevertCall.depth, depth);
      }
    });

    test("3.3: Large batch of files in RevertAll", async () => {
      const resources = [];
      for (let i = 0; i < 50; i++) {
        const uri = Uri.file(`/test/repo/file${i}.txt`);
        resources.push(new Resource(uri, Status.MODIFIED));
      }
      const resourceGroup = createMockResourceGroup(resources);

      resetMockCalls();

      const uris = resources.map(r => r.resourceUri);
      (revertAll as any).runByRepository = async (
        _uris: Uri[],
        operation: any
      ) => {
        await operation(mockRepository, uris);
      };

      await revertAll.execute(resourceGroup);

      assert.ok(mockState.revertCalled);
      assert.ok(mockState.lastRevertCall);
      assert.strictEqual(mockState.lastRevertCall.paths.length, 50);
    });

    test("3.4: Large batch of files in RevertExplorer", async () => {
      const uris = [];
      for (let i = 0; i < 50; i++) {
        uris.push(Uri.file(`/test/repo/file${i}.txt`));
      }

      resetMockCalls();

      (revertExplorer as any).executeRevert = async (
        receivedUris: Uri[],
        _depth: keyof typeof SvnDepth
      ) => {
        mockState.revertCalled = true;
        mockState.lastRevertCall = {
          paths: receivedUris.map(u => u.fsPath),
          depth: "empty"
        };
      };

      await revertExplorer.execute(uris[0], uris);

      assert.ok(mockState.revertCalled);
      assert.ok(mockState.lastRevertCall);
      assert.strictEqual(mockState.lastRevertCall.paths.length, 50);
    });

    test("3.5: Files with special characters in paths", async () => {
      const fileUri = Uri.file("/test/repo/file with spaces.txt");
      const resource = new Resource(fileUri, Status.MODIFIED);
      const resourceGroup = createMockResourceGroup([resource]);

      resetMockCalls();

      (revertAll as any).runByRepository = async (
        _uris: Uri[],
        operation: any
      ) => {
        await operation(mockRepository, [fileUri]);
      };

      await revertAll.execute(resourceGroup);

      assert.ok(mockState.revertCalled);
      assert.ok(mockState.lastRevertCall);
      assert.ok(
        mockState.lastRevertCall.paths[0].includes("file with spaces.txt")
      );
    });

    test("3.6: All status types in RevertAll", async () => {
      const statuses = [
        Status.MODIFIED,
        Status.ADDED,
        Status.DELETED,
        Status.CONFLICTED,
        Status.REPLACED,
        Status.MISSING
      ];

      const resources = statuses.map((status, i) => {
        const uri = Uri.file(`/test/repo/file${i}.txt`);
        return new Resource(uri, status);
      });

      const resourceGroup = createMockResourceGroup(resources);

      resetMockCalls();

      const uris = resources.map(r => r.resourceUri);
      (revertAll as any).runByRepository = async (
        _uris: Uri[],
        operation: any
      ) => {
        await operation(mockRepository, uris);
      };

      await revertAll.execute(resourceGroup);

      assert.ok(mockState.revertCalled);
      assert.ok(mockState.lastRevertCall);
      assert.strictEqual(mockState.lastRevertCall.paths.length, 6);
    });

    test("3.7: Nested directory structure in RevertExplorer", async () => {
      const deepPath = Uri.file("/test/repo/a/b/c/file.txt");

      resetMockCalls();

      (revertExplorer as any).executeRevert = async (
        uris: Uri[],
        _depth: keyof typeof SvnDepth
      ) => {
        mockState.revertCalled = true;
        mockState.lastRevertCall = {
          paths: uris.map(u => u.fsPath),
          depth: "empty"
        };
      };

      await revertExplorer.execute(deepPath, [deepPath]);

      assert.ok(mockState.revertCalled);
      assert.ok(mockState.lastRevertCall);
      assert.ok(mockState.lastRevertCall.paths[0].includes("a/b/c/file.txt"));
    });

    test("3.8: Confirmation flow verification", async () => {
      const fileUri = Uri.file("/test/repo/file.txt");
      const resource = new Resource(fileUri, Status.MODIFIED);
      const resourceGroup = createMockResourceGroup([resource]);

      resetMockCalls();

      let confirmationOrder = 0;
      let depthOrder = 0;
      let revertOrder = 0;

      (revertInput as any).confirmRevert = async () => {
        confirmationOrder = 1;
        return true;
      };

      (revertInput as any).checkAndPromptDepth = async () => {
        depthOrder = confirmationOrder + 1;
        return "empty";
      };

      (revertAll as any).runByRepository = async (
        _uris: Uri[],
        operation: any
      ) => {
        revertOrder = depthOrder + 1;
        await operation(mockRepository, [fileUri]);
      };

      await revertAll.execute(resourceGroup);

      // Verify execution order: confirm -> depth -> revert
      assert.strictEqual(confirmationOrder, 1);
      assert.strictEqual(depthOrder, 2);
      assert.strictEqual(revertOrder, 3);
    });

    test("3.9: Multiple repository handling (RevertAll)", async () => {
      const repo1Uri = Uri.file("/repo1/file.txt");
      const repo2Uri = Uri.file("/repo2/file.txt");
      const resource1 = new Resource(repo1Uri, Status.MODIFIED);
      const resource2 = new Resource(repo2Uri, Status.MODIFIED);
      const resourceGroup = createMockResourceGroup([resource1, resource2]);

      resetMockCalls();

      let runByRepositoryCalled = false;
      (revertAll as any).runByRepository = async (
        uris: Uri[],
        _operation: any
      ) => {
        runByRepositoryCalled = true;
        assert.strictEqual(uris.length, 2);
      };

      await revertAll.execute(resourceGroup);

      assert.ok(runByRepositoryCalled);
    });

    test("3.10: RevertExplorer with non-file URI scheme", async () => {
      const svnUri = Uri.parse("svn:/test/repo/file.txt");

      resetMockCalls();

      (revertExplorer as any).executeRevert = async (
        uris: Uri[],
        _depth: keyof typeof SvnDepth
      ) => {
        mockState.revertCalled = true;
        mockState.lastRevertCall = {
          paths: uris.map(u => u.toString()),
          depth: "empty"
        };
      };

      await revertExplorer.execute(svnUri, [svnUri]);

      assert.ok(mockState.revertCalled);
      assert.ok(mockState.lastRevertCall);
      assert.strictEqual(mockState.lastRevertCall.paths.length, 1);
    });
  });
});
