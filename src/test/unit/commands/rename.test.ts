import * as assert from "assert";
import { Uri, window } from "vscode";
import { RenameExplorer } from "../../../commands/renameExplorer";
import { Repository } from "../../../repository";

suite("RenameExplorer Command Tests", () => {
  let renameExplorer: RenameExplorer;
  let mockRepository: Partial<Repository>;
  let origShowInputBox: typeof window.showInputBox;

  // Call tracking
  let showInputBoxCalls: Array<{ value: string; prompt: string }>;
  let renameCalls: Array<{ oldFile: string; newFile: string }>;
  let showInputBoxResult: string | undefined;

  setup(() => {
    renameExplorer = new RenameExplorer();

    // Reset tracking
    showInputBoxCalls = [];
    renameCalls = [];
    showInputBoxResult = undefined;

    // Mock Repository
    mockRepository = {
      root: "/test/repo",
      workspaceRoot: "/test/workspace",
      rename: async (oldFile: string, newFile: string) => {
        renameCalls.push({ oldFile, newFile });
        return "Renamed successfully";
      }
    };

    // Mock window.showInputBox
    origShowInputBox = window.showInputBox;
    (window as any).showInputBox = async (options: any) => {
      showInputBoxCalls.push({ value: options.value, prompt: options.prompt });
      return showInputBoxResult;
    };
  });

  teardown(() => {
    renameExplorer.dispose();
    (window as any).showInputBox = origShowInputBox;
  });

  suite("Basic Rename Operations", () => {
    test("1.1: Rename file in root directory", async () => {
      const oldUri = Uri.file("/test/workspace/file.txt");
      showInputBoxResult = "newfile.txt";

      await renameExplorer.execute(
        mockRepository as Repository,
        oldUri,
        undefined
      );

      assert.strictEqual(showInputBoxCalls.length, 1);
      assert.strictEqual(showInputBoxCalls[0]!.value, "file.txt");
      assert.strictEqual(renameCalls.length, 1);
      assert.strictEqual(renameCalls[0]!.oldFile, "/test/workspace/file.txt");
      assert.strictEqual(
        renameCalls[0]!.newFile,
        "/test/workspace/newfile.txt"
      );
    });

    test("1.2: Rename file in subdirectory", async () => {
      const oldUri = Uri.file("/test/workspace/subdir/file.txt");
      showInputBoxResult = "renamed.txt";

      await renameExplorer.execute(
        mockRepository as Repository,
        oldUri,
        undefined
      );

      assert.strictEqual(showInputBoxCalls.length, 1);
      assert.strictEqual(showInputBoxCalls[0]!.value, "file.txt");
      assert.strictEqual(renameCalls.length, 1);
      assert.strictEqual(
        renameCalls[0]!.oldFile,
        "/test/workspace/subdir/file.txt"
      );
      assert.strictEqual(
        renameCalls[0]!.newFile,
        "/test/workspace/subdir/renamed.txt"
      );
    });

    test("1.3: Rename file with extension change", async () => {
      const oldUri = Uri.file("/test/workspace/file.txt");
      showInputBoxResult = "file.md";

      await renameExplorer.execute(
        mockRepository as Repository,
        oldUri,
        undefined
      );

      assert.strictEqual(renameCalls.length, 1);
      assert.strictEqual(renameCalls[0]!.oldFile, "/test/workspace/file.txt");
      assert.strictEqual(renameCalls[0]!.newFile, "/test/workspace/file.md");
    });

    test("1.4: Rename file without extension", async () => {
      const oldUri = Uri.file("/test/workspace/README");
      showInputBoxResult = "LICENSE";

      await renameExplorer.execute(
        mockRepository as Repository,
        oldUri,
        undefined
      );

      assert.strictEqual(showInputBoxCalls.length, 1);
      assert.strictEqual(showInputBoxCalls[0]!.value, "README");
      assert.strictEqual(renameCalls.length, 1);
      assert.strictEqual(renameCalls[0]!.oldFile, "/test/workspace/README");
      assert.strictEqual(renameCalls[0]!.newFile, "/test/workspace/LICENSE");
    });

    test("1.5: Rename directory", async () => {
      const oldUri = Uri.file("/test/workspace/olddir");
      showInputBoxResult = "newdir";

      await renameExplorer.execute(
        mockRepository as Repository,
        oldUri,
        undefined
      );

      assert.strictEqual(showInputBoxCalls.length, 1);
      assert.strictEqual(showInputBoxCalls[0]!.value, "olddir");
      assert.strictEqual(renameCalls.length, 1);
      assert.strictEqual(renameCalls[0]!.oldFile, "/test/workspace/olddir");
      assert.strictEqual(renameCalls[0]!.newFile, "/test/workspace/newdir");
    });

    test("1.6: Rename nested directory", async () => {
      const oldUri = Uri.file("/test/workspace/parent/child");
      showInputBoxResult = "renamed-child";

      await renameExplorer.execute(
        mockRepository as Repository,
        oldUri,
        undefined
      );

      assert.strictEqual(renameCalls.length, 1);
      assert.strictEqual(
        renameCalls[0]!.oldFile,
        "/test/workspace/parent/child"
      );
      assert.strictEqual(
        renameCalls[0]!.newFile,
        "/test/workspace/parent/renamed-child"
      );
    });

    test("1.7: Rename deeply nested file", async () => {
      const oldUri = Uri.file("/test/workspace/a/b/c/d/file.txt");
      showInputBoxResult = "newfile.txt";

      await renameExplorer.execute(
        mockRepository as Repository,
        oldUri,
        undefined
      );

      assert.strictEqual(showInputBoxCalls.length, 1);
      assert.strictEqual(renameCalls.length, 1);
      assert.strictEqual(
        renameCalls[0]!.oldFile,
        "/test/workspace/a/b/c/d/file.txt"
      );
      assert.strictEqual(
        renameCalls[0]!.newFile,
        "/test/workspace/a/b/c/d/newfile.txt"
      );
    });
  });

  suite("Path Validation", () => {
    test("2.1: New name stays in same directory", async () => {
      const oldUri = Uri.file("/test/workspace/subdir/file.txt");
      showInputBoxResult = "newfile.txt";

      await renameExplorer.execute(
        mockRepository as Repository,
        oldUri,
        undefined
      );

      assert.strictEqual(renameCalls.length, 1);
      assert.strictEqual(
        renameCalls[0]!.newFile,
        "/test/workspace/subdir/newfile.txt"
      );
    });

    test("2.2: New name with relative path components", async () => {
      const oldUri = Uri.file("/test/workspace/file.txt");
      showInputBoxResult = "./newfile.txt";

      await renameExplorer.execute(
        mockRepository as Repository,
        oldUri,
        undefined
      );

      assert.strictEqual(renameCalls.length, 1);
      // Path.join will resolve the relative path
      assert.ok(renameCalls[0]!.newFile.includes("newfile.txt"));
    });

    test("2.3: Input box shows basename only", async () => {
      const oldUri = Uri.file("/test/workspace/very/deep/path/file.txt");
      showInputBoxResult = "renamed.txt";

      await renameExplorer.execute(
        mockRepository as Repository,
        oldUri,
        undefined
      );

      assert.strictEqual(showInputBoxCalls.length, 1);
      assert.strictEqual(showInputBoxCalls[0]!.value, "file.txt");
    });

    test("2.4: Input box shows relative path in prompt", async () => {
      const oldUri = Uri.file("/test/workspace/subdir/file.txt");
      showInputBoxResult = "renamed.txt";

      await renameExplorer.execute(
        mockRepository as Repository,
        oldUri,
        undefined
      );

      assert.strictEqual(showInputBoxCalls.length, 1);
      assert.ok(
        showInputBoxCalls[0]!.prompt.includes("subdir/file.txt") ||
          showInputBoxCalls[0]!.prompt.includes("subdir\\file.txt")
      );
    });

    test("2.5: Preserve path separators in new path", async () => {
      const oldUri = Uri.file("/test/workspace/subdir/file.txt");
      showInputBoxResult = "renamed.txt";

      await renameExplorer.execute(
        mockRepository as Repository,
        oldUri,
        undefined
      );

      assert.strictEqual(renameCalls.length, 1);
      assert.ok(renameCalls[0]!.newFile.includes("subdir"));
      assert.ok(renameCalls[0]!.newFile.includes("renamed.txt"));
    });
  });

  suite("User Cancellation", () => {
    test("3.1: Cancel rename when input box returns undefined", async () => {
      const oldUri = Uri.file("/test/workspace/file.txt");
      showInputBoxResult = undefined;

      await renameExplorer.execute(
        mockRepository as Repository,
        oldUri,
        undefined
      );

      assert.strictEqual(showInputBoxCalls.length, 1);
      assert.strictEqual(renameCalls.length, 0, "Should not call rename");
    });

    test("3.2: Cancel rename when input box returns empty string", async () => {
      const oldUri = Uri.file("/test/workspace/file.txt");
      showInputBoxResult = "";

      await renameExplorer.execute(
        mockRepository as Repository,
        oldUri,
        undefined
      );

      assert.strictEqual(showInputBoxCalls.length, 1);
      assert.strictEqual(renameCalls.length, 0, "Should not call rename");
    });

    test("3.3: No operation when mainUri is undefined", async () => {
      await renameExplorer.execute(
        mockRepository as Repository,
        undefined,
        undefined
      );

      assert.strictEqual(showInputBoxCalls.length, 0);
      assert.strictEqual(renameCalls.length, 0);
    });

    test("3.4: No operation when mainUri is null", async () => {
      await renameExplorer.execute(
        mockRepository as Repository,
        null as any,
        undefined
      );

      assert.strictEqual(showInputBoxCalls.length, 0);
      assert.strictEqual(renameCalls.length, 0);
    });
  });

  suite("Error Handling", () => {
    test("4.1: Handle repository.rename error", async () => {
      const oldUri = Uri.file("/test/workspace/file.txt");
      showInputBoxResult = "newfile.txt";

      (mockRepository.rename as any) = async () => {
        throw new Error("SVN error: file is locked");
      };

      try {
        await renameExplorer.execute(
          mockRepository as Repository,
          oldUri,
          undefined
        );
        assert.fail("Should have thrown error");
      } catch (err: any) {
        assert.ok(err.message.includes("file is locked"));
      }

      assert.strictEqual(showInputBoxCalls.length, 1);
    });

    test("4.2: Handle repository.rename permission error", async () => {
      const oldUri = Uri.file("/test/workspace/file.txt");
      showInputBoxResult = "newfile.txt";

      (mockRepository.rename as any) = async () => {
        throw new Error("SVN error: permission denied");
      };

      try {
        await renameExplorer.execute(
          mockRepository as Repository,
          oldUri,
          undefined
        );
        assert.fail("Should have thrown error");
      } catch (err: any) {
        assert.ok(err.message.includes("permission denied"));
      }
    });

    test("4.3: Handle repository.rename conflict error", async () => {
      const oldUri = Uri.file("/test/workspace/file.txt");
      showInputBoxResult = "existing.txt";

      (mockRepository.rename as any) = async () => {
        throw new Error("SVN error: destination already exists");
      };

      try {
        await renameExplorer.execute(
          mockRepository as Repository,
          oldUri,
          undefined
        );
        assert.fail("Should have thrown error");
      } catch (err: any) {
        assert.ok(err.message.includes("already exists"));
      }
    });

    test("4.4: Handle invalid path error", async () => {
      const oldUri = Uri.file("/test/workspace/file.txt");
      showInputBoxResult = "newfile.txt";

      (mockRepository.rename as any) = async () => {
        throw new Error("SVN error: invalid path");
      };

      try {
        await renameExplorer.execute(
          mockRepository as Repository,
          oldUri,
          undefined
        );
        assert.fail("Should have thrown error");
      } catch (err: any) {
        assert.ok(err.message.includes("invalid path"));
      }
    });
  });

  suite("Special Characters & Edge Cases", () => {
    test("5.1: Rename file with spaces", async () => {
      const oldUri = Uri.file("/test/workspace/old name.txt");
      showInputBoxResult = "new name.txt";

      await renameExplorer.execute(
        mockRepository as Repository,
        oldUri,
        undefined
      );

      assert.strictEqual(showInputBoxCalls.length, 1);
      assert.strictEqual(showInputBoxCalls[0]!.value, "old name.txt");
      assert.strictEqual(renameCalls.length, 1);
      assert.ok(renameCalls[0]!.newFile.includes("new name.txt"));
    });

    test("5.2: Rename file with special characters", async () => {
      const oldUri = Uri.file("/test/workspace/file(1).txt");
      showInputBoxResult = "file(2).txt";

      await renameExplorer.execute(
        mockRepository as Repository,
        oldUri,
        undefined
      );

      assert.strictEqual(showInputBoxCalls.length, 1);
      assert.strictEqual(showInputBoxCalls[0]!.value, "file(1).txt");
      assert.strictEqual(renameCalls.length, 1);
      assert.ok(renameCalls[0]!.newFile.includes("file(2).txt"));
    });

    test("5.3: Rename file with dots", async () => {
      const oldUri = Uri.file("/test/workspace/file.old.txt");
      showInputBoxResult = "file.new.txt";

      await renameExplorer.execute(
        mockRepository as Repository,
        oldUri,
        undefined
      );

      assert.strictEqual(showInputBoxCalls.length, 1);
      assert.strictEqual(showInputBoxCalls[0]!.value, "file.old.txt");
      assert.strictEqual(renameCalls.length, 1);
      assert.ok(renameCalls[0]!.newFile.includes("file.new.txt"));
    });

    test("5.4: Rename file with unicode characters", async () => {
      const oldUri = Uri.file("/test/workspace/文件.txt");
      showInputBoxResult = "新文件.txt";

      await renameExplorer.execute(
        mockRepository as Repository,
        oldUri,
        undefined
      );

      assert.strictEqual(showInputBoxCalls.length, 1);
      assert.strictEqual(showInputBoxCalls[0]!.value, "文件.txt");
      assert.strictEqual(renameCalls.length, 1);
      assert.ok(renameCalls[0]!.newFile.includes("新文件.txt"));
    });

    test("5.5: Rename file with dashes and underscores", async () => {
      const oldUri = Uri.file("/test/workspace/old-file_name.txt");
      showInputBoxResult = "new-file_name.txt";

      await renameExplorer.execute(
        mockRepository as Repository,
        oldUri,
        undefined
      );

      assert.strictEqual(showInputBoxCalls.length, 1);
      assert.strictEqual(showInputBoxCalls[0]!.value, "old-file_name.txt");
      assert.strictEqual(renameCalls.length, 1);
      assert.ok(renameCalls[0]!.newFile.includes("new-file_name.txt"));
    });

    test("5.6: Same name rename (no change)", async () => {
      const oldUri = Uri.file("/test/workspace/file.txt");
      showInputBoxResult = "file.txt";

      await renameExplorer.execute(
        mockRepository as Repository,
        oldUri,
        undefined
      );

      assert.strictEqual(renameCalls.length, 1);
      assert.strictEqual(renameCalls[0]!.oldFile, "/test/workspace/file.txt");
      assert.strictEqual(renameCalls[0]!.newFile, "/test/workspace/file.txt");
    });

    test("5.7: Case-only rename", async () => {
      const oldUri = Uri.file("/test/workspace/file.txt");
      showInputBoxResult = "FILE.txt";

      await renameExplorer.execute(
        mockRepository as Repository,
        oldUri,
        undefined
      );

      assert.strictEqual(renameCalls.length, 1);
      assert.strictEqual(renameCalls[0]!.oldFile, "/test/workspace/file.txt");
      assert.strictEqual(renameCalls[0]!.newFile, "/test/workspace/FILE.txt");
    });

    test("5.8: Whitespace in new name", async () => {
      const oldUri = Uri.file("/test/workspace/file.txt");
      showInputBoxResult = "  newfile.txt  ";

      await renameExplorer.execute(
        mockRepository as Repository,
        oldUri,
        undefined
      );

      assert.strictEqual(renameCalls.length, 1);
      // Path.join will preserve the whitespace
      assert.ok(renameCalls[0]!.newFile.includes("  newfile.txt  "));
    });
  });

  suite("Directory Structure", () => {
    test("6.1: Rename preserves directory structure", async () => {
      const oldUri = Uri.file("/test/workspace/src/components/Button.tsx");
      showInputBoxResult = "IconButton.tsx";

      await renameExplorer.execute(
        mockRepository as Repository,
        oldUri,
        undefined
      );

      assert.strictEqual(renameCalls.length, 1);
      assert.ok(renameCalls[0]!.newFile.includes("src"));
      assert.ok(renameCalls[0]!.newFile.includes("components"));
      assert.ok(renameCalls[0]!.newFile.includes("IconButton.tsx"));
      assert.ok(!renameCalls[0]!.newFile.includes("Button.tsx"));
    });

    test("6.2: Root file rename", async () => {
      const oldUri = Uri.file("/test/workspace/README.md");
      showInputBoxResult = "README.txt";

      await renameExplorer.execute(
        mockRepository as Repository,
        oldUri,
        undefined
      );

      assert.strictEqual(renameCalls.length, 1);
      assert.strictEqual(renameCalls[0]!.oldFile, "/test/workspace/README.md");
      assert.strictEqual(renameCalls[0]!.newFile, "/test/workspace/README.txt");
    });

    test("6.3: Hidden file rename", async () => {
      const oldUri = Uri.file("/test/workspace/.gitignore");
      showInputBoxResult = ".svnignore";

      await renameExplorer.execute(
        mockRepository as Repository,
        oldUri,
        undefined
      );

      assert.strictEqual(showInputBoxCalls.length, 1);
      assert.strictEqual(showInputBoxCalls[0]!.value, ".gitignore");
      assert.strictEqual(renameCalls.length, 1);
      assert.ok(renameCalls[0]!.newFile.includes(".svnignore"));
    });

    test("6.4: Multiple file extensions", async () => {
      const oldUri = Uri.file("/test/workspace/archive.tar.gz");
      showInputBoxResult = "backup.tar.gz";

      await renameExplorer.execute(
        mockRepository as Repository,
        oldUri,
        undefined
      );

      assert.strictEqual(showInputBoxCalls.length, 1);
      assert.strictEqual(showInputBoxCalls[0]!.value, "archive.tar.gz");
      assert.strictEqual(renameCalls.length, 1);
      assert.ok(renameCalls[0]!.newFile.includes("backup.tar.gz"));
    });
  });

  suite("Repository Integration", () => {
    test("7.1: Calls repository.rename with correct paths", async () => {
      const oldUri = Uri.file("/test/workspace/old.txt");
      showInputBoxResult = "new.txt";

      await renameExplorer.execute(
        mockRepository as Repository,
        oldUri,
        undefined
      );

      assert.strictEqual(renameCalls.length, 1);
      assert.strictEqual(renameCalls[0]!.oldFile, "/test/workspace/old.txt");
      assert.strictEqual(renameCalls[0]!.newFile, "/test/workspace/new.txt");
    });

    test("7.2: Repository.rename called exactly once", async () => {
      const oldUri = Uri.file("/test/workspace/file.txt");
      showInputBoxResult = "renamed.txt";

      await renameExplorer.execute(
        mockRepository as Repository,
        oldUri,
        undefined
      );

      assert.strictEqual(renameCalls.length, 1);
    });

    test("7.3: Repository.rename not called on cancellation", async () => {
      const oldUri = Uri.file("/test/workspace/file.txt");
      showInputBoxResult = undefined;

      await renameExplorer.execute(
        mockRepository as Repository,
        oldUri,
        undefined
      );

      assert.strictEqual(renameCalls.length, 0);
    });

    test("7.4: Repository context maintained", async () => {
      const oldUri = Uri.file("/test/workspace/file.txt");
      showInputBoxResult = "renamed.txt";

      let receivedOldFile: string | undefined;
      let receivedNewFile: string | undefined;

      (mockRepository.rename as any) = async (
        oldFile: string,
        newFile: string
      ) => {
        receivedOldFile = oldFile;
        receivedNewFile = newFile;
        renameCalls.push({ oldFile, newFile });
        return "Success";
      };

      await renameExplorer.execute(
        mockRepository as Repository,
        oldUri,
        undefined
      );

      assert.strictEqual(receivedOldFile, "/test/workspace/file.txt");
      assert.strictEqual(receivedNewFile, "/test/workspace/renamed.txt");
    });
  });

  suite("Multiple URI Arguments", () => {
    test("8.1: Ignores allUris parameter", async () => {
      const mainUri = Uri.file("/test/workspace/main.txt");
      const allUris = [
        Uri.file("/test/workspace/file1.txt"),
        Uri.file("/test/workspace/file2.txt")
      ];
      showInputBoxResult = "renamed.txt";

      await renameExplorer.execute(
        mockRepository as Repository,
        mainUri,
        allUris
      );

      assert.strictEqual(renameCalls.length, 1);
      assert.strictEqual(renameCalls[0]!.oldFile, "/test/workspace/main.txt");
      assert.strictEqual(
        renameCalls[0]!.newFile,
        "/test/workspace/renamed.txt"
      );
    });

    test("8.2: Only renames mainUri, not allUris", async () => {
      const mainUri = Uri.file("/test/workspace/main.txt");
      const allUris = [
        Uri.file("/test/workspace/file1.txt"),
        Uri.file("/test/workspace/file2.txt"),
        Uri.file("/test/workspace/file3.txt")
      ];
      showInputBoxResult = "renamed.txt";

      await renameExplorer.execute(
        mockRepository as Repository,
        mainUri,
        allUris
      );

      assert.strictEqual(renameCalls.length, 1, "Should only rename once");
    });
  });
});
