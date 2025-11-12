import * as assert from "assert";
import { Refresh } from "../../../commands/refresh";
import { RefreshRemoteChanges } from "../../../commands/refreshRemoteChanges";
import { Repository } from "../../../repository";
import { configuration } from "../../../helpers/configuration";

suite("Refresh Commands Tests", () => {
  let mockRepository: Partial<Repository>;
  let origConfigGet: typeof configuration.get;

  // Call tracking
  let statusCalls: any[] = [];
  let updateRemoteChangedFilesCalls: any[] = [];
  let configGetCalls: any[] = [];

  setup(() => {
    // Mock Repository
    mockRepository = {
      status: async () => {
        statusCalls.push({});
        return undefined;
      },
      updateRemoteChangedFiles: async () => {
        updateRemoteChangedFilesCalls.push({});
        return undefined;
      }
    };

    // Mock configuration.get
    origConfigGet = configuration.get;
    (configuration as any).get = (key: string, defaultValue?: any) => {
      configGetCalls.push({ key, defaultValue });
      // Default: remoteChanges disabled
      if (key === "refresh.remoteChanges") {
        return false;
      }
      return defaultValue;
    };

    // Clear call tracking
    statusCalls = [];
    updateRemoteChangedFilesCalls = [];
    configGetCalls = [];
  });

  teardown(() => {
    (configuration as any).get = origConfigGet;
  });

  suite("Refresh Command", () => {
    let refresh: Refresh;

    setup(() => {
      refresh = new Refresh();
    });

    teardown(() => {
      refresh.dispose();
    });

    test("should call status on repository", async () => {
      await refresh.execute(mockRepository as Repository);

      assert.strictEqual(statusCalls.length, 1);
    });

    test("should not call updateRemoteChangedFiles when config disabled", async () => {
      (configuration as any).get = (key: string, defaultValue?: any) => {
        configGetCalls.push({ key, defaultValue });
        if (key === "refresh.remoteChanges") {
          return false;
        }
        return defaultValue;
      };

      await refresh.execute(mockRepository as Repository);

      assert.strictEqual(statusCalls.length, 1);
      assert.strictEqual(updateRemoteChangedFilesCalls.length, 0);
    });

    test("should call updateRemoteChangedFiles when config enabled", async () => {
      (configuration as any).get = (key: string, defaultValue?: any) => {
        configGetCalls.push({ key, defaultValue });
        if (key === "refresh.remoteChanges") {
          return true;
        }
        return defaultValue;
      };

      await refresh.execute(mockRepository as Repository);

      assert.strictEqual(statusCalls.length, 1);
      assert.strictEqual(updateRemoteChangedFilesCalls.length, 1);
    });

    test("should read refresh.remoteChanges config", async () => {
      await refresh.execute(mockRepository as Repository);

      const configCall = configGetCalls.find(
        c => c.key === "refresh.remoteChanges"
      );
      assert.ok(configCall, "Should read refresh.remoteChanges config");
      assert.strictEqual(configCall.defaultValue, false);
    });

    test("should call status before updateRemoteChangedFiles", async () => {
      const callOrder: string[] = [];

      mockRepository.status = async () => {
        callOrder.push("status");
        statusCalls.push({});
        return undefined;
      };

      mockRepository.updateRemoteChangedFiles = async () => {
        callOrder.push("updateRemoteChangedFiles");
        updateRemoteChangedFilesCalls.push({});
        return undefined;
      };

      (configuration as any).get = (key: string, defaultValue?: any) => {
        if (key === "refresh.remoteChanges") {
          return true;
        }
        return defaultValue;
      };

      await refresh.execute(mockRepository as Repository);

      assert.strictEqual(callOrder.length, 2);
      assert.strictEqual(callOrder[0], "status");
      assert.strictEqual(callOrder[1], "updateRemoteChangedFiles");
    });

    test("should handle status failure", async () => {
      mockRepository.status = async () => {
        throw new Error("svn: E155004: Working copy locked");
      };

      try {
        await refresh.execute(mockRepository as Repository);
        assert.fail("Should throw error");
      } catch (err: any) {
        assert.ok(err.message.includes("locked"));
      }
    });

    test("should handle updateRemoteChangedFiles failure", async () => {
      (configuration as any).get = (key: string, defaultValue?: any) => {
        if (key === "refresh.remoteChanges") {
          return true;
        }
        return defaultValue;
      };

      mockRepository.updateRemoteChangedFiles = async () => {
        throw new Error("svn: E170013: Unable to connect");
      };

      try {
        await refresh.execute(mockRepository as Repository);
        assert.fail("Should throw error");
      } catch (err: any) {
        assert.ok(err.message.includes("Unable to connect"));
      }
    });

    test("should not call updateRemoteChangedFiles if status fails", async () => {
      (configuration as any).get = (key: string, defaultValue?: any) => {
        if (key === "refresh.remoteChanges") {
          return true;
        }
        return defaultValue;
      };

      mockRepository.status = async () => {
        throw new Error("Status failed");
      };

      try {
        await refresh.execute(mockRepository as Repository);
      } catch {
        // Expected
      }

      assert.strictEqual(statusCalls.length, 0);
      assert.strictEqual(updateRemoteChangedFilesCalls.length, 0);
    });

    test("should handle concurrent refresh calls", async () => {
      const promises = [
        refresh.execute(mockRepository as Repository),
        refresh.execute(mockRepository as Repository),
        refresh.execute(mockRepository as Repository)
      ];

      await Promise.all(promises);

      assert.ok(
        statusCalls.length >= 1,
        "Should handle concurrent status calls"
      );
    });

    test("should handle multiple sequential refreshes", async () => {
      await refresh.execute(mockRepository as Repository);
      await refresh.execute(mockRepository as Repository);
      await refresh.execute(mockRepository as Repository);

      assert.ok(statusCalls.length >= 3);
    });

    test("should handle config change between calls", async () => {
      (configuration as any).get = (key: string, defaultValue?: any) => {
        if (key === "refresh.remoteChanges") {
          return false;
        }
        return defaultValue;
      };

      await refresh.execute(mockRepository as Repository);
      assert.strictEqual(updateRemoteChangedFilesCalls.length, 0);

      statusCalls = [];
      updateRemoteChangedFilesCalls = [];

      (configuration as any).get = (key: string, defaultValue?: any) => {
        if (key === "refresh.remoteChanges") {
          return true;
        }
        return defaultValue;
      };

      await refresh.execute(mockRepository as Repository);
      assert.strictEqual(updateRemoteChangedFilesCalls.length, 1);
    });

    test("should handle default config value", async () => {
      (configuration as any).get = (_key: string, defaultValue?: any) => {
        return defaultValue;
      };

      await refresh.execute(mockRepository as Repository);

      assert.strictEqual(statusCalls.length, 1);
      assert.strictEqual(updateRemoteChangedFilesCalls.length, 0);
    });

    test("should handle network timeout during status", async () => {
      mockRepository.status = async () => {
        throw new Error("svn: E170013: Connection timed out");
      };

      try {
        await refresh.execute(mockRepository as Repository);
        assert.fail("Should throw error");
      } catch (err: any) {
        assert.ok(err.message.includes("timed out"));
      }
    });

    test("should handle authentication error during status", async () => {
      mockRepository.status = async () => {
        throw new Error("svn: E215004: Authentication failed");
      };

      try {
        await refresh.execute(mockRepository as Repository);
        assert.fail("Should throw error");
      } catch (err: any) {
        assert.ok(err.message.includes("Authentication"));
      }
    });
  });

  suite("RefreshRemoteChanges Command", () => {
    let refreshRemoteChanges: RefreshRemoteChanges;

    setup(() => {
      refreshRemoteChanges = new RefreshRemoteChanges();
    });

    teardown(() => {
      refreshRemoteChanges.dispose();
    });

    test("should call updateRemoteChangedFiles on repository", async () => {
      await refreshRemoteChanges.execute(mockRepository as Repository);

      assert.strictEqual(updateRemoteChangedFilesCalls.length, 1);
    });

    test("should not call status", async () => {
      await refreshRemoteChanges.execute(mockRepository as Repository);

      assert.strictEqual(statusCalls.length, 0);
      assert.strictEqual(updateRemoteChangedFilesCalls.length, 1);
    });

    test("should handle updateRemoteChangedFiles failure", async () => {
      mockRepository.updateRemoteChangedFiles = async () => {
        throw new Error("svn: E170013: Unable to connect");
      };

      try {
        await refreshRemoteChanges.execute(mockRepository as Repository);
        assert.fail("Should throw error");
      } catch (err: any) {
        assert.ok(err.message.includes("Unable to connect"));
      }
    });

    test("should handle network error", async () => {
      mockRepository.updateRemoteChangedFiles = async () => {
        throw new Error("svn: E170013: Network unreachable");
      };

      try {
        await refreshRemoteChanges.execute(mockRepository as Repository);
        assert.fail("Should throw error");
      } catch (err: any) {
        assert.ok(err.message.includes("Network"));
      }
    });

    test("should handle authentication error", async () => {
      mockRepository.updateRemoteChangedFiles = async () => {
        throw new Error("svn: E215004: Authentication failed");
      };

      try {
        await refreshRemoteChanges.execute(mockRepository as Repository);
        assert.fail("Should throw error");
      } catch (err: any) {
        assert.ok(err.message.includes("Authentication"));
      }
    });

    test("should handle concurrent refresh remote changes calls", async () => {
      const promises = [
        refreshRemoteChanges.execute(mockRepository as Repository),
        refreshRemoteChanges.execute(mockRepository as Repository),
        refreshRemoteChanges.execute(mockRepository as Repository)
      ];

      await Promise.all(promises);

      assert.ok(
        updateRemoteChangedFilesCalls.length >= 1,
        "Should handle concurrent calls with debouncing"
      );
    });

    test("should handle multiple sequential calls", async () => {
      await refreshRemoteChanges.execute(mockRepository as Repository);
      await refreshRemoteChanges.execute(mockRepository as Repository);
      await refreshRemoteChanges.execute(mockRepository as Repository);

      assert.ok(updateRemoteChangedFilesCalls.length >= 1);
    });

    test("should handle repository error", async () => {
      mockRepository.updateRemoteChangedFiles = async () => {
        throw new Error("svn: E155004: Repository locked");
      };

      try {
        await refreshRemoteChanges.execute(mockRepository as Repository);
        assert.fail("Should throw error");
      } catch (err: any) {
        assert.ok(err.message.includes("locked"));
      }
    });

    test("should handle timeout error", async () => {
      mockRepository.updateRemoteChangedFiles = async () => {
        throw new Error("svn: E170013: Connection timed out");
      };

      try {
        await refreshRemoteChanges.execute(mockRepository as Repository);
        assert.fail("Should throw error");
      } catch (err: any) {
        assert.ok(err.message.includes("timed out"));
      }
    });

    test("should handle server unavailable", async () => {
      mockRepository.updateRemoteChangedFiles = async () => {
        throw new Error("svn: E170013: Server unavailable");
      };

      try {
        await refreshRemoteChanges.execute(mockRepository as Repository);
        assert.fail("Should throw error");
      } catch (err: any) {
        assert.ok(err.message.includes("unavailable"));
      }
    });
  });

  suite("Refresh vs RefreshRemoteChanges Comparison", () => {
    let refresh: Refresh;
    let refreshRemoteChanges: RefreshRemoteChanges;

    setup(() => {
      refresh = new Refresh();
      refreshRemoteChanges = new RefreshRemoteChanges();
    });

    teardown(() => {
      refresh.dispose();
      refreshRemoteChanges.dispose();
    });

    test("Refresh with remoteChanges=true should match RefreshRemoteChanges behavior", async () => {
      (configuration as any).get = (key: string, defaultValue?: any) => {
        if (key === "refresh.remoteChanges") {
          return true;
        }
        return defaultValue;
      };

      await refresh.execute(mockRepository as Repository);
      const refreshUpdateCalls = updateRemoteChangedFilesCalls.length;

      statusCalls = [];
      updateRemoteChangedFilesCalls = [];

      await refreshRemoteChanges.execute(mockRepository as Repository);
      const refreshRemoteUpdateCalls = updateRemoteChangedFilesCalls.length;

      assert.strictEqual(
        refreshUpdateCalls,
        refreshRemoteUpdateCalls,
        "Both should call updateRemoteChangedFiles once"
      );
    });

    test("Refresh calls status, RefreshRemoteChanges does not", async () => {
      await refresh.execute(mockRepository as Repository);
      const refreshStatusCalls = statusCalls.length;

      statusCalls = [];
      updateRemoteChangedFilesCalls = [];

      await refreshRemoteChanges.execute(mockRepository as Repository);
      const refreshRemoteStatusCalls = statusCalls.length;

      assert.strictEqual(refreshStatusCalls, 1);
      assert.strictEqual(refreshRemoteStatusCalls, 0);
    });

    test("Refresh with remoteChanges=false does not call updateRemoteChangedFiles", async () => {
      (configuration as any).get = (key: string, defaultValue?: any) => {
        if (key === "refresh.remoteChanges") {
          return false;
        }
        return defaultValue;
      };

      await refresh.execute(mockRepository as Repository);

      assert.strictEqual(statusCalls.length, 1);
      assert.strictEqual(updateRemoteChangedFilesCalls.length, 0);
    });
  });

  suite("Error Recovery", () => {
    let refresh: Refresh;
    let refreshRemoteChanges: RefreshRemoteChanges;

    setup(() => {
      refresh = new Refresh();
      refreshRemoteChanges = new RefreshRemoteChanges();
    });

    teardown(() => {
      refresh.dispose();
      refreshRemoteChanges.dispose();
    });

    test("Refresh should recover from status error", async () => {
      mockRepository.status = async () => {
        throw new Error("First call fails");
      };

      try {
        await refresh.execute(mockRepository as Repository);
      } catch {
        // Expected
      }

      statusCalls = [];
      mockRepository.status = async () => {
        statusCalls.push({});
        return undefined;
      };

      await refresh.execute(mockRepository as Repository);
      assert.strictEqual(statusCalls.length, 1);
    });

    test("RefreshRemoteChanges should recover from error", async () => {
      mockRepository.updateRemoteChangedFiles = async () => {
        throw new Error("First call fails");
      };

      try {
        await refreshRemoteChanges.execute(mockRepository as Repository);
      } catch {
        // Expected
      }

      updateRemoteChangedFilesCalls = [];
      mockRepository.updateRemoteChangedFiles = async () => {
        updateRemoteChangedFilesCalls.push({});
        return undefined;
      };

      await refreshRemoteChanges.execute(mockRepository as Repository);
      assert.strictEqual(updateRemoteChangedFilesCalls.length, 1);
    });

    test("Refresh should handle status success then updateRemoteChangedFiles failure", async () => {
      (configuration as any).get = (key: string, defaultValue?: any) => {
        if (key === "refresh.remoteChanges") {
          return true;
        }
        return defaultValue;
      };

      mockRepository.updateRemoteChangedFiles = async () => {
        throw new Error("Remote update failed");
      };

      try {
        await refresh.execute(mockRepository as Repository);
        assert.fail("Should throw error");
      } catch (err: any) {
        assert.ok(err.message.includes("Remote update failed"));
      }

      assert.strictEqual(statusCalls.length, 1, "Status should have been called");
    });
  });
});
