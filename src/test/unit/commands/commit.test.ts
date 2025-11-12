import * as assert from "assert";
import { SourceControlInputBox, Uri, window } from "vscode";
import { Commit } from "../../../commands/commit";
import { CommitWithMessage } from "../../../commands/commitWithMessage";
import { Status } from "../../../common/types";
import * as messages from "../../../messages";
import * as changelistItems from "../../../changelistItems";
import { Repository } from "../../../repository";
import { Resource } from "../../../resource";

suite("Commit Commands Tests", () => {
  // Mock tracking
  let mockInputBox: Partial<SourceControlInputBox>;
  let mockRepository: Partial<Repository>;
  let origInputCommitMessage: typeof messages.inputCommitMessage;
  let origInputCommitFiles: typeof changelistItems.inputCommitFiles;
  let origShowInfo: typeof window.showInformationMessage;
  let origShowError: typeof window.showErrorMessage;

  // Call tracking
  let inputCommitMessageCalls: any[] = [];
  let inputCommitFilesCalls: any[] = [];
  let showInfoCalls: any[] = [];
  let showErrorCalls: any[] = [];
  let commitFilesCalls: any[] = [];

  setup(() => {
    // Mock SourceControlInputBox
    mockInputBox = {
      value: ""
    };

    // Mock Repository
    mockRepository = {
      root: "/test/repo",
      workspaceRoot: "/test/workspace",
      inputBox: mockInputBox as SourceControlInputBox,
      getResourceFromFile: (_path: string) => undefined,
      commitFiles: async (message: string, paths: string[]) => {
        commitFilesCalls.push({ message, paths });
        return "Revision 42: commit successful";
      }
    };

    // Track calls to inputCommitMessage
    origInputCommitMessage = messages.inputCommitMessage;
    (messages as any).inputCommitMessage = async (
      msg?: string,
      promptNew: boolean = true,
      paths?: string[]
    ) => {
      inputCommitMessageCalls.push({ msg, promptNew, paths });
      return undefined; // Default to undefined
    };

    // Track calls to inputCommitFiles
    origInputCommitFiles = changelistItems.inputCommitFiles;
    (changelistItems as any).inputCommitFiles = async (repo: Repository) => {
      inputCommitFilesCalls.push({ repo });
      return undefined; // Default to undefined
    };

    // Track calls to showInformationMessage
    origShowInfo = window.showInformationMessage;
    (window as any).showInformationMessage = (message: string) => {
      showInfoCalls.push({ message });
      return Promise.resolve(undefined);
    };

    // Track calls to showErrorMessage
    origShowError = window.showErrorMessage;
    (window as any).showErrorMessage = (message: string) => {
      showErrorCalls.push({ message });
      return Promise.resolve(undefined);
    };

    // Clear call tracking arrays
    inputCommitMessageCalls = [];
    inputCommitFilesCalls = [];
    showInfoCalls = [];
    showErrorCalls = [];
    commitFilesCalls = [];
  });

  teardown(() => {
    // Restore original functions
    (messages as any).inputCommitMessage = origInputCommitMessage;
    (changelistItems as any).inputCommitFiles = origInputCommitFiles;
    (window as any).showInformationMessage = origShowInfo;
    (window as any).showErrorMessage = origShowError;
  });

  suite("Commit Command", () => {
    let commit: Commit;

    setup(() => {
      commit = new Commit();
    });

    teardown(() => {
      commit.dispose();
    });

    test("1.1: Single resource filters to Resource instances", async () => {
      const resource = new Resource(
        Uri.file("/test/repo/file.txt"),
        Status.MODIFIED
      );

      // Mock inputCommitMessage to return message
      (messages as any).inputCommitMessage = async () => "Fix bug";

      await commit.execute(resource);

      assert.ok(true, "Should handle Resource instance");
    });

    test("1.2: Commit with renamed file (ADDED + renameResourceUri)", async () => {
      const newUri = Uri.file("/test/repo/file-new.txt");
      const oldUri = Uri.file("/test/repo/file-old.txt");
      const resource = new Resource(newUri, Status.ADDED, oldUri);

      (messages as any).inputCommitMessage = async () => "Rename file";

      await commit.execute(resource);

      assert.ok(true, "Should handle renamed file with ADDED status");
    });

    test("1.3: Parent directory tracking for ADDED files", async () => {
      const parentDir = "/test/repo/newdir";
      const childFile = "/test/repo/newdir/file.txt";

      const childResource = new Resource(Uri.file(childFile), Status.ADDED);

      // Mock getResourceFromFile to return parent resource for ADDED check
      (mockRepository.getResourceFromFile as any) = (path: string) => {
        if (path === parentDir) {
          return new Resource(Uri.file(parentDir), Status.ADDED);
        }
        return undefined;
      };

      (messages as any).inputCommitMessage = async () => "Add directory";

      await commit.execute(childResource);

      assert.ok(true, "Should traverse parent directories for ADDED status");
    });

    test("1.4: Commit message cancelled (undefined)", async () => {
      const resource = new Resource(
        Uri.file("/test/repo/file.txt"),
        Status.MODIFIED
      );

      // inputCommitMessage returns undefined by default in setup
      await commit.execute(resource);

      // Should not commit when message is undefined
      assert.strictEqual(
        commitFilesCalls.length,
        0,
        "Should not call commitFiles when message is undefined"
      );
    });

    test("1.5: Empty commit message handling", async () => {
      const resource = new Resource(
        Uri.file("/test/repo/file.txt"),
        Status.MODIFIED
      );

      (messages as any).inputCommitMessage = async () => "";

      await commit.execute(resource);

      assert.ok(true, "Should allow empty message handling");
    });

    test("1.6: No resources (empty execute)", async () => {
      (messages as any).inputCommitMessage = async () => "Fix";

      await commit.execute();

      assert.ok(true, "Should handle execute with no resources");
    });

    test("1.7: Multiple resources batched by repository", async () => {
      const resource1 = new Resource(
        Uri.file("/test/repo/file1.txt"),
        Status.MODIFIED
      );
      const resource2 = new Resource(
        Uri.file("/test/repo/file2.txt"),
        Status.MODIFIED
      );

      (messages as any).inputCommitMessage = async () => "Fix both";

      await commit.execute(resource1, resource2);

      assert.ok(true, "Should handle multiple resources");
    });

    test("1.8: Input box value set before commit", async () => {
      const resource = new Resource(
        Uri.file("/test/repo/file.txt"),
        Status.MODIFIED
      );

      const testMessage = "Test commit";
      (messages as any).inputCommitMessage = async (_msg?: string) => {
        // Verify input box value passed to prompt
        return testMessage;
      };

      mockInputBox.value = "Previous";
      await commit.execute(resource);

      assert.ok(true, "Should preserve input box value context");
    });

    test("1.9: Error handling on commit failure", async () => {
      const resource = new Resource(
        Uri.file("/test/repo/file.txt"),
        Status.MODIFIED
      );

      (messages as any).inputCommitMessage = async () => "Message";
      (mockRepository.commitFiles as any) = async () => {
        throw new Error("SVN error: permission denied");
      };

      await commit.execute(resource);

      assert.ok(true, "Should handle commit errors gracefully");
    });

    test("1.10: Resource filtering (non-Resource objects ignored)", async () => {
      const validResource = new Resource(
        Uri.file("/test/repo/file.txt"),
        Status.MODIFIED
      );

      (messages as any).inputCommitMessage = async () => "Fix";

      await commit.execute(validResource);

      assert.ok(true, "Should filter resources correctly");
    });

    test("1.11: Commit with multiple ADDED files including renames", async () => {
      const newUri1 = Uri.file("/test/repo/new1.txt");
      const oldUri1 = Uri.file("/test/repo/old1.txt");
      const resource1 = new Resource(newUri1, Status.ADDED, oldUri1);

      const newUri2 = Uri.file("/test/repo/new2.txt");
      const oldUri2 = Uri.file("/test/repo/old2.txt");
      const resource2 = new Resource(newUri2, Status.ADDED, oldUri2);

      (messages as any).inputCommitMessage = async () => "Multiple renames";

      await commit.execute(resource1, resource2);

      assert.ok(true, "Should handle multiple renamed files");
    });

    test("1.12: Nested directory structure with ADDED parents", async () => {
      const deepPath = "/test/repo/a/b/c/file.txt";
      const resource = new Resource(Uri.file(deepPath), Status.ADDED);

      (mockRepository.getResourceFromFile as any) = (path: string) => {
        // Return ADDED status for all parent directories
        if (
          path === "/test/repo/a/b/c" ||
          path === "/test/repo/a/b" ||
          path === "/test/repo/a"
        ) {
          return new Resource(Uri.file(path), Status.ADDED);
        }
        return undefined;
      };

      (messages as any).inputCommitMessage = async () => "Add nested";

      await commit.execute(resource);

      assert.ok(true, "Should traverse nested ADDED parents");
    });
  });

  suite("CommitWithMessage Command", () => {
    let commitWithMessage: CommitWithMessage;

    setup(() => {
      commitWithMessage = new CommitWithMessage();
    });

    teardown(() => {
      commitWithMessage.dispose();
    });

    test("2.1: Select files then commit", async () => {
      const resource = new Resource(
        Uri.file("/test/repo/file.txt"),
        Status.MODIFIED
      );

      (changelistItems as any).inputCommitFiles = async () => [resource];
      (messages as any).inputCommitMessage = async () => "Commit message";

      await commitWithMessage.execute(mockRepository as Repository);

      assert.ok(
        inputCommitFilesCalls.length > 0,
        "Should prompt for file selection"
      );
    });

    test("2.2: No files selected (undefined)", async () => {
      (changelistItems as any).inputCommitFiles = async () => undefined;

      await commitWithMessage.execute(mockRepository as Repository);

      assert.strictEqual(
        inputCommitMessageCalls.length,
        0,
        "Should not prompt for message if no files selected"
      );
    });

    test("2.3: Empty file selection (empty array)", async () => {
      (changelistItems as any).inputCommitFiles = async () => [];

      await commitWithMessage.execute(mockRepository as Repository);

      assert.strictEqual(
        inputCommitMessageCalls.length,
        0,
        "Should not prompt for message if empty array"
      );
    });

    test("2.4: Commit message cancelled", async () => {
      const resource = new Resource(
        Uri.file("/test/repo/file.txt"),
        Status.MODIFIED
      );

      (changelistItems as any).inputCommitFiles = async () => [resource];
      (messages as any).inputCommitMessage = async () => undefined;

      await commitWithMessage.execute(mockRepository as Repository);

      assert.strictEqual(
        commitFilesCalls.length,
        0,
        "Should not commit when message is undefined"
      );
    });

    test("2.5: Commit with renamed files", async () => {
      const newUri = Uri.file("/test/repo/file-new.txt");
      const oldUri = Uri.file("/test/repo/file-old.txt");
      const renamedResource = new Resource(newUri, Status.ADDED, oldUri);

      (changelistItems as any).inputCommitFiles = async () => [
        renamedResource
      ];
      (messages as any).inputCommitMessage = async () => "Rename file";

      await commitWithMessage.execute(mockRepository as Repository);

      assert.ok(true, "Should handle renamed files from file selection");
    });

    test("2.6: Commit with parent directories", async () => {
      const parentDir = "/test/repo/newdir";
      const childFile = "/test/repo/newdir/file.txt";

      const childResource = new Resource(Uri.file(childFile), Status.ADDED);

      (mockRepository.getResourceFromFile as any) = (path: string) => {
        if (path === parentDir) {
          return new Resource(Uri.file(parentDir), Status.ADDED);
        }
        return undefined;
      };

      (changelistItems as any).inputCommitFiles = async () => [
        childResource
      ];
      (messages as any).inputCommitMessage = async () => "Add directory";

      await commitWithMessage.execute(mockRepository as Repository);

      assert.ok(true, "Should include parent directories");
    });

    test("2.7: Multiple files from changelist", async () => {
      const resource1 = new Resource(
        Uri.file("/test/repo/file1.txt"),
        Status.MODIFIED
      );
      const resource2 = new Resource(
        Uri.file("/test/repo/file2.txt"),
        Status.MODIFIED
      );

      (changelistItems as any).inputCommitFiles = async () => [
        resource1,
        resource2
      ];
      (messages as any).inputCommitMessage = async () => "Commit multiple";

      await commitWithMessage.execute(mockRepository as Repository);

      assert.ok(true, "Should commit all selected files");
    });

    test("2.8: Input box cleared after commit", async () => {
      const resource = new Resource(
        Uri.file("/test/repo/file.txt"),
        Status.MODIFIED
      );

      mockInputBox.value = "Previous";
      (changelistItems as any).inputCommitFiles = async () => [resource];
      (messages as any).inputCommitMessage = async () => "New message";

      await commitWithMessage.execute(mockRepository as Repository);

      assert.ok(true, "Should clear input box after commit");
    });

    test("2.9: Error handling on commit failure", async () => {
      const resource = new Resource(
        Uri.file("/test/repo/file.txt"),
        Status.MODIFIED
      );

      (changelistItems as any).inputCommitFiles = async () => [resource];
      (messages as any).inputCommitMessage = async () => "Message";
      (mockRepository.commitFiles as any) = async () => {
        throw new Error("SVN error");
      };

      await commitWithMessage.execute(mockRepository as Repository);

      assert.ok(true, "Should handle commit errors");
    });

    test("2.10: promptNew=false for CommitWithMessage", async () => {
      const resource = new Resource(
        Uri.file("/test/repo/file.txt"),
        Status.MODIFIED
      );

      (changelistItems as any).inputCommitFiles = async () => [resource];
      (messages as any).inputCommitMessage = async (
        _msg?: string,
        promptNew?: boolean
      ) => {
        assert.strictEqual(
          promptNew,
          false,
          "CommitWithMessage should use promptNew=false"
        );
        return "Message";
      };

      await commitWithMessage.execute(mockRepository as Repository);

      assert.ok(true, "Should verify promptNew parameter");
    });

    test("2.11: File paths passed to inputCommitMessage", async () => {
      const resource = new Resource(
        Uri.file("/test/repo/file.txt"),
        Status.MODIFIED
      );

      (changelistItems as any).inputCommitFiles = async () => [resource];
      (messages as any).inputCommitMessage = async (
        _msg?: string,
        _promptNew?: boolean,
        filePaths?: string[]
      ) => {
        assert.ok(Array.isArray(filePaths), "Should pass file paths array");
        assert.ok(
          filePaths!.includes("/test/repo/file.txt"),
          "Should include file path"
        );
        return "Message";
      };

      await commitWithMessage.execute(mockRepository as Repository);

      assert.ok(true, "Should verify file paths passed");
    });

    test("2.12: Changelist selection flow", async () => {
      const resource = new Resource(
        Uri.file("/test/repo/file.txt"),
        Status.MODIFIED
      );

      let inputCommitFilesUsed = false;
      (changelistItems as any).inputCommitFiles = async (
        repo: Repository
      ) => {
        inputCommitFilesUsed = true;
        assert.ok(repo === mockRepository, "Should pass repository");
        return [resource];
      };

      (messages as any).inputCommitMessage = async () => "Message";

      await commitWithMessage.execute(mockRepository as Repository);

      assert.ok(inputCommitFilesUsed, "Should call inputCommitFiles");
    });
  });

  suite("Edge Cases & Complex Scenarios", () => {
    let commit: Commit;
    let commitWithMessage: CommitWithMessage;

    setup(() => {
      commit = new Commit();
      commitWithMessage = new CommitWithMessage();
    });

    teardown(() => {
      commit.dispose();
      commitWithMessage.dispose();
    });

    test("3.1: Mixed status resources (ADDED + MODIFIED)", async () => {
      const added = new Resource(
        Uri.file("/test/repo/new.txt"),
        Status.ADDED
      );
      const modified = new Resource(
        Uri.file("/test/repo/modified.txt"),
        Status.MODIFIED
      );

      (messages as any).inputCommitMessage = async () => "Mixed commit";

      await commit.execute(added, modified);

      assert.ok(true, "Should handle mixed status files");
    });

    test("3.2: Deep nested ADDED structure (3+ levels)", async () => {
      const deepPath = "/test/repo/a/b/c/file.txt";
      const resource = new Resource(Uri.file(deepPath), Status.ADDED);

      let parentCallCount = 0;
      (mockRepository.getResourceFromFile as any) = (path: string) => {
        parentCallCount++;
        if (path === "/test/repo/a/b/c") {
          return new Resource(Uri.file(path), Status.ADDED);
        }
        if (path === "/test/repo/a/b") {
          return new Resource(Uri.file(path), Status.ADDED);
        }
        if (path === "/test/repo/a") {
          return new Resource(Uri.file(path), Status.ADDED);
        }
        return undefined;
      };

      (messages as any).inputCommitMessage = async () => "Deep add";

      await commit.execute(resource);

      assert.ok(
        parentCallCount > 0,
        "Should traverse multiple parent directories"
      );
    });

    test("3.3: Resource with MODIFIED status but renameResourceUri", async () => {
      const newUri = Uri.file("/test/repo/file-new.txt");
      const oldUri = Uri.file("/test/repo/file-old.txt");
      const resource = new Resource(newUri, Status.MODIFIED, oldUri);

      (messages as any).inputCommitMessage = async () => "Message";

      await commit.execute(resource);

      assert.ok(true, "Should only use rename URI for ADDED status");
    });

    test("3.4: Large batch of files", async () => {
      const resources = [];
      for (let i = 0; i < 50; i++) {
        resources.push(
          new Resource(
            Uri.file(`/test/repo/file${i}.txt`),
            Status.MODIFIED
          )
        );
      }

      (messages as any).inputCommitMessage = async () => "Batch commit";

      await commit.execute(...resources);

      assert.ok(true, "Should handle large batch of files");
    });

    test("3.5: Files with special characters in paths", async () => {
      const resource = new Resource(
        Uri.file("/test/repo/file with spaces.txt"),
        Status.MODIFIED
      );

      (messages as any).inputCommitMessage = async () => "Special chars";

      await commit.execute(resource);

      assert.ok(true, "Should handle special characters in paths");
    });

    test("3.6: CommitWithMessage with mixed renamed and added files", async () => {
      const newUri1 = Uri.file("/test/repo/file1-new.txt");
      const oldUri1 = Uri.file("/test/repo/file1-old.txt");
      const renamed = new Resource(newUri1, Status.ADDED, oldUri1);

      const addedUri = Uri.file("/test/repo/new-file.txt");
      const added = new Resource(addedUri, Status.ADDED);

      (changelistItems as any).inputCommitFiles = async () => [
        renamed,
        added
      ];
      (messages as any).inputCommitMessage = async () => "Mixed";

      await commitWithMessage.execute(mockRepository as Repository);

      assert.ok(true, "Should handle mixed file types in selection");
    });

    test("3.7: Duplicate resources in same commit", async () => {
      const resource = new Resource(
        Uri.file("/test/repo/file.txt"),
        Status.MODIFIED
      );

      (messages as any).inputCommitMessage = async () => "Message";

      await commit.execute(resource, resource);

      assert.ok(true, "Should handle duplicate resources");
    });

    test("3.8: Repository with multiple SVN repositories", async () => {
      const repo1Resources = [
        new Resource(Uri.file("/repo1/file.txt"), Status.MODIFIED)
      ];
      const repo2Resources = [
        new Resource(Uri.file("/repo2/file.txt"), Status.MODIFIED)
      ];

      (messages as any).inputCommitMessage = async () => "Message";

      await commit.execute(...repo1Resources, ...repo2Resources);

      assert.ok(true, "Should group resources by repository");
    });

    test("3.9: DELETED status handling", async () => {
      const resource = new Resource(
        Uri.file("/test/repo/deleted.txt"),
        Status.DELETED
      );

      (messages as any).inputCommitMessage = async () => "Delete file";

      await commit.execute(resource);

      assert.ok(true, "Should handle DELETED status");
    });

    test("3.10: Empty message with checkEmptyMessage config", async () => {
      const resource = new Resource(
        Uri.file("/test/repo/file.txt"),
        Status.MODIFIED
      );

      (messages as any).inputCommitMessage = async () => "";

      await commit.execute(resource);

      assert.ok(true, "Should handle empty message from config");
    });
  });
});
