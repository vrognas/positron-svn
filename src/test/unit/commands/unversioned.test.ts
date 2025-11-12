import * as assert from "assert";
import { Uri, window } from "vscode";
import { DeleteUnversioned } from "../../../commands/deleteUnversioned";
import { RemoveUnversioned } from "../../../commands/removeUnversioned";
import { Repository } from "../../../repository";
import { Resource } from "../../../resource";
import { Status } from "../../../common/types";
import * as fs from "../../../fs";
import * as util from "../../../util";

suite("Unversioned Commands Tests", () => {
  // Original functions
  let origExists: typeof fs.exists;
  let origLstat: typeof fs.lstat;
  let origUnlink: typeof fs.unlink;
  let origDeleteDirectory: typeof util.deleteDirectory;
  let origShowWarning: typeof window.showWarningMessage;

  // Mock state
  let existsResult: boolean;
  let lstatResult: { isDirectory: () => boolean };
  let unlinkCalls: string[];
  let deleteDirectoryCalls: string[];
  let showWarningResult: string | undefined;
  let showWarningCalls: Array<{ message: string; options: any }>;

  setup(() => {
    // Save originals
    origExists = fs.exists;
    origLstat = fs.lstat;
    origUnlink = fs.unlink;
    origDeleteDirectory = util.deleteDirectory;
    origShowWarning = window.showWarningMessage;

    // Reset state
    existsResult = true;
    lstatResult = { isDirectory: () => false };
    unlinkCalls = [];
    deleteDirectoryCalls = [];
    showWarningResult = undefined;
    showWarningCalls = [];

    // Mock fs functions
    (fs as any).exists = async (_path: string) => existsResult;
    (fs as any).lstat = async (_path: string) => lstatResult;
    (fs as any).unlink = async (path: string) => {
      unlinkCalls.push(path);
    };

    // Mock util.deleteDirectory
    (util as any).deleteDirectory = async (path: string) => {
      deleteDirectoryCalls.push(path);
    };

    // Mock window.showWarningMessage
    (window as any).showWarningMessage = async (
      message: string,
      options: any
    ) => {
      showWarningCalls.push({ message, options });
      return showWarningResult;
    };
  });

  teardown(() => {
    // Restore originals
    (fs as any).exists = origExists;
    (fs as any).lstat = origLstat;
    (fs as any).unlink = origUnlink;
    (util as any).deleteDirectory = origDeleteDirectory;
    (window as any).showWarningMessage = origShowWarning;
  });

  suite("DeleteUnversioned Command", () => {
    let deleteCmd: DeleteUnversioned;

    setup(() => {
      deleteCmd = new DeleteUnversioned();
    });

    teardown(() => {
      deleteCmd.dispose();
    });

    test("deletes single unversioned file after confirmation", async () => {
      const fileUri = Uri.file("/workspace/unversioned.txt");
      const resource = new Resource(fileUri, Status.UNVERSIONED);

      showWarningResult = "Yes";
      existsResult = true;
      lstatResult = { isDirectory: () => false };

      (deleteCmd as any).getResourceStatesOrExit = async () => [resource];

      await deleteCmd.execute(resource);

      assert.strictEqual(showWarningCalls.length, 1);
      assert.ok(
        showWarningCalls[0].message.includes("delete selected files")
      );
      assert.strictEqual(showWarningCalls[0].options.modal, true);
      assert.strictEqual(unlinkCalls.length, 1);
      assert.strictEqual(unlinkCalls[0], "/workspace/unversioned.txt");
      assert.strictEqual(deleteDirectoryCalls.length, 0);
    });

    test("deletes single unversioned directory after confirmation", async () => {
      const dirUri = Uri.file("/workspace/unversioned-dir");
      const resource = new Resource(dirUri, Status.UNVERSIONED);

      showWarningResult = "Yes";
      existsResult = true;
      lstatResult = { isDirectory: () => true };

      (deleteCmd as any).getResourceStatesOrExit = async () => [resource];

      await deleteCmd.execute(resource);

      assert.strictEqual(showWarningCalls.length, 1);
      assert.strictEqual(deleteDirectoryCalls.length, 1);
      assert.strictEqual(
        deleteDirectoryCalls[0],
        "/workspace/unversioned-dir"
      );
      assert.strictEqual(unlinkCalls.length, 0);
    });

    test("does not delete when user cancels", async () => {
      const fileUri = Uri.file("/workspace/unversioned.txt");
      const resource = new Resource(fileUri, Status.UNVERSIONED);

      showWarningResult = "No";

      (deleteCmd as any).getResourceStatesOrExit = async () => [resource];

      await deleteCmd.execute(resource);

      assert.strictEqual(showWarningCalls.length, 1);
      assert.strictEqual(unlinkCalls.length, 0);
      assert.strictEqual(deleteDirectoryCalls.length, 0);
    });

    test("does not delete when user dismisses dialog", async () => {
      const fileUri = Uri.file("/workspace/unversioned.txt");
      const resource = new Resource(fileUri, Status.UNVERSIONED);

      showWarningResult = undefined;

      (deleteCmd as any).getResourceStatesOrExit = async () => [resource];

      await deleteCmd.execute(resource);

      assert.strictEqual(showWarningCalls.length, 1);
      assert.strictEqual(unlinkCalls.length, 0);
      assert.strictEqual(deleteDirectoryCalls.length, 0);
    });

    test("deletes multiple unversioned files", async () => {
      const file1Uri = Uri.file("/workspace/file1.txt");
      const file2Uri = Uri.file("/workspace/file2.txt");
      const resource1 = new Resource(file1Uri, Status.UNVERSIONED);
      const resource2 = new Resource(file2Uri, Status.UNVERSIONED);

      showWarningResult = "Yes";
      existsResult = true;
      lstatResult = { isDirectory: () => false };

      (deleteCmd as any).getResourceStatesOrExit = async () => [
        resource1,
        resource2
      ];

      await deleteCmd.execute(resource1, resource2);

      assert.strictEqual(showWarningCalls.length, 1);
      assert.strictEqual(unlinkCalls.length, 2);
      assert.ok(unlinkCalls.includes("/workspace/file1.txt"));
      assert.ok(unlinkCalls.includes("/workspace/file2.txt"));
    });

    test("deletes mixed files and directories", async () => {
      const fileUri = Uri.file("/workspace/file.txt");
      const dirUri = Uri.file("/workspace/dir");
      const resourceFile = new Resource(fileUri, Status.UNVERSIONED);
      const resourceDir = new Resource(dirUri, Status.UNVERSIONED);

      showWarningResult = "Yes";
      existsResult = true;

      (deleteCmd as any).getResourceStatesOrExit = async () => [
        resourceFile,
        resourceDir
      ];

      // Mock lstat to return different results based on path
      (fs as any).lstat = async (path: string) => {
        if (path === "/workspace/dir") {
          return { isDirectory: () => true };
        }
        return { isDirectory: () => false };
      };

      await deleteCmd.execute(resourceFile, resourceDir);

      assert.strictEqual(showWarningCalls.length, 1);
      assert.strictEqual(unlinkCalls.length, 1);
      assert.strictEqual(unlinkCalls[0], "/workspace/file.txt");
      assert.strictEqual(deleteDirectoryCalls.length, 1);
      assert.strictEqual(deleteDirectoryCalls[0], "/workspace/dir");
    });

    test("skips non-existent files silently", async () => {
      const fileUri = Uri.file("/workspace/nonexistent.txt");
      const resource = new Resource(fileUri, Status.UNVERSIONED);

      showWarningResult = "Yes";
      existsResult = false;

      (deleteCmd as any).getResourceStatesOrExit = async () => [resource];

      await deleteCmd.execute(resource);

      assert.strictEqual(showWarningCalls.length, 1);
      assert.strictEqual(unlinkCalls.length, 0);
      assert.strictEqual(deleteDirectoryCalls.length, 0);
    });

    test("handles delete errors gracefully", async () => {
      const fileUri = Uri.file("/workspace/locked.txt");
      const resource = new Resource(fileUri, Status.UNVERSIONED);

      showWarningResult = "Yes";
      existsResult = true;
      lstatResult = { isDirectory: () => false };

      let errorCaught = false;
      (fs as any).unlink = async () => {
        throw new Error("Permission denied");
      };

      (deleteCmd as any).getResourceStatesOrExit = async () => [resource];

      // Mock handleRepositoryOperation to track error
      const origHandleRepoOp = (deleteCmd as any).handleRepositoryOperation;
      (deleteCmd as any).handleRepositoryOperation = async (op: any, msg: string) => {
        try {
          await op();
        } catch (error) {
          errorCaught = true;
          assert.strictEqual(msg, "Unable to delete file");
        }
      };

      await deleteCmd.execute(resource);

      assert.ok(errorCaught, "Error should be caught by handleRepositoryOperation");

      (deleteCmd as any).handleRepositoryOperation = origHandleRepoOp;
    });

    test("returns early when no resources selected", async () => {
      (deleteCmd as any).getResourceStatesOrExit = async () => null;

      await deleteCmd.execute();

      assert.strictEqual(showWarningCalls.length, 0);
      assert.strictEqual(unlinkCalls.length, 0);
    });

    test("shows modal warning dialog", async () => {
      const fileUri = Uri.file("/workspace/file.txt");
      const resource = new Resource(fileUri, Status.UNVERSIONED);

      showWarningResult = "Yes";

      (deleteCmd as any).getResourceStatesOrExit = async () => [resource];

      await deleteCmd.execute(resource);

      assert.strictEqual(showWarningCalls[0].options.modal, true);
    });
  });

  suite("RemoveUnversioned Command", () => {
    let removeCmd: RemoveUnversioned;
    let mockRepository: Partial<Repository>;
    let removeUnversionedCalls: number;

    setup(() => {
      removeCmd = new RemoveUnversioned();
      removeUnversionedCalls = 0;

      mockRepository = {
        removeUnversioned: async () => {
          removeUnversionedCalls++;
          return "Removed unversioned files";
        }
      };
    });

    teardown(() => {
      removeCmd.dispose();
    });

    test("removes all unversioned files after confirmation", async () => {
      showWarningResult = "Yes";

      await removeCmd.execute(mockRepository as Repository);

      assert.strictEqual(showWarningCalls.length, 1);
      assert.ok(
        showWarningCalls[0].message.includes(
          "remove all unversioned files except for ignored"
        )
      );
      assert.strictEqual(showWarningCalls[0].options.modal, true);
      assert.strictEqual(removeUnversionedCalls, 1);
    });

    test("does not remove when user cancels", async () => {
      showWarningResult = "No";

      await removeCmd.execute(mockRepository as Repository);

      assert.strictEqual(showWarningCalls.length, 1);
      assert.strictEqual(removeUnversionedCalls, 0);
    });

    test("does not remove when user dismisses dialog", async () => {
      showWarningResult = undefined;

      await removeCmd.execute(mockRepository as Repository);

      assert.strictEqual(showWarningCalls.length, 1);
      assert.strictEqual(removeUnversionedCalls, 0);
    });

    test("shows modal warning dialog", async () => {
      showWarningResult = "Yes";

      await removeCmd.execute(mockRepository as Repository);

      assert.strictEqual(showWarningCalls[0].options.modal, true);
    });

    test("calls repository.removeUnversioned on confirmation", async () => {
      showWarningResult = "Yes";
      let callCount = 0;

      mockRepository.removeUnversioned = async () => {
        callCount++;
        return "Success";
      };

      await removeCmd.execute(mockRepository as Repository);

      assert.strictEqual(callCount, 1);
    });

    test("warning message mentions ignored files exception", async () => {
      showWarningResult = "Yes";

      await removeCmd.execute(mockRepository as Repository);

      const message = showWarningCalls[0].message;
      assert.ok(message.includes("except for ignored"));
    });

    test("returns early when answer is not 'Yes'", async () => {
      showWarningResult = "Cancel";

      await removeCmd.execute(mockRepository as Repository);

      assert.strictEqual(removeUnversionedCalls, 0);
    });

    test("handles repository operation errors", async () => {
      showWarningResult = "Yes";

      mockRepository.removeUnversioned = async () => {
        throw new Error("SVN cleanup failed");
      };

      let errorThrown = false;
      try {
        await removeCmd.execute(mockRepository as Repository);
      } catch (error) {
        errorThrown = true;
      }

      assert.ok(errorThrown, "Should propagate repository errors");
    });
  });

  suite("Edge Cases & Integration", () => {
    test("DeleteUnversioned handles empty resource list", async () => {
      const deleteCmd = new DeleteUnversioned();

      (deleteCmd as any).getResourceStatesOrExit = async () => null;

      await deleteCmd.execute();

      assert.strictEqual(showWarningCalls.length, 0);

      deleteCmd.dispose();
    });

    test("DeleteUnversioned processes files sequentially", async () => {
      const deleteCmd = new DeleteUnversioned();
      const processOrder: string[] = [];

      const file1Uri = Uri.file("/workspace/file1.txt");
      const file2Uri = Uri.file("/workspace/file2.txt");
      const resource1 = new Resource(file1Uri, Status.UNVERSIONED);
      const resource2 = new Resource(file2Uri, Status.UNVERSIONED);

      showWarningResult = "Yes";
      existsResult = true;
      lstatResult = { isDirectory: () => false };

      (fs as any).unlink = async (path: string) => {
        processOrder.push(path);
        await new Promise(resolve => setTimeout(resolve, 10));
      };

      (deleteCmd as any).getResourceStatesOrExit = async () => [
        resource1,
        resource2
      ];

      await deleteCmd.execute(resource1, resource2);

      assert.strictEqual(processOrder.length, 2);
      assert.strictEqual(processOrder[0], "/workspace/file1.txt");
      assert.strictEqual(processOrder[1], "/workspace/file2.txt");

      deleteCmd.dispose();
    });

    test("DeleteUnversioned preserves file paths with spaces", async () => {
      const deleteCmd = new DeleteUnversioned();

      const fileUri = Uri.file("/workspace/file with spaces.txt");
      const resource = new Resource(fileUri, Status.UNVERSIONED);

      showWarningResult = "Yes";
      existsResult = true;
      lstatResult = { isDirectory: () => false };

      (deleteCmd as any).getResourceStatesOrExit = async () => [resource];

      await deleteCmd.execute(resource);

      assert.strictEqual(unlinkCalls.length, 1);
      assert.strictEqual(unlinkCalls[0], "/workspace/file with spaces.txt");

      deleteCmd.dispose();
    });

    test("RemoveUnversioned warning emphasizes destructive action", async () => {
      const removeCmd = new RemoveUnversioned();
      const mockRepo: Partial<Repository> = {
        removeUnversioned: async () => "Done"
      };

      showWarningResult = "Yes";

      await removeCmd.execute(mockRepo as Repository);

      const message = showWarningCalls[0].message;
      assert.ok(message.includes("Are you sure?"));
      assert.ok(message.toLowerCase().includes("remove"));

      removeCmd.dispose();
    });
  });
});
