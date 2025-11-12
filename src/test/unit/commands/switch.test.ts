import * as assert from "assert";
import { window } from "vscode";
import { SwitchBranch } from "../../../commands/switchBranch";
import { IBranchItem, ISvnErrorData } from "../../../common/types";
import * as branchHelper from "../../../helpers/branch";
import * as validation from "../../../validation";
import { Repository } from "../../../repository";

suite("SwitchBranch Command Tests", () => {
  // Mock tracking
  let mockRepository: Partial<Repository>;
  let origSelectBranch: typeof branchHelper.selectBranch;
  let origValidateRepositoryUrl: typeof validation.validateRepositoryUrl;
  let origShowInputBox: typeof window.showInputBox;
  let origShowErrorMessage: typeof window.showErrorMessage;

  // Call tracking
  let selectBranchCalls: any[] = [];
  let validateUrlCalls: any[] = [];
  let inputBoxCalls: any[] = [];
  let errorMessageCalls: any[] = [];
  let newBranchCalls: any[] = [];
  let switchBranchCalls: any[] = [];

  // Mock results
  let selectBranchResult: IBranchItem | undefined;
  let validateUrlResult: boolean = true;
  let inputBoxResult: string | undefined;
  let errorMessageResult: string | undefined;

  setup(() => {
    // Mock Repository
    mockRepository = {
      newBranch: async (path: string, message: string) => {
        newBranchCalls.push({ path, message });
      },
      switchBranch: async (path: string, force?: boolean) => {
        switchBranchCalls.push({ path, force });
      }
    };

    // Mock selectBranch
    origSelectBranch = branchHelper.selectBranch;
    (branchHelper as any).selectBranch = async (
      repo: Repository,
      allowNew: boolean
    ) => {
      selectBranchCalls.push({ repo, allowNew });
      return selectBranchResult;
    };

    // Mock validateRepositoryUrl
    origValidateRepositoryUrl = validation.validateRepositoryUrl;
    (validation as any).validateRepositoryUrl = (url: string) => {
      validateUrlCalls.push({ url });
      return validateUrlResult;
    };

    // Mock window.showInputBox
    origShowInputBox = window.showInputBox;
    (window as any).showInputBox = async (options?: any) => {
      inputBoxCalls.push({ options });
      return inputBoxResult;
    };

    // Mock window.showErrorMessage
    origShowErrorMessage = window.showErrorMessage;
    (window as any).showErrorMessage = async (
      message: string,
      ...items: string[]
    ) => {
      errorMessageCalls.push({ message, items });
      return errorMessageResult;
    };

    // Clear call tracking
    selectBranchCalls = [];
    validateUrlCalls = [];
    inputBoxCalls = [];
    errorMessageCalls = [];
    newBranchCalls = [];
    switchBranchCalls = [];

    // Reset mock results
    selectBranchResult = undefined;
    validateUrlResult = true;
    inputBoxResult = undefined;
    errorMessageResult = undefined;
  });

  teardown(() => {
    // Restore original functions
    (branchHelper as any).selectBranch = origSelectBranch;
    (validation as any).validateRepositoryUrl = origValidateRepositoryUrl;
    (window as any).showInputBox = origShowInputBox;
    (window as any).showErrorMessage = origShowErrorMessage;
  });

  suite("Basic Branch Switching", () => {
    let command: SwitchBranch;

    setup(() => {
      command = new SwitchBranch();
    });

    teardown(() => {
      command.dispose();
    });

    test("1.1: Switch to existing branch successfully", async () => {
      selectBranchResult = {
        name: "feature-branch",
        path: "https://svn.example.com/repo/branches/feature-branch",
        isNew: false
      };

      await command.execute(mockRepository as Repository);

      assert.strictEqual(selectBranchCalls.length, 1);
      assert.strictEqual(selectBranchCalls[0].allowNew, true);
      assert.strictEqual(validateUrlCalls.length, 1);
      assert.strictEqual(switchBranchCalls.length, 1);
      assert.strictEqual(
        switchBranchCalls[0].path,
        "https://svn.example.com/repo/branches/feature-branch"
      );
      assert.strictEqual(switchBranchCalls[0].force, undefined);
    });

    test("1.2: User cancels branch selection", async () => {
      selectBranchResult = undefined;

      await command.execute(mockRepository as Repository);

      assert.strictEqual(selectBranchCalls.length, 1);
      assert.strictEqual(validateUrlCalls.length, 0);
      assert.strictEqual(switchBranchCalls.length, 0);
    });

    test("1.3: Switch to trunk branch", async () => {
      selectBranchResult = {
        name: "trunk",
        path: "https://svn.example.com/repo/trunk",
        isNew: false
      };

      await command.execute(mockRepository as Repository);

      assert.strictEqual(switchBranchCalls.length, 1);
      assert.strictEqual(
        switchBranchCalls[0].path,
        "https://svn.example.com/repo/trunk"
      );
    });

    test("1.4: Switch to tag", async () => {
      selectBranchResult = {
        name: "v1.0.0",
        path: "https://svn.example.com/repo/tags/v1.0.0",
        isNew: false
      };

      await command.execute(mockRepository as Repository);

      assert.strictEqual(switchBranchCalls.length, 1);
      assert.strictEqual(
        switchBranchCalls[0].path,
        "https://svn.example.com/repo/tags/v1.0.0"
      );
    });
  });

  suite("New Branch Creation", () => {
    let command: SwitchBranch;

    setup(() => {
      command = new SwitchBranch();
    });

    teardown(() => {
      command.dispose();
    });

    test("2.1: Create new branch with commit message", async () => {
      selectBranchResult = {
        name: "new-feature",
        path: "https://svn.example.com/repo/branches/new-feature",
        isNew: true
      };
      inputBoxResult = "Created new branch new-feature";

      await command.execute(mockRepository as Repository);

      assert.strictEqual(selectBranchCalls.length, 1);
      assert.strictEqual(inputBoxCalls.length, 1);
      assert.strictEqual(
        inputBoxCalls[0].options.value,
        "Created new branch new-feature"
      );
      assert.strictEqual(newBranchCalls.length, 1);
      assert.strictEqual(
        newBranchCalls[0].path,
        "https://svn.example.com/repo/branches/new-feature"
      );
      assert.strictEqual(
        newBranchCalls[0].message,
        "Created new branch new-feature"
      );
    });

    test("2.2: User cancels at commit message input", async () => {
      selectBranchResult = {
        name: "new-feature",
        path: "https://svn.example.com/repo/branches/new-feature",
        isNew: true
      };
      inputBoxResult = undefined; // User pressed ESC

      await command.execute(mockRepository as Repository);

      assert.strictEqual(inputBoxCalls.length, 1);
      assert.strictEqual(newBranchCalls.length, 0);
    });

    test("2.3: Create new branch with custom message", async () => {
      selectBranchResult = {
        name: "hotfix",
        path: "https://svn.example.com/repo/branches/hotfix",
        isNew: true
      };
      inputBoxResult = "Hotfix for critical bug";

      await command.execute(mockRepository as Repository);

      assert.strictEqual(newBranchCalls.length, 1);
      assert.strictEqual(newBranchCalls[0].message, "Hotfix for critical bug");
    });

    test("2.4: Create new branch with empty message", async () => {
      selectBranchResult = {
        name: "test",
        path: "https://svn.example.com/repo/branches/test",
        isNew: true
      };
      inputBoxResult = "";

      await command.execute(mockRepository as Repository);

      assert.strictEqual(newBranchCalls.length, 1);
      assert.strictEqual(newBranchCalls[0].message, "");
    });

    test("2.5: Prompt includes branch name", async () => {
      selectBranchResult = {
        name: "develop",
        path: "https://svn.example.com/repo/branches/develop",
        isNew: true
      };
      inputBoxResult = "Creating develop branch";

      await command.execute(mockRepository as Repository);

      assert.strictEqual(inputBoxCalls.length, 1);
      assert.ok(inputBoxCalls[0].options.prompt.includes("develop"));
    });
  });

  suite("URL Validation", () => {
    let command: SwitchBranch;

    setup(() => {
      command = new SwitchBranch();
    });

    teardown(() => {
      command.dispose();
    });

    test("3.1: Valid http URL accepted", async () => {
      selectBranchResult = {
        name: "branch",
        path: "http://svn.example.com/repo/branches/branch",
        isNew: false
      };
      validateUrlResult = true;

      await command.execute(mockRepository as Repository);

      assert.strictEqual(validateUrlCalls.length, 1);
      assert.strictEqual(switchBranchCalls.length, 1);
      assert.strictEqual(errorMessageCalls.length, 0);
    });

    test("3.2: Valid https URL accepted", async () => {
      selectBranchResult = {
        name: "branch",
        path: "https://svn.example.com/repo/branches/branch",
        isNew: false
      };
      validateUrlResult = true;

      await command.execute(mockRepository as Repository);

      assert.strictEqual(switchBranchCalls.length, 1);
    });

    test("3.3: Valid svn:// URL accepted", async () => {
      selectBranchResult = {
        name: "branch",
        path: "svn://svn.example.com/repo/branches/branch",
        isNew: false
      };
      validateUrlResult = true;

      await command.execute(mockRepository as Repository);

      assert.strictEqual(switchBranchCalls.length, 1);
    });

    test("3.4: Valid svn+ssh:// URL accepted", async () => {
      selectBranchResult = {
        name: "branch",
        path: "svn+ssh://svn.example.com/repo/branches/branch",
        isNew: false
      };
      validateUrlResult = true;

      await command.execute(mockRepository as Repository);

      assert.strictEqual(switchBranchCalls.length, 1);
    });

    test("3.5: Invalid URL rejected", async () => {
      selectBranchResult = {
        name: "branch",
        path: "file:///local/path/branches/branch",
        isNew: false
      };
      validateUrlResult = false;

      await command.execute(mockRepository as Repository);

      assert.strictEqual(validateUrlCalls.length, 1);
      assert.strictEqual(switchBranchCalls.length, 0);
      assert.strictEqual(errorMessageCalls.length, 1);
      assert.ok(errorMessageCalls[0].message.includes("Invalid branch URL"));
    });

    test("3.6: URL validation called before switch", async () => {
      selectBranchResult = {
        name: "branch",
        path: "https://svn.example.com/repo/branches/branch",
        isNew: false
      };

      await command.execute(mockRepository as Repository);

      assert.strictEqual(validateUrlCalls.length, 1);
      assert.strictEqual(
        validateUrlCalls[0].url,
        "https://svn.example.com/repo/branches/branch"
      );
    });

    test("3.7: URL validation for new branch", async () => {
      selectBranchResult = {
        name: "new-branch",
        path: "https://svn.example.com/repo/branches/new-branch",
        isNew: true
      };
      inputBoxResult = "Create branch";
      validateUrlResult = false;

      await command.execute(mockRepository as Repository);

      assert.strictEqual(validateUrlCalls.length, 1);
      assert.strictEqual(newBranchCalls.length, 0);
      assert.strictEqual(errorMessageCalls.length, 1);
    });
  });

  suite("Conflict and Error Handling", () => {
    let command: SwitchBranch;

    setup(() => {
      command = new SwitchBranch();
    });

    teardown(() => {
      command.dispose();
    });

    test("4.1: Switch conflict with ignore-ancestry suggestion", async () => {
      selectBranchResult = {
        name: "branch",
        path: "https://svn.example.com/repo/branches/branch",
        isNew: false
      };

      let callCount = 0;
      (mockRepository.switchBranch as any) = async (
        path: string,
        force?: boolean
      ) => {
        callCount++;
        if (callCount === 1 && !force) {
          const error: ISvnErrorData = {
            stderrFormated: "Error: try with --ignore-ancestry option",
            exitCode: 1,
            svnErrorCode: "E000000",
            error: new Error("conflict")
          };
          throw error;
        }
        switchBranchCalls.push({ path, force });
      };

      errorMessageResult = "Yes";

      await command.execute(mockRepository as Repository);

      assert.strictEqual(errorMessageCalls.length, 1);
      assert.ok(
        errorMessageCalls[0].message.includes("ignore-ancestry")
      );
      assert.deepStrictEqual(errorMessageCalls[0].items, ["Yes", "No"]);
      assert.strictEqual(switchBranchCalls.length, 1);
      assert.strictEqual(switchBranchCalls[0].force, true);
    });

    test("4.2: User declines ignore-ancestry retry", async () => {
      selectBranchResult = {
        name: "branch",
        path: "https://svn.example.com/repo/branches/branch",
        isNew: false
      };

      (mockRepository.switchBranch as any) = async () => {
        const error: ISvnErrorData = {
          stderrFormated: "Error: try with --ignore-ancestry option",
          exitCode: 1,
          svnErrorCode: "E000000",
          error: new Error("conflict")
        };
        throw error;
      };

      errorMessageResult = "No";

      await command.execute(mockRepository as Repository);

      assert.strictEqual(errorMessageCalls.length, 1);
      assert.strictEqual(switchBranchCalls.length, 0);
    });

    test("4.3: User cancels ignore-ancestry prompt", async () => {
      selectBranchResult = {
        name: "branch",
        path: "https://svn.example.com/repo/branches/branch",
        isNew: false
      };

      (mockRepository.switchBranch as any) = async () => {
        const error: ISvnErrorData = {
          stderrFormated: "Error: try with --ignore-ancestry option",
          exitCode: 1,
          svnErrorCode: "E000000",
          error: new Error("conflict")
        };
        throw error;
      };

      errorMessageResult = undefined; // User cancelled

      await command.execute(mockRepository as Repository);

      assert.strictEqual(switchBranchCalls.length, 0);
    });

    test("4.4: Generic switch error without ignore-ancestry", async () => {
      selectBranchResult = {
        name: "branch",
        path: "https://svn.example.com/repo/branches/branch",
        isNew: false
      };

      (mockRepository.switchBranch as any) = async () => {
        throw new Error("Generic SVN error");
      };

      await command.execute(mockRepository as Repository);

      assert.strictEqual(errorMessageCalls.length, 1);
      assert.ok(
        errorMessageCalls[0].message.includes("Unable to switch branch")
      );
    });

    test("4.5: Error creating new branch", async () => {
      selectBranchResult = {
        name: "new-branch",
        path: "https://svn.example.com/repo/branches/new-branch",
        isNew: true
      };
      inputBoxResult = "Create branch";

      (mockRepository.newBranch as any) = async () => {
        throw new Error("Failed to create branch");
      };

      await command.execute(mockRepository as Repository);

      assert.strictEqual(errorMessageCalls.length, 1);
      assert.ok(
        errorMessageCalls[0].message.includes("Unable to create new branch")
      );
    });

    test("4.6: Switch error with empty stderrFormated", async () => {
      selectBranchResult = {
        name: "branch",
        path: "https://svn.example.com/repo/branches/branch",
        isNew: false
      };

      (mockRepository.switchBranch as any) = async () => {
        const error: ISvnErrorData = {
          stderrFormated: "",
          exitCode: 1,
          svnErrorCode: "E000000",
          error: new Error("error")
        };
        throw error;
      };

      await command.execute(mockRepository as Repository);

      assert.strictEqual(errorMessageCalls.length, 1);
      assert.ok(
        errorMessageCalls[0].message.includes("Unable to switch branch")
      );
    });

    test("4.7: Switch error without stderrFormated field", async () => {
      selectBranchResult = {
        name: "branch",
        path: "https://svn.example.com/repo/branches/branch",
        isNew: false
      };

      (mockRepository.switchBranch as any) = async () => {
        const error = {
          exitCode: 1,
          svnErrorCode: "E000000",
          error: new Error("error")
        };
        throw error;
      };

      await command.execute(mockRepository as Repository);

      assert.strictEqual(errorMessageCalls.length, 1);
    });
  });

  suite("Edge Cases", () => {
    let command: SwitchBranch;

    setup(() => {
      command = new SwitchBranch();
    });

    teardown(() => {
      command.dispose();
    });

    test("5.1: Branch with special characters in name", async () => {
      selectBranchResult = {
        name: "feature/sub-feature",
        path: "https://svn.example.com/repo/branches/feature/sub-feature",
        isNew: false
      };

      await command.execute(mockRepository as Repository);

      assert.strictEqual(switchBranchCalls.length, 1);
      assert.strictEqual(
        switchBranchCalls[0].path,
        "https://svn.example.com/repo/branches/feature/sub-feature"
      );
    });

    test("5.2: Branch path with spaces (after encoding)", async () => {
      selectBranchResult = {
        name: "test branch",
        path: "https://svn.example.com/repo/branches/test%20branch",
        isNew: false
      };

      await command.execute(mockRepository as Repository);

      assert.strictEqual(switchBranchCalls.length, 1);
    });

    test("5.3: Very long branch name", async () => {
      const longName = "a".repeat(200);
      selectBranchResult = {
        name: longName,
        path: `https://svn.example.com/repo/branches/${longName}`,
        isNew: false
      };

      await command.execute(mockRepository as Repository);

      assert.strictEqual(switchBranchCalls.length, 1);
    });

    test("5.4: New branch with very long commit message", async () => {
      selectBranchResult = {
        name: "branch",
        path: "https://svn.example.com/repo/branches/branch",
        isNew: true
      };
      inputBoxResult = "x".repeat(1000);

      await command.execute(mockRepository as Repository);

      assert.strictEqual(newBranchCalls.length, 1);
      assert.strictEqual(newBranchCalls[0].message.length, 1000);
    });

    test("5.5: Switch to same branch (no-op)", async () => {
      selectBranchResult = {
        name: "current",
        path: "https://svn.example.com/repo/branches/current",
        isNew: false
      };

      await command.execute(mockRepository as Repository);

      assert.strictEqual(switchBranchCalls.length, 1);
    });

    test("5.6: Rapid consecutive switches", async () => {
      selectBranchResult = {
        name: "branch1",
        path: "https://svn.example.com/repo/branches/branch1",
        isNew: false
      };

      await command.execute(mockRepository as Repository);
      await command.execute(mockRepository as Repository);

      assert.strictEqual(switchBranchCalls.length, 2);
    });

    test("5.7: Switch after validation rejects", async () => {
      selectBranchResult = {
        name: "branch",
        path: "file:///local/path",
        isNew: false
      };
      validateUrlResult = false;

      await command.execute(mockRepository as Repository);

      assert.strictEqual(switchBranchCalls.length, 0);
      assert.strictEqual(errorMessageCalls.length, 1);
    });

    test("5.8: selectBranch called with correct parameters", async () => {
      selectBranchResult = {
        name: "branch",
        path: "https://svn.example.com/repo/branches/branch",
        isNew: false
      };

      await command.execute(mockRepository as Repository);

      assert.strictEqual(selectBranchCalls.length, 1);
      assert.strictEqual(selectBranchCalls[0].repo, mockRepository);
      assert.strictEqual(selectBranchCalls[0].allowNew, true);
    });

    test("5.9: Error logged to console", async () => {
      selectBranchResult = {
        name: "branch",
        path: "https://svn.example.com/repo/branches/branch",
        isNew: false
      };

      let consoleLogCalled = false;
      const origLog = console.log;
      console.log = () => {
        consoleLogCalled = true;
      };

      (mockRepository.switchBranch as any) = async () => {
        throw new Error("Test error");
      };

      await command.execute(mockRepository as Repository);

      console.log = origLog;
      assert.ok(consoleLogCalled);
    });

    test("5.10: Multiple errors handled separately", async () => {
      selectBranchResult = {
        name: "branch1",
        path: "https://svn.example.com/repo/branches/branch1",
        isNew: false
      };

      (mockRepository.switchBranch as any) = async () => {
        throw new Error("Error 1");
      };

      await command.execute(mockRepository as Repository);

      selectBranchResult = {
        name: "branch2",
        path: "https://svn.example.com/repo/branches/branch2",
        isNew: true
      };
      inputBoxResult = "message";

      (mockRepository.newBranch as any) = async () => {
        throw new Error("Error 2");
      };

      await command.execute(mockRepository as Repository);

      assert.strictEqual(errorMessageCalls.length, 2);
      assert.ok(
        errorMessageCalls[0].message.includes("Unable to switch branch")
      );
      assert.ok(
        errorMessageCalls[1].message.includes("Unable to create new branch")
      );
    });
  });
});
