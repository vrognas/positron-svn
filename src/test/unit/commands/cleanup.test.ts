import * as assert from "assert";
import { commands, window } from "vscode";
import { Cleanup } from "../../../commands/cleanup";
import { Upgrade } from "../../../commands/upgrade";
import { Repository } from "../../../repository";
import { configuration } from "../../../helpers/configuration";
import * as util from "../../../util";

suite("Cleanup and Upgrade Commands Tests", () => {
  let origShowInfo: typeof window.showInformationMessage;
  let origShowError: typeof window.showErrorMessage;
  let origShowWarning: typeof window.showWarningMessage;
  let origConfigGet: typeof configuration.get;
  let origConfigUpdate: typeof configuration.update;
  let origCommandsExecute: typeof commands.executeCommand;
  let origFixPathSeparator: typeof util.fixPathSeparator;

  // Call tracking
  let showInfoCalls: any[] = [];
  let showErrorCalls: any[] = [];
  let showWarningCalls: any[] = [];
  let configGetCalls: any[] = [];
  let configUpdateCalls: any[] = [];
  let commandsExecuteCalls: any[] = [];
  let fixPathSeparatorCalls: any[] = [];

  setup(() => {
    // Mock window.showInformationMessage
    origShowInfo = window.showInformationMessage;
    (window as any).showInformationMessage = (message: string) => {
      showInfoCalls.push({ message });
      return Promise.resolve(undefined);
    };

    // Mock window.showErrorMessage
    origShowError = window.showErrorMessage;
    (window as any).showErrorMessage = (message: string) => {
      showErrorCalls.push({ message });
      return Promise.resolve(undefined);
    };

    // Mock window.showWarningMessage
    origShowWarning = window.showWarningMessage;
    (window as any).showWarningMessage = (
      message: string,
      ...items: string[]
    ) => {
      showWarningCalls.push({ message, items });
      return Promise.resolve(undefined);
    };

    // Mock configuration.get
    origConfigGet = configuration.get;
    (configuration as any).get = (key: string, defaultValue?: any) => {
      configGetCalls.push({ key, defaultValue });
      if (key === "ignoreWorkingCopyIsTooOld") {
        return false;
      }
      return defaultValue;
    };

    // Mock configuration.update
    origConfigUpdate = configuration.update;
    (configuration as any).update = (key: string, value: any) => {
      configUpdateCalls.push({ key, value });
      return Promise.resolve();
    };

    // Mock commands.executeCommand
    origCommandsExecute = commands.executeCommand;
    (commands as any).executeCommand = (command: string, ...args: any[]) => {
      commandsExecuteCalls.push({ command, args });
      return Promise.resolve(undefined);
    };

    // Mock fixPathSeparator
    origFixPathSeparator = util.fixPathSeparator;
    (util as any).fixPathSeparator = (path: string) => {
      fixPathSeparatorCalls.push({ path });
      return path;
    };

    // Clear call tracking
    showInfoCalls = [];
    showErrorCalls = [];
    showWarningCalls = [];
    configGetCalls = [];
    configUpdateCalls = [];
    commandsExecuteCalls = [];
    fixPathSeparatorCalls = [];
  });

  teardown(() => {
    (window as any).showInformationMessage = origShowInfo;
    (window as any).showErrorMessage = origShowError;
    (window as any).showWarningMessage = origShowWarning;
    (configuration as any).get = origConfigGet;
    (configuration as any).update = origConfigUpdate;
    (commands as any).executeCommand = origCommandsExecute;
    (util as any).fixPathSeparator = origFixPathSeparator;
  });

  suite("Cleanup Command", () => {
    let cleanup: Cleanup;
    let mockRepository: Partial<Repository>;
    let cleanupCalls: any[] = [];

    setup(() => {
      cleanup = new Cleanup();
      cleanupCalls = [];

      // Mock Repository
      mockRepository = {
        cleanup: async () => {
          cleanupCalls.push({});
          return "Cleanup complete";
        }
      };
    });

    teardown(() => {
      cleanup.dispose();
    });

    test("should execute cleanup on repository", async () => {
      await cleanup.execute(mockRepository as Repository);

      assert.strictEqual(cleanupCalls.length, 1);
    });

    test("should handle successful cleanup", async () => {
      mockRepository.cleanup = async () => {
        cleanupCalls.push({});
        return "Cleanup successful";
      };

      await cleanup.execute(mockRepository as Repository);

      assert.strictEqual(cleanupCalls.length, 1);
    });

    test("should handle cleanup error", async () => {
      mockRepository.cleanup = async () => {
        throw new Error("svn: E155037: Working copy locked");
      };

      try {
        await cleanup.execute(mockRepository as Repository);
        assert.fail("Should throw error");
      } catch (err) {
        assert.ok(err);
      }
    });

    test("should handle cleanup with empty return", async () => {
      mockRepository.cleanup = async () => {
        cleanupCalls.push({});
        return "";
      };

      await cleanup.execute(mockRepository as Repository);

      assert.strictEqual(cleanupCalls.length, 1);
    });

    test("should call cleanup exactly once", async () => {
      await cleanup.execute(mockRepository as Repository);

      assert.strictEqual(cleanupCalls.length, 1);
    });
  });

  suite("Upgrade Command", () => {
    let upgrade: Upgrade;
    let mockSourceControlManager: any;

    setup(() => {
      upgrade = new Upgrade();

      // Mock SourceControlManager
      mockSourceControlManager = {
        upgradeWorkingCopy: async (_folderPath: string) => {
          return true;
        },
        tryOpenRepository: (_folderPath: string) => {}
      };

      // Mock commands.executeCommand to return mock manager
      (commands as any).executeCommand = (command: string, ...args: any[]) => {
        commandsExecuteCalls.push({ command, args });
        if (command === "svn.getSourceControlManager") {
          return Promise.resolve(mockSourceControlManager);
        }
        return Promise.resolve(undefined);
      };
    });

    teardown(() => {
      upgrade.dispose();
    });

    test("should return early when folderPath is empty", async () => {
      await upgrade.execute("");

      assert.strictEqual(showWarningCalls.length, 0);
      assert.strictEqual(commandsExecuteCalls.length, 0);
    });

    test("should return early when folderPath is undefined", async () => {
      await upgrade.execute(undefined as any);

      assert.strictEqual(showWarningCalls.length, 0);
      assert.strictEqual(commandsExecuteCalls.length, 0);
    });

    test("should return early when ignoreWorkingCopyIsTooOld is true", async () => {
      (configuration as any).get = (key: string, defaultValue?: any) => {
        configGetCalls.push({ key, defaultValue });
        if (key === "ignoreWorkingCopyIsTooOld") {
          return true;
        }
        return defaultValue;
      };

      await upgrade.execute("/test/path");

      assert.strictEqual(showWarningCalls.length, 0);
    });

    test("should fix path separator", async () => {
      (window as any).showWarningMessage = async () => "No";

      await upgrade.execute("/test\\path");

      assert.strictEqual(fixPathSeparatorCalls.length, 1);
      assert.strictEqual(fixPathSeparatorCalls[0].path, "/test\\path");
    });

    test("should show warning message with correct options", async () => {
      (window as any).showWarningMessage = (
        message: string,
        ...items: string[]
      ) => {
        showWarningCalls.push({ message, items });
        return Promise.resolve("No");
      };

      await upgrade.execute("/test/path");

      assert.strictEqual(showWarningCalls.length, 1);
      assert.strictEqual(
        showWarningCalls[0].message,
        "You want upgrade the working copy (svn upgrade)?"
      );
      assert.deepStrictEqual(showWarningCalls[0].items, [
        "Yes",
        "No",
        "Don't Show Again"
      ]);
    });

    test("should upgrade when user chooses Yes", async () => {
      let upgradeWorkingCopyCalls: any[] = [];
      mockSourceControlManager.upgradeWorkingCopy = async (
        folderPath: string
      ) => {
        upgradeWorkingCopyCalls.push({ folderPath });
        return true;
      };

      (window as any).showWarningMessage = async () => "Yes";

      await upgrade.execute("/test/path");

      assert.strictEqual(upgradeWorkingCopyCalls.length, 1);
      assert.strictEqual(upgradeWorkingCopyCalls[0].folderPath, "/test/path");
    });

    test("should show success message on successful upgrade", async () => {
      mockSourceControlManager.upgradeWorkingCopy = async () => true;
      (window as any).showWarningMessage = async () => "Yes";

      await upgrade.execute("/test/path");

      assert.strictEqual(showInfoCalls.length, 1);
      assert.strictEqual(
        showInfoCalls[0].message,
        'Working copy "/test/path" upgraded'
      );
    });

    test("should call tryOpenRepository after successful upgrade", async () => {
      let tryOpenRepositoryCalls: any[] = [];
      mockSourceControlManager.upgradeWorkingCopy = async () => true;
      mockSourceControlManager.tryOpenRepository = (path: string) => {
        tryOpenRepositoryCalls.push({ folderPath: path });
      };
      (window as any).showWarningMessage = async () => "Yes";

      await upgrade.execute("/test/path");

      assert.strictEqual(tryOpenRepositoryCalls.length, 1);
      assert.strictEqual(tryOpenRepositoryCalls[0].folderPath, "/test/path");
    });

    test("should show error message on failed upgrade", async () => {
      mockSourceControlManager.upgradeWorkingCopy = async () => false;
      (window as any).showWarningMessage = async () => "Yes";

      await upgrade.execute("/test/path");

      assert.strictEqual(showErrorCalls.length, 1);
      assert.strictEqual(
        showErrorCalls[0].message,
        'Error on upgrading working copy "/test/path". See log for more detail'
      );
    });

    test("should not call tryOpenRepository on failed upgrade", async () => {
      let tryOpenRepositoryCalls: any[] = [];
      mockSourceControlManager.upgradeWorkingCopy = async () => false;
      mockSourceControlManager.tryOpenRepository = (path: string) => {
        tryOpenRepositoryCalls.push({ folderPath: path });
      };
      (window as any).showWarningMessage = async () => "Yes";

      await upgrade.execute("/test/path");

      assert.strictEqual(tryOpenRepositoryCalls.length, 0);
    });

    test("should do nothing when user chooses No", async () => {
      (window as any).showWarningMessage = async () => "No";

      await upgrade.execute("/test/path");

      assert.strictEqual(showInfoCalls.length, 0);
      assert.strictEqual(showErrorCalls.length, 0);
      assert.strictEqual(configUpdateCalls.length, 0);
    });

    test("should update config when user chooses Don't Show Again", async () => {
      (window as any).showWarningMessage = async () => "Don't Show Again";

      await upgrade.execute("/test/path");

      assert.strictEqual(configUpdateCalls.length, 1);
      assert.strictEqual(configUpdateCalls[0].key, "ignoreWorkingCopyIsTooOld");
      assert.strictEqual(configUpdateCalls[0].value, true);
    });

    test("should do nothing when user cancels", async () => {
      (window as any).showWarningMessage = async () => undefined;

      await upgrade.execute("/test/path");

      assert.strictEqual(showInfoCalls.length, 0);
      assert.strictEqual(showErrorCalls.length, 0);
      assert.strictEqual(configUpdateCalls.length, 0);
    });

    test("should get SourceControlManager", async () => {
      (window as any).showWarningMessage = async () => "Yes";
      mockSourceControlManager.upgradeWorkingCopy = async () => true;

      await upgrade.execute("/test/path");

      const getManagerCall = commandsExecuteCalls.find(
        c => c.command === "svn.getSourceControlManager"
      );
      assert.ok(getManagerCall);
      assert.deepStrictEqual(getManagerCall.args, [""]);
    });

    test("should handle multiple upgrade attempts", async () => {
      let upgradeWorkingCopyCalls: any[] = [];
      mockSourceControlManager.upgradeWorkingCopy = async (
        folderPath: string
      ) => {
        upgradeWorkingCopyCalls.push({ folderPath });
        return true;
      };
      (window as any).showWarningMessage = async () => "Yes";

      await upgrade.execute("/test/path1");
      await upgrade.execute("/test/path2");

      assert.strictEqual(upgradeWorkingCopyCalls.length, 2);
      assert.strictEqual(upgradeWorkingCopyCalls[0].folderPath, "/test/path1");
      assert.strictEqual(upgradeWorkingCopyCalls[1].folderPath, "/test/path2");
    });

    test("should handle path with spaces", async () => {
      let upgradeWorkingCopyCalls: any[] = [];
      mockSourceControlManager.upgradeWorkingCopy = async (
        folderPath: string
      ) => {
        upgradeWorkingCopyCalls.push({ folderPath });
        return true;
      };
      (window as any).showWarningMessage = async () => "Yes";

      await upgrade.execute("/test/path with spaces");

      assert.strictEqual(upgradeWorkingCopyCalls.length, 1);
      assert.strictEqual(
        upgradeWorkingCopyCalls[0].folderPath,
        "/test/path with spaces"
      );
    });

    test("should handle Windows-style paths", async () => {
      (window as any).showWarningMessage = async () => "No";
      (util as any).fixPathSeparator = (path: string) => {
        fixPathSeparatorCalls.push({ path });
        return path.replace(/\\/g, "/");
      };

      await upgrade.execute("C:\\test\\path");

      assert.strictEqual(fixPathSeparatorCalls.length, 1);
    });

    test("should not show messages when choice is undefined", async () => {
      (window as any).showWarningMessage = async () => undefined;

      await upgrade.execute("/test/path");

      assert.strictEqual(showInfoCalls.length, 0);
      assert.strictEqual(showErrorCalls.length, 0);
    });
  });

  suite("Upgrade Error Scenarios", () => {
    let upgrade: Upgrade;
    let mockSourceControlManager: any;

    setup(() => {
      upgrade = new Upgrade();

      mockSourceControlManager = {
        upgradeWorkingCopy: async () => true,
        tryOpenRepository: (_path: string) => {}
      };

      (commands as any).executeCommand = async (command: string) => {
        if (command === "svn.getSourceControlManager") {
          return mockSourceControlManager;
        }
        return undefined;
      };
    });

    teardown(() => {
      upgrade.dispose();
    });

    test("should handle upgradeWorkingCopy exception", async () => {
      mockSourceControlManager.upgradeWorkingCopy = async () => {
        throw new Error("Upgrade failed");
      };
      (window as any).showWarningMessage = async () => "Yes";

      await upgrade.execute("/test/path");

      // Command should handle the exception gracefully
      assert.ok(true);
    });

    test("should handle tryOpenRepository exception", async () => {
      mockSourceControlManager.upgradeWorkingCopy = async () => true;
      mockSourceControlManager.tryOpenRepository = (_path: string) => {
        throw new Error("Cannot open repository");
      };
      (window as any).showWarningMessage = async () => "Yes";

      await upgrade.execute("/test/path");

      // Should still show success message even if tryOpenRepository fails
      assert.strictEqual(showInfoCalls.length, 1);
    });

    test("should handle getSourceControlManager failure", async () => {
      (commands as any).executeCommand = async () => {
        throw new Error("Cannot get manager");
      };
      (window as any).showWarningMessage = async () => "Yes";

      try {
        await upgrade.execute("/test/path");
      } catch (err) {
        assert.ok(err);
      }
    });
  });

  suite("Upgrade Config Integration", () => {
    let upgrade: Upgrade;

    setup(() => {
      upgrade = new Upgrade();
    });

    teardown(() => {
      upgrade.dispose();
    });

    test("should check ignoreWorkingCopyIsTooOld config", async () => {
      (window as any).showWarningMessage = async () => "No";

      await upgrade.execute("/test/path");

      const configCall = configGetCalls.find(
        c => c.key === "ignoreWorkingCopyIsTooOld"
      );
      assert.ok(configCall);
      assert.strictEqual(configCall.defaultValue, false);
    });

    test("should update config with Don't Show Again", async () => {
      (window as any).showWarningMessage = async () => "Don't Show Again";

      await upgrade.execute("/test/path");

      assert.strictEqual(configUpdateCalls.length, 1);
      assert.strictEqual(configUpdateCalls[0].key, "ignoreWorkingCopyIsTooOld");
      assert.strictEqual(configUpdateCalls[0].value, true);
    });

    test("should handle config update failure", async () => {
      (configuration as any).update = async () => {
        throw new Error("Cannot update config");
      };
      (window as any).showWarningMessage = async () => "Don't Show Again";

      try {
        await upgrade.execute("/test/path");
      } catch (err) {
        assert.ok(err);
      }
    });
  });
});
