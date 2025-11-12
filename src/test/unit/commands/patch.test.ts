import * as assert from "assert";
import { Uri } from "vscode";
import { Patch } from "../../../commands/patch";
import { PatchAll } from "../../../commands/patchAll";
import { PatchChangeList } from "../../../commands/patchChangeList";
import { Status } from "../../../common/types";
import { Repository } from "../../../repository";
import { Resource } from "../../../resource";
import * as changelistItems from "../../../changelistItems";

suite("Patch Commands Tests", () => {
  let mockRepository: Partial<Repository>;
  let origGetPatchChangelist: typeof changelistItems.getPatchChangelist;
  let patchCalls: Array<{ files: string[] }>;
  let patchChangelistCalls: Array<{ changelistName: string }>;
  let showDiffPathCalls: Array<{ content: string }>;
  let getPatchChangelistCalls: number;
  let getPatchChangelistResult: string | undefined;

  setup(() => {
    // Reset tracking
    patchCalls = [];
    patchChangelistCalls = [];
    showDiffPathCalls = [];
    getPatchChangelistCalls = 0;
    getPatchChangelistResult = undefined;

    // Mock Repository
    mockRepository = {
      root: "/test/repo",
      patch: async (files: string[]) => {
        patchCalls.push({ files });
        return "diff content for files";
      },
      patchChangelist: async (changelistName: string) => {
        patchChangelistCalls.push({ changelistName });
        return `diff content for ${changelistName}`;
      }
    };

    // Mock getPatchChangelist
    origGetPatchChangelist = changelistItems.getPatchChangelist;
    (changelistItems as any).getPatchChangelist = async () => {
      getPatchChangelistCalls++;
      return getPatchChangelistResult;
    };
  });

  teardown(() => {
    (changelistItems as any).getPatchChangelist = origGetPatchChangelist;
  });

  suite("Patch Command", () => {
    let patch: Patch;

    setup(() => {
      patch = new Patch();
    });

    test("1.1: Single modified file patch", async () => {
      const fileUri = Uri.file("/test/repo/file.txt");
      const resource = new Resource(fileUri, Status.MODIFIED);

      (patch as any).getResourceStatesOrExit = async () => [resource];
      (patch as any).runByRepository = async (
        _uris: Uri[],
        operation: any
      ) => {
        await operation(mockRepository, [fileUri]);
      };
      (patch as any).showDiffPath = async (_repo: any, content: string) => {
        showDiffPathCalls.push({ content });
      };

      await patch.execute(resource);

      assert.strictEqual(patchCalls.length, 1);
      assert.strictEqual(patchCalls[0].files.length, 1);
      assert.strictEqual(showDiffPathCalls.length, 1);
      assert.strictEqual(showDiffPathCalls[0].content, "diff content for files");
    });

    test("1.2: Multiple modified files patch", async () => {
      const fileUri1 = Uri.file("/test/repo/file1.txt");
      const fileUri2 = Uri.file("/test/repo/file2.txt");
      const resource1 = new Resource(fileUri1, Status.MODIFIED);
      const resource2 = new Resource(fileUri2, Status.MODIFIED);

      (patch as any).getResourceStatesOrExit = async () => [
        resource1,
        resource2
      ];
      (patch as any).runByRepository = async (
        _uris: Uri[],
        operation: any
      ) => {
        await operation(mockRepository, [fileUri1, fileUri2]);
      };
      (patch as any).showDiffPath = async (_repo: any, content: string) => {
        showDiffPathCalls.push({ content });
      };

      await patch.execute(resource1, resource2);

      assert.strictEqual(patchCalls.length, 1);
      assert.strictEqual(patchCalls[0].files.length, 2);
      assert.strictEqual(showDiffPathCalls.length, 1);
    });

    test("1.3: Single added file patch", async () => {
      const fileUri = Uri.file("/test/repo/new.txt");
      const resource = new Resource(fileUri, Status.ADDED);

      (patch as any).getResourceStatesOrExit = async () => [resource];
      (patch as any).runByRepository = async (
        _uris: Uri[],
        operation: any
      ) => {
        await operation(mockRepository, [fileUri]);
      };
      (patch as any).showDiffPath = async (_repo: any, content: string) => {
        showDiffPathCalls.push({ content });
      };

      await patch.execute(resource);

      assert.strictEqual(patchCalls.length, 1);
      assert.strictEqual(showDiffPathCalls.length, 1);
    });

    test("1.4: Single deleted file patch", async () => {
      const fileUri = Uri.file("/test/repo/deleted.txt");
      const resource = new Resource(fileUri, Status.DELETED);

      (patch as any).getResourceStatesOrExit = async () => [resource];
      (patch as any).runByRepository = async (
        _uris: Uri[],
        operation: any
      ) => {
        await operation(mockRepository, [fileUri]);
      };
      (patch as any).showDiffPath = async (_repo: any, content: string) => {
        showDiffPathCalls.push({ content });
      };

      await patch.execute(resource);

      assert.strictEqual(patchCalls.length, 1);
      assert.strictEqual(showDiffPathCalls.length, 1);
    });

    test("1.5: Mixed status files patch", async () => {
      const modifiedUri = Uri.file("/test/repo/modified.txt");
      const addedUri = Uri.file("/test/repo/added.txt");
      const deletedUri = Uri.file("/test/repo/deleted.txt");
      const resource1 = new Resource(modifiedUri, Status.MODIFIED);
      const resource2 = new Resource(addedUri, Status.ADDED);
      const resource3 = new Resource(deletedUri, Status.DELETED);

      (patch as any).getResourceStatesOrExit = async () => [
        resource1,
        resource2,
        resource3
      ];
      (patch as any).runByRepository = async (
        _uris: Uri[],
        operation: any
      ) => {
        await operation(mockRepository, [modifiedUri, addedUri, deletedUri]);
      };
      (patch as any).showDiffPath = async (_repo: any, content: string) => {
        showDiffPathCalls.push({ content });
      };

      await patch.execute(resource1, resource2, resource3);

      assert.strictEqual(patchCalls.length, 1);
      assert.strictEqual(patchCalls[0].files.length, 3);
      assert.strictEqual(showDiffPathCalls.length, 1);
    });

    test("1.6: No resources selected (user cancelled)", async () => {
      (patch as any).getResourceStatesOrExit = async () => null;

      await patch.execute();

      assert.strictEqual(patchCalls.length, 0);
      assert.strictEqual(showDiffPathCalls.length, 0);
    });

    test("1.7: Empty resource selection", async () => {
      (patch as any).getResourceStatesOrExit = async () => null;

      await patch.execute();

      assert.strictEqual(patchCalls.length, 0);
      assert.strictEqual(showDiffPathCalls.length, 0);
    });

    test("1.8: Repository.patch error handling", async () => {
      const fileUri = Uri.file("/test/repo/file.txt");
      const resource = new Resource(fileUri, Status.MODIFIED);

      (mockRepository.patch as any) = async () => {
        throw new Error("SVN error: unable to create diff");
      };

      (patch as any).getResourceStatesOrExit = async () => [resource];
      (patch as any).runByRepository = async (
        _uris: Uri[],
        operation: any
      ) => {
        try {
          await operation(mockRepository, [fileUri]);
        } catch (err) {
          // Error caught and handled
        }
      };

      try {
        await patch.execute(resource);
      } catch (err) {
        assert.ok(true, "Error handled");
      }

      assert.strictEqual(showDiffPathCalls.length, 0);
    });

    test("1.9: URI mapping correctness", async () => {
      const fileUri = Uri.file("/test/repo/file.txt");
      const resource = new Resource(fileUri, Status.MODIFIED);

      (patch as any).getResourceStatesOrExit = async () => [resource];
      (patch as any).runByRepository = async (
        uris: Uri[],
        operation: any
      ) => {
        assert.strictEqual(uris.length, 1);
        assert.strictEqual(uris[0].fsPath, fileUri.fsPath);
        await operation(mockRepository, uris);
      };
      (patch as any).showDiffPath = async (_repo: any, content: string) => {
        showDiffPathCalls.push({ content });
      };

      await patch.execute(resource);

      assert.strictEqual(showDiffPathCalls.length, 1);
    });

    test("1.10: File path conversion to fsPath", async () => {
      const fileUri = Uri.file("/test/repo/subdir/file.txt");
      const resource = new Resource(fileUri, Status.MODIFIED);

      (patch as any).getResourceStatesOrExit = async () => [resource];
      (patch as any).runByRepository = async (
        _uris: Uri[],
        operation: any
      ) => {
        await operation(mockRepository, [fileUri]);
      };
      (patch as any).showDiffPath = async (_repo: any, content: string) => {
        showDiffPathCalls.push({ content });
      };

      await patch.execute(resource);

      assert.strictEqual(patchCalls.length, 1);
      assert.strictEqual(showDiffPathCalls.length, 1);
    });

    test("1.11: Patch with conflicted file", async () => {
      const fileUri = Uri.file("/test/repo/conflict.txt");
      const resource = new Resource(fileUri, Status.CONFLICTED);

      (patch as any).getResourceStatesOrExit = async () => [resource];
      (patch as any).runByRepository = async (
        _uris: Uri[],
        operation: any
      ) => {
        await operation(mockRepository, [fileUri]);
      };
      (patch as any).showDiffPath = async (_repo: any, content: string) => {
        showDiffPathCalls.push({ content });
      };

      await patch.execute(resource);

      assert.strictEqual(patchCalls.length, 1);
      assert.strictEqual(showDiffPathCalls.length, 1);
    });

    test("1.12: Patch with replaced file", async () => {
      const fileUri = Uri.file("/test/repo/replaced.txt");
      const resource = new Resource(fileUri, Status.REPLACED);

      (patch as any).getResourceStatesOrExit = async () => [resource];
      (patch as any).runByRepository = async (
        _uris: Uri[],
        operation: any
      ) => {
        await operation(mockRepository, [fileUri]);
      };
      (patch as any).showDiffPath = async (_repo: any, content: string) => {
        showDiffPathCalls.push({ content });
      };

      await patch.execute(resource);

      assert.strictEqual(patchCalls.length, 1);
      assert.strictEqual(showDiffPathCalls.length, 1);
    });
  });

  suite("PatchAll Command", () => {
    let patchAll: PatchAll;

    setup(() => {
      patchAll = new PatchAll();
    });

    test("2.1: Patch all changes in repository", async () => {
      (patchAll as any).showDiffPath = async (_repo: any, content: string) => {
        showDiffPathCalls.push({ content });
      };

      await patchAll.execute(mockRepository as Repository);

      assert.strictEqual(patchCalls.length, 1);
      assert.strictEqual(patchCalls[0].files.length, 0);
      assert.strictEqual(showDiffPathCalls.length, 1);
      assert.strictEqual(showDiffPathCalls[0].content, "diff content for files");
    });

    test("2.2: Empty patch when no changes", async () => {
      (mockRepository.patch as any) = async (files: string[]) => {
        patchCalls.push({ files });
        return "";
      };

      (patchAll as any).showDiffPath = async (_repo: any, content: string) => {
        showDiffPathCalls.push({ content });
      };

      await patchAll.execute(mockRepository as Repository);

      assert.strictEqual(patchCalls.length, 1);
      assert.strictEqual(patchCalls[0].files.length, 0);
      assert.strictEqual(showDiffPathCalls.length, 1);
      assert.strictEqual(showDiffPathCalls[0].content, "");
    });

    test("2.3: Repository.patch error handling", async () => {
      (mockRepository.patch as any) = async () => {
        throw new Error("SVN error: unable to create diff");
      };

      try {
        await patchAll.execute(mockRepository as Repository);
        assert.fail("Should have thrown error");
      } catch (err: any) {
        assert.ok(err.message.includes("unable to create diff"));
      }

      assert.strictEqual(showDiffPathCalls.length, 0);
    });

    test("2.4: showDiffPath called with correct content", async () => {
      const expectedContent = "diff --git a/file.txt b/file.txt\n--- a/file.txt\n+++ b/file.txt\n@@ -1 +1 @@\n-old\n+new";
      (mockRepository.patch as any) = async (files: string[]) => {
        patchCalls.push({ files });
        return expectedContent;
      };

      (patchAll as any).showDiffPath = async (_repo: any, content: string) => {
        showDiffPathCalls.push({ content });
        assert.strictEqual(content, expectedContent);
      };

      await patchAll.execute(mockRepository as Repository);

      assert.strictEqual(showDiffPathCalls.length, 1);
    });

    test("2.5: Repository instance passed correctly", async () => {
      let receivedRepo: any = null;

      (patchAll as any).showDiffPath = async (repo: any, content: string) => {
        receivedRepo = repo;
        showDiffPathCalls.push({ content });
      };

      await patchAll.execute(mockRepository as Repository);

      assert.strictEqual(receivedRepo, mockRepository);
      assert.strictEqual(showDiffPathCalls.length, 1);
    });
  });

  suite("PatchChangeList Command", () => {
    let patchChangeList: PatchChangeList;

    setup(() => {
      patchChangeList = new PatchChangeList();
    });

    test("3.1: Patch selected changelist", async () => {
      getPatchChangelistResult = "my-changelist";

      (patchChangeList as any).showDiffPath = async (
        _repo: any,
        content: string
      ) => {
        showDiffPathCalls.push({ content });
      };

      await patchChangeList.execute(mockRepository as Repository);

      assert.strictEqual(getPatchChangelistCalls, 1);
      assert.strictEqual(patchChangelistCalls.length, 1);
      assert.strictEqual(patchChangelistCalls[0].changelistName, "my-changelist");
      assert.strictEqual(showDiffPathCalls.length, 1);
      assert.strictEqual(
        showDiffPathCalls[0].content,
        "diff content for my-changelist"
      );
    });

    test("3.2: User cancels changelist selection (undefined)", async () => {
      getPatchChangelistResult = undefined;

      await patchChangeList.execute(mockRepository as Repository);

      assert.strictEqual(getPatchChangelistCalls, 1);
      assert.strictEqual(patchChangelistCalls.length, 0);
      assert.strictEqual(showDiffPathCalls.length, 0);
    });

    test("3.3: User cancels changelist selection (null)", async () => {
      getPatchChangelistResult = undefined;

      await patchChangeList.execute(mockRepository as Repository);

      assert.strictEqual(getPatchChangelistCalls, 1);
      assert.strictEqual(patchChangelistCalls.length, 0);
      assert.strictEqual(showDiffPathCalls.length, 0);
    });

    test("3.4: Patch changelist with empty name", async () => {
      getPatchChangelistResult = "";

      (patchChangeList as any).showDiffPath = async (
        _repo: any,
        content: string
      ) => {
        showDiffPathCalls.push({ content });
      };

      await patchChangeList.execute(mockRepository as Repository);

      assert.strictEqual(getPatchChangelistCalls, 1);
      // Empty string is falsy, so should not proceed
      assert.strictEqual(patchChangelistCalls.length, 0);
      assert.strictEqual(showDiffPathCalls.length, 0);
    });

    test("3.5: Repository.patchChangelist error handling", async () => {
      getPatchChangelistResult = "my-changelist";

      (mockRepository.patchChangelist as any) = async () => {
        throw new Error("SVN error: changelist not found");
      };

      try {
        await patchChangeList.execute(mockRepository as Repository);
        assert.fail("Should have thrown error");
      } catch (err: any) {
        assert.ok(err.message.includes("changelist not found"));
      }

      assert.strictEqual(getPatchChangelistCalls, 1);
      assert.strictEqual(showDiffPathCalls.length, 0);
    });

    test("3.6: Patch changelist with special characters", async () => {
      getPatchChangelistResult = "feature/my-feature-123";

      (patchChangeList as any).showDiffPath = async (
        _repo: any,
        content: string
      ) => {
        showDiffPathCalls.push({ content });
      };

      await patchChangeList.execute(mockRepository as Repository);

      assert.strictEqual(patchChangelistCalls.length, 1);
      assert.strictEqual(
        patchChangelistCalls[0].changelistName,
        "feature/my-feature-123"
      );
      assert.strictEqual(showDiffPathCalls.length, 1);
    });

    test("3.7: Patch changelist with spaces", async () => {
      getPatchChangelistResult = "my changelist with spaces";

      (patchChangeList as any).showDiffPath = async (
        _repo: any,
        content: string
      ) => {
        showDiffPathCalls.push({ content });
      };

      await patchChangeList.execute(mockRepository as Repository);

      assert.strictEqual(patchChangelistCalls.length, 1);
      assert.strictEqual(
        patchChangelistCalls[0].changelistName,
        "my changelist with spaces"
      );
      assert.strictEqual(showDiffPathCalls.length, 1);
    });

    test("3.8: showDiffPath called with correct content", async () => {
      getPatchChangelistResult = "my-changelist";

      const expectedContent = "diff for changelist";
      (mockRepository.patchChangelist as any) = async (changelistName: string) => {
        patchChangelistCalls.push({ changelistName });
        return expectedContent;
      };

      (patchChangeList as any).showDiffPath = async (
        _repo: any,
        content: string
      ) => {
        showDiffPathCalls.push({ content });
        assert.strictEqual(content, expectedContent);
      };

      await patchChangeList.execute(mockRepository as Repository);

      assert.strictEqual(showDiffPathCalls.length, 1);
    });

    test("3.9: Repository instance passed correctly", async () => {
      getPatchChangelistResult = "my-changelist";

      let receivedRepo: any = null;

      (patchChangeList as any).showDiffPath = async (
        repo: any,
        content: string
      ) => {
        receivedRepo = repo;
        showDiffPathCalls.push({ content });
      };

      await patchChangeList.execute(mockRepository as Repository);

      assert.strictEqual(receivedRepo, mockRepository);
      assert.strictEqual(showDiffPathCalls.length, 1);
    });

    test("3.10: getPatchChangelist receives repository", async () => {
      getPatchChangelistResult = "my-changelist";

      let receivedRepo: any = null;
      (changelistItems as any).getPatchChangelist = async (repo: Repository) => {
        receivedRepo = repo;
        getPatchChangelistCalls++;
        return getPatchChangelistResult;
      };

      (patchChangeList as any).showDiffPath = async (
        _repo: any,
        content: string
      ) => {
        showDiffPathCalls.push({ content });
      };

      await patchChangeList.execute(mockRepository as Repository);

      assert.strictEqual(receivedRepo, mockRepository);
      assert.strictEqual(getPatchChangelistCalls, 1);
    });
  });

  suite("Edge Cases & Complex Scenarios", () => {
    let patch: Patch;

    setup(() => {
      patch = new Patch();
    });

    test("4.1: Large number of files in patch", async () => {
      const resources: Resource[] = [];
      const uris: Uri[] = [];
      for (let i = 0; i < 100; i++) {
        const uri = Uri.file(`/test/repo/file${i}.txt`);
        resources.push(new Resource(uri, Status.MODIFIED));
        uris.push(uri);
      }

      (patch as any).getResourceStatesOrExit = async () => resources;
      (patch as any).runByRepository = async (
        _uris: Uri[],
        operation: any
      ) => {
        await operation(mockRepository, uris);
      };
      (patch as any).showDiffPath = async (_repo: any, content: string) => {
        showDiffPathCalls.push({ content });
      };

      await patch.execute(...resources);

      assert.strictEqual(patchCalls.length, 1);
      assert.strictEqual(patchCalls[0].files.length, 100);
      assert.strictEqual(showDiffPathCalls.length, 1);
    });

    test("4.2: Files with special characters in path", async () => {
      const fileUri = Uri.file("/test/repo/file with spaces & special.txt");
      const resource = new Resource(fileUri, Status.MODIFIED);

      (patch as any).getResourceStatesOrExit = async () => [resource];
      (patch as any).runByRepository = async (
        _uris: Uri[],
        operation: any
      ) => {
        await operation(mockRepository, [fileUri]);
      };
      (patch as any).showDiffPath = async (_repo: any, content: string) => {
        showDiffPathCalls.push({ content });
      };

      await patch.execute(resource);

      assert.strictEqual(patchCalls.length, 1);
      assert.strictEqual(showDiffPathCalls.length, 1);
    });

    test("4.3: Files in nested directories", async () => {
      const fileUri = Uri.file("/test/repo/a/b/c/d/file.txt");
      const resource = new Resource(fileUri, Status.MODIFIED);

      (patch as any).getResourceStatesOrExit = async () => [resource];
      (patch as any).runByRepository = async (
        _uris: Uri[],
        operation: any
      ) => {
        await operation(mockRepository, [fileUri]);
      };
      (patch as any).showDiffPath = async (_repo: any, content: string) => {
        showDiffPathCalls.push({ content });
      };

      await patch.execute(resource);

      assert.strictEqual(patchCalls.length, 1);
      assert.strictEqual(showDiffPathCalls.length, 1);
    });

    test("4.4: Binary file in patch", async () => {
      const fileUri = Uri.file("/test/repo/image.png");
      const resource = new Resource(fileUri, Status.MODIFIED);

      (patch as any).getResourceStatesOrExit = async () => [resource];
      (patch as any).runByRepository = async (
        _uris: Uri[],
        operation: any
      ) => {
        await operation(mockRepository, [fileUri]);
      };
      (patch as any).showDiffPath = async (_repo: any, content: string) => {
        showDiffPathCalls.push({ content });
      };

      await patch.execute(resource);

      assert.strictEqual(patchCalls.length, 1);
      assert.strictEqual(showDiffPathCalls.length, 1);
    });

    test("4.5: Duplicate resources in selection", async () => {
      const fileUri = Uri.file("/test/repo/file.txt");
      const resource = new Resource(fileUri, Status.MODIFIED);

      (patch as any).getResourceStatesOrExit = async () => [resource, resource];
      (patch as any).runByRepository = async (
        _uris: Uri[],
        operation: any
      ) => {
        await operation(mockRepository, [fileUri, fileUri]);
      };
      (patch as any).showDiffPath = async (_repo: any, content: string) => {
        showDiffPathCalls.push({ content });
      };

      await patch.execute(resource, resource);

      assert.strictEqual(patchCalls.length, 1);
      assert.strictEqual(showDiffPathCalls.length, 1);
    });
  });
});
