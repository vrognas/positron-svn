import * as assert from "assert";
import { commands, window } from "vscode";
import { Merge } from "../../../commands/merge";
import { IBranchItem, ISvnErrorData } from "../../../common/types";
import * as branch from "../../../helpers/branch";
import { Repository } from "../../../repository";

interface MockState {
  selectBranchResult: IBranchItem | undefined;
  repositoryMergeResult: void | ISvnErrorData | Error;
  currentBranch: string;
  showErrorMessageResult: string | undefined;
  executeCommandCalls: Array<{ command: string }>;
  repositoryMergeCalls: Array<{
    name: string;
    reintegrate: boolean;
    accept_action?: string;
  }>;
}

suite("Merge Command Tests", () => {
  let merge: Merge;
  let mockState: MockState;
  let mockRepository: Partial<Repository>;
  const originalSelectBranch = branch.selectBranch;
  const originalIsTrunk = branch.isTrunk;
  const originalShowErrorMessage = window.showErrorMessage;
  const originalExecuteCommand = commands.executeCommand;

  setup(() => {
    merge = new Merge();
    mockState = {
      selectBranchResult: undefined,
      repositoryMergeResult: undefined,
      currentBranch: "branches/feature",
      showErrorMessageResult: undefined,
      executeCommandCalls: [],
      repositoryMergeCalls: []
    };

    // Mock Repository
    mockRepository = {
      currentBranch: mockState.currentBranch,
      merge: async (
        name: string,
        reintegrate: boolean = false,
        accept_action: string = "postpone"
      ) => {
        mockState.repositoryMergeCalls.push({
          name,
          reintegrate,
          accept_action
        });
        if (mockState.repositoryMergeResult instanceof Error) {
          throw mockState.repositoryMergeResult;
        }
      }
    };

    // Mock selectBranch
    (branch as any).selectBranch = async () => {
      return mockState.selectBranchResult;
    };

    // Mock isTrunk
    (branch as any).isTrunk = (folder: string) => {
      return folder === "trunk" || folder.includes("/trunk");
    };

    // Mock window.showErrorMessage
    (window as any).showErrorMessage = async (
      _message: string,
      ..._items: string[]
    ) => {
      return mockState.showErrorMessageResult;
    };

    // Mock commands.executeCommand
    (commands as any).executeCommand = async (
      command: string,
      ..._args: any[]
    ) => {
      mockState.executeCommandCalls.push({ command });
    };
  });

  teardown(() => {
    merge.dispose();
    (branch as any).selectBranch = originalSelectBranch;
    (branch as any).isTrunk = originalIsTrunk;
    (window as any).showErrorMessage = originalShowErrorMessage;
    (commands as any).executeCommand = originalExecuteCommand;
  });

  function resetMockCalls() {
    mockState.repositoryMergeCalls = [];
    mockState.executeCommandCalls = [];
  }

  suite("Basic Merge Scenarios", () => {
    test("should merge successfully from feature branch", async () => {
      const branchItem: IBranchItem = {
        name: "feature-123",
        path: "branches/feature-123"
      };
      mockState.selectBranchResult = branchItem;
      mockRepository.currentBranch = "branches/feature";

      resetMockCalls();
      await merge.execute(mockRepository as Repository);

      assert.strictEqual(mockState.repositoryMergeCalls.length, 1);
      assert.strictEqual(
        mockState.repositoryMergeCalls[0]!.name,
        "branches/feature-123"
      );
      assert.strictEqual(mockState.repositoryMergeCalls[0]!.reintegrate, false);
    });

    test("should merge with reintegrate from trunk", async () => {
      const branchItem: IBranchItem = {
        name: "feature-456",
        path: "branches/feature-456"
      };
      mockState.selectBranchResult = branchItem;
      mockRepository.currentBranch = "trunk";

      resetMockCalls();
      await merge.execute(mockRepository as Repository);

      assert.strictEqual(mockState.repositoryMergeCalls.length, 1);
      assert.strictEqual(
        mockState.repositoryMergeCalls[0]!.name,
        "branches/feature-456"
      );
      assert.strictEqual(mockState.repositoryMergeCalls[0]!.reintegrate, true);
    });

    test("should merge with reintegrate from trunk subdirectory", async () => {
      const branchItem: IBranchItem = {
        name: "feature-789",
        path: "branches/feature-789"
      };
      mockState.selectBranchResult = branchItem;
      mockRepository.currentBranch = "project/trunk";

      resetMockCalls();
      await merge.execute(mockRepository as Repository);

      assert.strictEqual(mockState.repositoryMergeCalls.length, 1);
      assert.strictEqual(mockState.repositoryMergeCalls[0]!.reintegrate, true);
    });
  });

  suite("User Cancellations", () => {
    test("should exit when no branch selected", async () => {
      mockState.selectBranchResult = undefined;

      resetMockCalls();
      await merge.execute(mockRepository as Repository);

      assert.strictEqual(
        mockState.repositoryMergeCalls.length,
        0,
        "Should not call merge when no branch selected"
      );
    });

    test("should exit early on branch selection cancellation", async () => {
      mockState.selectBranchResult = undefined;

      resetMockCalls();
      await merge.execute(mockRepository as Repository);

      assert.strictEqual(mockState.repositoryMergeCalls.length, 0);
      assert.strictEqual(mockState.executeCommandCalls.length, 0);
    });
  });

  suite("Merge Conflicts and Errors", () => {
    test("should prompt to update on 'try updating first' error", async () => {
      const branchItem: IBranchItem = {
        name: "feature-conflict",
        path: "branches/feature-conflict"
      };
      mockState.selectBranchResult = branchItem;
      mockRepository.currentBranch = "trunk";

      const error: ISvnErrorData = {
        error: new Error("merge failed"),
        stderrFormated: "Error: try updating first before merging",
        svnErrorCode: "155004"
      };
      mockState.repositoryMergeResult = error;
      mockState.showErrorMessageResult = "No";

      resetMockCalls();
      await merge.execute(mockRepository as Repository);

      assert.strictEqual(mockState.repositoryMergeCalls.length, 1);
      assert.strictEqual(mockState.executeCommandCalls.length, 0);
    });

    test("should update and retry on 'try updating first' with Yes", async () => {
      const branchItem: IBranchItem = {
        name: "feature-update",
        path: "branches/feature-update"
      };
      mockState.selectBranchResult = branchItem;
      mockRepository.currentBranch = "trunk";

      let callCount = 0;
      mockRepository.merge = async (
        name: string,
        reintegrate: boolean = false,
        accept_action: string = "postpone"
      ) => {
        mockState.repositoryMergeCalls.push({
          name,
          reintegrate,
          accept_action
        });
        callCount++;
        if (callCount === 1) {
          const error: ISvnErrorData = {
            error: new Error("merge failed"),
            stderrFormated: "Error: try updating first before merging",
            svnErrorCode: "155004"
          };
          throw error;
        }
      };

      mockState.showErrorMessageResult = "Yes";

      resetMockCalls();
      await merge.execute(mockRepository as Repository);

      assert.strictEqual(mockState.repositoryMergeCalls.length, 2);
      assert.strictEqual(mockState.executeCommandCalls.length, 1);
      assert.strictEqual(
        mockState.executeCommandCalls[0]!.command,
        "svn.update"
      );
    });

    test("should not retry on 'try updating first' with No", async () => {
      const branchItem: IBranchItem = {
        name: "feature-no-update",
        path: "branches/feature-no-update"
      };
      mockState.selectBranchResult = branchItem;
      mockRepository.currentBranch = "trunk";

      const error: ISvnErrorData = {
        error: new Error("merge failed"),
        stderrFormated: "Error: try updating first before merging",
        svnErrorCode: "155004"
      };
      mockState.repositoryMergeResult = error;
      mockState.showErrorMessageResult = "No";

      resetMockCalls();
      await merge.execute(mockRepository as Repository);

      assert.strictEqual(mockState.repositoryMergeCalls.length, 1);
      assert.strictEqual(mockState.executeCommandCalls.length, 0);
    });

    test("should not retry on 'try updating first' when cancelled", async () => {
      const branchItem: IBranchItem = {
        name: "feature-cancel",
        path: "branches/feature-cancel"
      };
      mockState.selectBranchResult = branchItem;
      mockRepository.currentBranch = "trunk";

      const error: ISvnErrorData = {
        error: new Error("merge failed"),
        stderrFormated: "Error: try updating first before merging",
        svnErrorCode: "155004"
      };
      mockState.repositoryMergeResult = error;
      mockState.showErrorMessageResult = undefined;

      resetMockCalls();
      await merge.execute(mockRepository as Repository);

      assert.strictEqual(mockState.repositoryMergeCalls.length, 1);
      assert.strictEqual(mockState.executeCommandCalls.length, 0);
    });

    test("should show error on other SVN errors with formatted message", async () => {
      const branchItem: IBranchItem = {
        name: "feature-error",
        path: "branches/feature-error"
      };
      mockState.selectBranchResult = branchItem;
      mockRepository.currentBranch = "trunk";

      const error: ISvnErrorData = {
        error: new Error("merge failed"),
        stderrFormated: "Error: conflicting changes in file.txt",
        svnErrorCode: "155015"
      };
      mockState.repositoryMergeResult = error;

      resetMockCalls();
      await merge.execute(mockRepository as Repository);

      assert.strictEqual(mockState.repositoryMergeCalls.length, 1);
      assert.strictEqual(mockState.executeCommandCalls.length, 0);
    });

    test("should handle error without formatted message", async () => {
      const branchItem: IBranchItem = {
        name: "feature-generic",
        path: "branches/feature-generic"
      };
      mockState.selectBranchResult = branchItem;
      mockRepository.currentBranch = "trunk";

      const error = new Error("Unknown error");
      mockState.repositoryMergeResult = error;

      resetMockCalls();
      await merge.execute(mockRepository as Repository);

      assert.strictEqual(mockState.repositoryMergeCalls.length, 1);
    });

    test("should handle SVN error without stderrFormated", async () => {
      const branchItem: IBranchItem = {
        name: "feature-no-stderr",
        path: "branches/feature-no-stderr"
      };
      mockState.selectBranchResult = branchItem;
      mockRepository.currentBranch = "trunk";

      const error: ISvnErrorData = {
        svnErrorCode: "155000"
      };
      mockState.repositoryMergeResult = error;

      resetMockCalls();
      await merge.execute(mockRepository as Repository);

      assert.strictEqual(mockState.repositoryMergeCalls.length, 1);
    });
  });

  suite("Branch Detection", () => {
    test("should detect trunk correctly", async () => {
      const branchItem: IBranchItem = {
        name: "feature",
        path: "branches/feature"
      };
      mockState.selectBranchResult = branchItem;
      mockRepository.currentBranch = "trunk";

      resetMockCalls();
      await merge.execute(mockRepository as Repository);

      assert.strictEqual(mockState.repositoryMergeCalls[0]!.reintegrate, true);
    });

    test("should detect non-trunk correctly", async () => {
      const branchItem: IBranchItem = {
        name: "feature-dest",
        path: "branches/feature-dest"
      };
      mockState.selectBranchResult = branchItem;
      mockRepository.currentBranch = "branches/source";

      resetMockCalls();
      await merge.execute(mockRepository as Repository);

      assert.strictEqual(mockState.repositoryMergeCalls[0]!.reintegrate, false);
    });

    test("should handle tag as non-trunk", async () => {
      const branchItem: IBranchItem = {
        name: "feature",
        path: "branches/feature"
      };
      mockState.selectBranchResult = branchItem;
      mockRepository.currentBranch = "tags/v1.0.0";

      resetMockCalls();
      await merge.execute(mockRepository as Repository);

      assert.strictEqual(mockState.repositoryMergeCalls[0]!.reintegrate, false);
    });
  });

  suite("Edge Cases", () => {
    test("should handle new branch marker", async () => {
      const branchItem: IBranchItem = {
        name: "new-feature",
        path: "branches/new-feature",
        isNew: true
      };
      mockState.selectBranchResult = branchItem;
      mockRepository.currentBranch = "trunk";

      resetMockCalls();
      await merge.execute(mockRepository as Repository);

      assert.strictEqual(mockState.repositoryMergeCalls.length, 1);
      assert.strictEqual(
        mockState.repositoryMergeCalls[0]!.name,
        "branches/new-feature"
      );
    });

    test("should merge with special characters in branch name", async () => {
      const branchItem: IBranchItem = {
        name: "feature-with-dash_and_underscore",
        path: "branches/feature-with-dash_and_underscore"
      };
      mockState.selectBranchResult = branchItem;
      mockRepository.currentBranch = "trunk";

      resetMockCalls();
      await merge.execute(mockRepository as Repository);

      assert.strictEqual(mockState.repositoryMergeCalls.length, 1);
      assert.strictEqual(
        mockState.repositoryMergeCalls[0]!.name,
        "branches/feature-with-dash_and_underscore"
      );
    });

    test("should handle deeply nested branch paths", async () => {
      const branchItem: IBranchItem = {
        name: "feature",
        path: "project/branches/team/feature"
      };
      mockState.selectBranchResult = branchItem;
      mockRepository.currentBranch = "project/trunk";

      resetMockCalls();
      await merge.execute(mockRepository as Repository);

      assert.strictEqual(mockState.repositoryMergeCalls.length, 1);
      assert.strictEqual(
        mockState.repositoryMergeCalls[0]!.name,
        "project/branches/team/feature"
      );
    });
  });

  suite("Merge Method Directly", () => {
    test("should call repository.merge with correct parameters", async () => {
      const branchItem: IBranchItem = {
        name: "test-branch",
        path: "branches/test-branch"
      };
      mockRepository.currentBranch = "trunk";

      resetMockCalls();
      await merge.merge(mockRepository as Repository, branchItem);

      assert.strictEqual(mockState.repositoryMergeCalls.length, 1);
      assert.strictEqual(
        mockState.repositoryMergeCalls[0]!.name,
        "branches/test-branch"
      );
      assert.strictEqual(mockState.repositoryMergeCalls[0]!.reintegrate, true);
    });

    test("should pass reintegrate=false for non-trunk branch", async () => {
      const branchItem: IBranchItem = {
        name: "target-branch",
        path: "branches/target-branch"
      };
      mockRepository.currentBranch = "branches/current";

      resetMockCalls();
      await merge.merge(mockRepository as Repository, branchItem);

      assert.strictEqual(mockState.repositoryMergeCalls.length, 1);
      assert.strictEqual(mockState.repositoryMergeCalls[0]!.reintegrate, false);
    });

    test("should handle recursive update retry", async () => {
      const branchItem: IBranchItem = {
        name: "recursive-branch",
        path: "branches/recursive-branch"
      };
      mockRepository.currentBranch = "trunk";

      let firstCall = true;
      mockRepository.merge = async (
        name: string,
        reintegrate: boolean = false,
        accept_action: string = "postpone"
      ) => {
        mockState.repositoryMergeCalls.push({
          name,
          reintegrate,
          accept_action
        });
        if (firstCall) {
          firstCall = false;
          const error: ISvnErrorData = {
            error: new Error("merge failed"),
            stderrFormated: "Error: try updating first",
            svnErrorCode: "155004"
          };
          throw error;
        }
      };

      mockState.showErrorMessageResult = "Yes";

      resetMockCalls();
      await merge.merge(mockRepository as Repository, branchItem);

      assert.strictEqual(mockState.repositoryMergeCalls.length, 2);
      assert.strictEqual(mockState.executeCommandCalls.length, 1);
    });
  });
});
