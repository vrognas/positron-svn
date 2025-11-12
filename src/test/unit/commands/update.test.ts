import * as assert from "assert";
import { window } from "vscode";
import { Update } from "../../../commands/update";
import { Repository } from "../../../repository";
import { configuration } from "../../../helpers/configuration";

suite("Update Command Tests", () => {
  let update: Update;
  let mockRepository: Partial<Repository>;
  let origShowInfo: typeof window.showInformationMessage;
  let origShowError: typeof window.showErrorMessage;
  let origConfigGet: typeof configuration.get;

  // Call tracking
  let showInfoCalls: any[] = [];
  let showErrorCalls: any[] = [];
  let updateRevisionCalls: any[] = [];
  let configGetCalls: any[] = [];

  setup(() => {
    update = new Update();

    // Mock Repository
    mockRepository = {
      updateRevision: async (ignoreExternals: boolean) => {
        updateRevisionCalls.push({ ignoreExternals });
        return "Updated to revision 123.";
      }
    };

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

    // Mock configuration.get
    origConfigGet = configuration.get;
    (configuration as any).get = (key: string, defaultValue?: any) => {
      configGetCalls.push({ key, defaultValue });
      // Default behavior
      if (key === "update.ignoreExternals") {
        return false;
      }
      if (key === "showUpdateMessage") {
        return true;
      }
      return defaultValue;
    };

    // Clear call tracking
    showInfoCalls = [];
    showErrorCalls = [];
    updateRevisionCalls = [];
    configGetCalls = [];
  });

  teardown(() => {
    update.dispose();
    (window as any).showInformationMessage = origShowInfo;
    (window as any).showErrorMessage = origShowError;
    (configuration as any).get = origConfigGet;
  });

  suite("Basic Update", () => {
    test("should update repository with default config", async () => {
      await update.execute(mockRepository as Repository);

      assert.strictEqual(updateRevisionCalls.length, 1);
      assert.strictEqual(updateRevisionCalls[0].ignoreExternals, false);
      assert.strictEqual(showInfoCalls.length, 1);
      assert.strictEqual(showInfoCalls[0].message, "Updated to revision 123.");
    });

    test("should call updateRevision on repository", async () => {
      await update.execute(mockRepository as Repository);

      assert.strictEqual(updateRevisionCalls.length, 1);
      assert.ok(typeof updateRevisionCalls[0].ignoreExternals === "boolean");
    });

    test("should display success message", async () => {
      await update.execute(mockRepository as Repository);

      assert.strictEqual(showInfoCalls.length, 1);
      assert.ok(showInfoCalls[0].message.includes("Updated to revision"));
    });

    test("should read configuration values", async () => {
      await update.execute(mockRepository as Repository);

      const ignoreExternalsCall = configGetCalls.find(
        c => c.key === "update.ignoreExternals"
      );
      const showMessageCall = configGetCalls.find(
        c => c.key === "showUpdateMessage"
      );

      assert.ok(ignoreExternalsCall, "Should read update.ignoreExternals");
      assert.ok(showMessageCall, "Should read showUpdateMessage");
    });
  });

  suite("Ignore Externals Config", () => {
    test("should ignore externals when config is true", async () => {
      (configuration as any).get = (key: string, defaultValue?: any) => {
        configGetCalls.push({ key, defaultValue });
        if (key === "update.ignoreExternals") {
          return true;
        }
        if (key === "showUpdateMessage") {
          return true;
        }
        return defaultValue;
      };

      await update.execute(mockRepository as Repository);

      assert.strictEqual(updateRevisionCalls.length, 1);
      assert.strictEqual(updateRevisionCalls[0].ignoreExternals, true);
    });

    test("should not ignore externals when config is false", async () => {
      (configuration as any).get = (key: string, defaultValue?: any) => {
        configGetCalls.push({ key, defaultValue });
        if (key === "update.ignoreExternals") {
          return false;
        }
        if (key === "showUpdateMessage") {
          return true;
        }
        return defaultValue;
      };

      await update.execute(mockRepository as Repository);

      assert.strictEqual(updateRevisionCalls.length, 1);
      assert.strictEqual(updateRevisionCalls[0].ignoreExternals, false);
    });

    test("should default to false when config not set", async () => {
      (configuration as any).get = (key: string, defaultValue?: any) => {
        configGetCalls.push({ key, defaultValue });
        if (key === "showUpdateMessage") {
          return true;
        }
        return defaultValue;
      };

      await update.execute(mockRepository as Repository);

      assert.strictEqual(updateRevisionCalls.length, 1);
      assert.strictEqual(updateRevisionCalls[0].ignoreExternals, false);
    });
  });

  suite("Show Update Message Config", () => {
    test("should show message when config is true", async () => {
      (configuration as any).get = (key: string, defaultValue?: any) => {
        configGetCalls.push({ key, defaultValue });
        if (key === "update.ignoreExternals") {
          return false;
        }
        if (key === "showUpdateMessage") {
          return true;
        }
        return defaultValue;
      };

      await update.execute(mockRepository as Repository);

      assert.strictEqual(showInfoCalls.length, 1);
      assert.strictEqual(showInfoCalls[0].message, "Updated to revision 123.");
    });

    test("should not show message when config is false", async () => {
      (configuration as any).get = (key: string, defaultValue?: any) => {
        configGetCalls.push({ key, defaultValue });
        if (key === "update.ignoreExternals") {
          return false;
        }
        if (key === "showUpdateMessage") {
          return false;
        }
        return defaultValue;
      };

      await update.execute(mockRepository as Repository);

      assert.strictEqual(showInfoCalls.length, 0);
      assert.strictEqual(updateRevisionCalls.length, 1);
    });

    test("should default to true when config not set", async () => {
      (configuration as any).get = (key: string, defaultValue?: any) => {
        configGetCalls.push({ key, defaultValue });
        if (key === "update.ignoreExternals") {
          return false;
        }
        return defaultValue;
      };

      await update.execute(mockRepository as Repository);

      assert.strictEqual(showInfoCalls.length, 1);
    });
  });

  suite("Error Handling", () => {
    test("should handle update failure", async () => {
      mockRepository.updateRevision = async () => {
        throw new Error("svn: E155004: Working copy locked");
      };

      await update.execute(mockRepository as Repository);

      assert.strictEqual(showErrorCalls.length, 1);
      assert.strictEqual(showErrorCalls[0].message, "Unable to update");
      assert.strictEqual(showInfoCalls.length, 0);
    });

    test("should handle network error", async () => {
      mockRepository.updateRevision = async () => {
        throw new Error("svn: E170013: Unable to connect to repository");
      };

      await update.execute(mockRepository as Repository);

      assert.strictEqual(showErrorCalls.length, 1);
      assert.strictEqual(showErrorCalls[0].message, "Unable to update");
    });

    test("should handle authentication error", async () => {
      mockRepository.updateRevision = async () => {
        throw new Error("svn: E215004: Authentication failed");
      };

      await update.execute(mockRepository as Repository);

      assert.strictEqual(showErrorCalls.length, 1);
      assert.strictEqual(showErrorCalls[0].message, "Unable to update");
    });

    test("should not show success message on error", async () => {
      mockRepository.updateRevision = async () => {
        throw new Error("svn: Update failed");
      };

      await update.execute(mockRepository as Repository);

      assert.strictEqual(showInfoCalls.length, 0);
      assert.strictEqual(showErrorCalls.length, 1);
    });

    test("should handle conflict during update", async () => {
      mockRepository.updateRevision = async () => {
        throw new Error("svn: E155015: Conflict found during update");
      };

      await update.execute(mockRepository as Repository);

      assert.strictEqual(showErrorCalls.length, 1);
      assert.strictEqual(showErrorCalls[0].message, "Unable to update");
    });

    test("should handle out of date working copy", async () => {
      mockRepository.updateRevision = async () => {
        throw new Error("svn: E155036: Working copy is out of date");
      };

      await update.execute(mockRepository as Repository);

      assert.strictEqual(showErrorCalls.length, 1);
    });
  });

  suite("Update Messages", () => {
    test("should display revision number in message", async () => {
      mockRepository.updateRevision = async () => "Updated to revision 456.";

      await update.execute(mockRepository as Repository);

      assert.strictEqual(showInfoCalls.length, 1);
      assert.ok(showInfoCalls[0].message.includes("456"));
    });

    test("should display 'At revision' message", async () => {
      mockRepository.updateRevision = async () => "At revision 789.";

      await update.execute(mockRepository as Repository);

      assert.strictEqual(showInfoCalls.length, 1);
      assert.strictEqual(showInfoCalls[0].message, "At revision 789.");
    });

    test("should handle empty update message", async () => {
      mockRepository.updateRevision = async () => "";

      await update.execute(mockRepository as Repository);

      assert.strictEqual(showInfoCalls.length, 1);
      assert.strictEqual(showInfoCalls[0].message, "");
    });

    test("should display multi-line update output", async () => {
      mockRepository.updateRevision = async () =>
        "Updating '.'\nUpdated to revision 999.";

      await update.execute(mockRepository as Repository);

      assert.strictEqual(showInfoCalls.length, 1);
      assert.ok(showInfoCalls[0].message.includes("999"));
    });

    test("should handle update with file changes", async () => {
      mockRepository.updateRevision = async () =>
        "U    file1.txt\nU    file2.txt\nUpdated to revision 100.";

      await update.execute(mockRepository as Repository);

      assert.strictEqual(showInfoCalls.length, 1);
      assert.ok(showInfoCalls[0].message.includes("100"));
    });
  });

  suite("Config Combinations", () => {
    test("should handle ignoreExternals=true, showMessage=true", async () => {
      (configuration as any).get = (key: string, defaultValue?: any) => {
        if (key === "update.ignoreExternals") return true;
        if (key === "showUpdateMessage") return true;
        return defaultValue;
      };

      await update.execute(mockRepository as Repository);

      assert.strictEqual(updateRevisionCalls.length, 1);
      assert.strictEqual(updateRevisionCalls[0].ignoreExternals, true);
      assert.strictEqual(showInfoCalls.length, 1);
    });

    test("should handle ignoreExternals=true, showMessage=false", async () => {
      (configuration as any).get = (key: string, defaultValue?: any) => {
        if (key === "update.ignoreExternals") return true;
        if (key === "showUpdateMessage") return false;
        return defaultValue;
      };

      await update.execute(mockRepository as Repository);

      assert.strictEqual(updateRevisionCalls.length, 1);
      assert.strictEqual(updateRevisionCalls[0].ignoreExternals, true);
      assert.strictEqual(showInfoCalls.length, 0);
    });

    test("should handle ignoreExternals=false, showMessage=false", async () => {
      (configuration as any).get = (key: string, defaultValue?: any) => {
        if (key === "update.ignoreExternals") return false;
        if (key === "showUpdateMessage") return false;
        return defaultValue;
      };

      await update.execute(mockRepository as Repository);

      assert.strictEqual(updateRevisionCalls.length, 1);
      assert.strictEqual(updateRevisionCalls[0].ignoreExternals, false);
      assert.strictEqual(showInfoCalls.length, 0);
    });

    test("should handle all default values", async () => {
      (configuration as any).get = (_key: string, defaultValue?: any) => {
        return defaultValue;
      };

      await update.execute(mockRepository as Repository);

      assert.strictEqual(updateRevisionCalls.length, 1);
      assert.strictEqual(updateRevisionCalls[0].ignoreExternals, false);
      assert.strictEqual(showInfoCalls.length, 1);
    });
  });

  suite("Update Return Values", () => {
    test("should handle successful update return value", async () => {
      mockRepository.updateRevision = async () => "Revision 200 updated";

      await update.execute(mockRepository as Repository);

      assert.strictEqual(showInfoCalls[0].message, "Revision 200 updated");
    });

    test("should handle already up-to-date message", async () => {
      mockRepository.updateRevision = async () => "At revision 300.";

      await update.execute(mockRepository as Repository);

      assert.strictEqual(showInfoCalls[0].message, "At revision 300.");
    });

    test("should preserve exact message from updateRevision", async () => {
      const expectedMsg = "Custom update message with special chars !@#";
      mockRepository.updateRevision = async () => expectedMsg;

      (configuration as any).get = (_key: string, defaultValue?: any) => {
        if (_key === "update.ignoreExternals") return false;
        if (_key === "showUpdateMessage") return true;
        return defaultValue;
      };

      await update.execute(mockRepository as Repository);

      assert.strictEqual(showInfoCalls[0].message, expectedMsg);
    });
  });

  suite("Multiple Sequential Updates", () => {
    test("should handle multiple update calls", async () => {
      await update.execute(mockRepository as Repository);
      await update.execute(mockRepository as Repository);
      await update.execute(mockRepository as Repository);

      assert.strictEqual(updateRevisionCalls.length, 3);
      assert.strictEqual(showInfoCalls.length, 3);
    });

    test("should handle update after error", async () => {
      mockRepository.updateRevision = async () => {
        throw new Error("First update failed");
      };

      await update.execute(mockRepository as Repository);
      assert.strictEqual(showErrorCalls.length, 1);

      // Reset mock to succeed
      mockRepository.updateRevision = async () => "Updated to revision 500.";
      updateRevisionCalls = [];
      showErrorCalls = [];
      showInfoCalls = [];

      await update.execute(mockRepository as Repository);

      assert.strictEqual(updateRevisionCalls.length, 1);
      assert.strictEqual(showInfoCalls.length, 1);
      assert.strictEqual(showErrorCalls.length, 0);
    });
  });
});
