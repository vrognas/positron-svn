import * as assert from "assert";
import { Uri, window } from "vscode";
import { PromptAuth } from "../../../commands/promptAuth";
import { PromptRemove } from "../../../commands/promptRemove";
import { IAuth } from "../../../common/types";
import { configuration } from "../../../helpers/configuration";
import { Repository } from "../../../repository";

suite("Prompt Commands Tests", () => {
  // Original functions
  let origShowInputBox: typeof window.showInputBox;
  let origShowInfo: typeof window.showInformationMessage;
  let origConfigGet: typeof configuration.get;
  let origConfigUpdate: typeof configuration.update;

  // Call tracking
  let showInputBoxCalls: any[] = [];
  let showInfoCalls: any[] = [];
  let configGetCalls: any[] = [];
  let configUpdateCalls: any[] = [];

  setup(() => {
    // Track window.showInputBox calls
    origShowInputBox = window.showInputBox;
    (window as any).showInputBox = async (options: any) => {
      showInputBoxCalls.push({ options });
      return undefined; // Default to undefined
    };

    // Track window.showInformationMessage calls
    origShowInfo = window.showInformationMessage;
    (window as any).showInformationMessage = async (
      message: string,
      options: any,
      ...items: string[]
    ) => {
      showInfoCalls.push({ message, options, items });
      return undefined; // Default to undefined
    };

    // Track configuration.get calls
    origConfigGet = configuration.get;
    (configuration as any).get = <T>(section: string, defaultValue?: T): T => {
      configGetCalls.push({ section, defaultValue });
      return defaultValue as T;
    };

    // Track configuration.update calls
    origConfigUpdate = configuration.update;
    (configuration as any).update = async (section: string, value: any) => {
      configUpdateCalls.push({ section, value });
      return Promise.resolve();
    };

    // Clear call tracking arrays
    showInputBoxCalls = [];
    showInfoCalls = [];
    configGetCalls = [];
    configUpdateCalls = [];
  });

  teardown(() => {
    // Restore original functions
    (window as any).showInputBox = origShowInputBox;
    (window as any).showInformationMessage = origShowInfo;
    (configuration as any).get = origConfigGet;
    (configuration as any).update = origConfigUpdate;
  });

  suite("PromptAuth Command", () => {
    let promptAuth: PromptAuth;

    setup(() => {
      promptAuth = new PromptAuth();
    });

    teardown(() => {
      promptAuth.dispose();
    });

    test("1.1: Prompt for username and password", async () => {
      (window as any).showInputBox = async (options: any) => {
        showInputBoxCalls.push({ options });
        if (options.placeHolder.includes("username")) {
          return "testuser";
        }
        if (options.placeHolder.includes("password")) {
          return "testpass";
        }
        return undefined;
      };

      const result = await promptAuth.execute();

      assert.strictEqual(showInputBoxCalls.length, 2);
      assert.ok(result);
      assert.strictEqual((result as IAuth).username, "testuser");
      assert.strictEqual((result as IAuth).password, "testpass");
    });

    test("1.2: Username prompt cancelled (undefined)", async () => {
      (window as any).showInputBox = async () => {
        showInputBoxCalls.push({});
        return undefined; // User cancelled
      };

      const result = await promptAuth.execute();

      assert.strictEqual(showInputBoxCalls.length, 1);
      assert.strictEqual(result, undefined);
    });

    test("1.3: Password prompt cancelled (undefined)", async () => {
      (window as any).showInputBox = async (options: any) => {
        showInputBoxCalls.push({ options });
        if (options.placeHolder.includes("username")) {
          return "testuser";
        }
        return undefined; // User cancelled password
      };

      const result = await promptAuth.execute();

      assert.strictEqual(showInputBoxCalls.length, 2);
      assert.strictEqual(result, undefined);
    });

    test("1.4: Use previous username as default", async () => {
      (window as any).showInputBox = async (options: any) => {
        showInputBoxCalls.push({ options });
        if (options.placeHolder.includes("username")) {
          assert.strictEqual(options.value, "prevuser");
          return "newuser";
        }
        return "newpass";
      };

      const result = await promptAuth.execute("prevuser");

      assert.ok(result);
      assert.strictEqual((result as IAuth).username, "newuser");
    });

    test("1.5: Use previous password as default", async () => {
      (window as any).showInputBox = async (options: any) => {
        showInputBoxCalls.push({ options });
        if (options.placeHolder.includes("username")) {
          return "testuser";
        }
        if (options.placeHolder.includes("password")) {
          assert.strictEqual(options.value, "prevpass");
          return "newpass";
        }
        return undefined;
      };

      const result = await promptAuth.execute(undefined, "prevpass");

      assert.ok(result);
      assert.strictEqual((result as IAuth).password, "newpass");
    });

    test("1.6: Use both previous username and password", async () => {
      (window as any).showInputBox = async (options: any) => {
        showInputBoxCalls.push({ options });
        if (options.placeHolder.includes("username")) {
          assert.strictEqual(options.value, "prevuser");
          return "prevuser"; // Keep previous
        }
        if (options.placeHolder.includes("password")) {
          assert.strictEqual(options.value, "prevpass");
          return "prevpass"; // Keep previous
        }
        return undefined;
      };

      const result = await promptAuth.execute("prevuser", "prevpass");

      assert.ok(result);
      assert.strictEqual((result as IAuth).username, "prevuser");
      assert.strictEqual((result as IAuth).password, "prevpass");
    });

    test("1.7: Empty username string", async () => {
      (window as any).showInputBox = async (options: any) => {
        showInputBoxCalls.push({ options });
        if (options.placeHolder.includes("username")) {
          return "";
        }
        return "testpass";
      };

      const result = await promptAuth.execute();

      assert.ok(result);
      assert.strictEqual((result as IAuth).username, "");
      assert.strictEqual((result as IAuth).password, "testpass");
    });

    test("1.8: Empty password string", async () => {
      (window as any).showInputBox = async (options: any) => {
        showInputBoxCalls.push({ options });
        if (options.placeHolder.includes("username")) {
          return "testuser";
        }
        return "";
      };

      const result = await promptAuth.execute();

      assert.ok(result);
      assert.strictEqual((result as IAuth).username, "testuser");
      assert.strictEqual((result as IAuth).password, "");
    });

    test("1.9: Username prompt properties", async () => {
      (window as any).showInputBox = async (options: any) => {
        showInputBoxCalls.push({ options });
        if (options.placeHolder.includes("username")) {
          assert.strictEqual(options.ignoreFocusOut, true);
          assert.ok(options.prompt.includes("username"));
          assert.strictEqual(options.password, undefined);
          return "testuser";
        }
        return "testpass";
      };

      await promptAuth.execute();

      assert.ok(true);
    });

    test("1.10: Password prompt properties", async () => {
      (window as any).showInputBox = async (options: any) => {
        showInputBoxCalls.push({ options });
        if (options.placeHolder.includes("username")) {
          return "testuser";
        }
        if (options.placeHolder.includes("password")) {
          assert.strictEqual(options.ignoreFocusOut, true);
          assert.ok(options.prompt.includes("password"));
          assert.strictEqual(options.password, true);
          return "testpass";
        }
        return undefined;
      };

      await promptAuth.execute();

      assert.ok(true);
    });

    test("1.11: Sequential prompt execution", async () => {
      let callOrder = 0;
      (window as any).showInputBox = async (options: any) => {
        showInputBoxCalls.push({ options });
        if (options.placeHolder.includes("username")) {
          assert.strictEqual(callOrder, 0, "Username should be prompted first");
          callOrder = 1;
          return "testuser";
        }
        if (options.placeHolder.includes("password")) {
          assert.strictEqual(
            callOrder,
            1,
            "Password should be prompted second"
          );
          callOrder = 2;
          return "testpass";
        }
        return undefined;
      };

      await promptAuth.execute();

      assert.strictEqual(callOrder, 2);
    });

    test("1.12: Return type matches IAuth interface", async () => {
      (window as any).showInputBox = async (options: any) => {
        if (options.placeHolder.includes("username")) {
          return "testuser";
        }
        return "testpass";
      };

      const result = await promptAuth.execute();

      assert.ok(result);
      assert.ok("username" in result);
      assert.ok("password" in result);
      assert.strictEqual(Object.keys(result).length, 2);
    });
  });

  suite("PromptRemove Command", () => {
    let promptRemove: PromptRemove;
    let mockRepository: Partial<Repository>;
    let removeFilesCalls: any[] = [];

    setup(() => {
      promptRemove = new PromptRemove();
      removeFilesCalls = [];

      mockRepository = {
        repository: {
          removeAbsolutePath: (path: string) => {
            return path.replace("/test/repo/", "");
          }
        } as any,
        removeFiles: async (
          files: string[],
          keepLocal: boolean
        ): Promise<string> => {
          removeFilesCalls.push({ files, keepLocal });
          return "Files removed";
        }
      };
    });

    teardown(() => {
      promptRemove.dispose();
    });

    test("2.1: Single file removal confirmed", async () => {
      const uri = Uri.file("/test/repo/file.txt");
      (window as any).showInformationMessage = async (
        message: string,
        _options: any,
        ...items: string[]
      ) => {
        showInfoCalls.push({ message, items });
        assert.ok(message.includes("file.txt"));
        return "Yes";
      };

      await promptRemove.execute(mockRepository as Repository, uri);

      assert.strictEqual(removeFilesCalls.length, 1);
      assert.deepStrictEqual(removeFilesCalls[0].files, [
        "/test/repo/file.txt"
      ]);
      assert.strictEqual(removeFilesCalls[0].keepLocal, false);
    });

    test("2.2: Multiple files removal confirmed", async () => {
      const uri1 = Uri.file("/test/repo/file1.txt");
      const uri2 = Uri.file("/test/repo/file2.txt");
      (window as any).showInformationMessage = async (
        message: string,
        _options: any,
        ...items: string[]
      ) => {
        showInfoCalls.push({ message, items });
        assert.ok(message.includes("file1.txt"));
        assert.ok(message.includes("file2.txt"));
        return "Yes";
      };

      await promptRemove.execute(mockRepository as Repository, uri1, uri2);

      assert.strictEqual(removeFilesCalls.length, 1);
      assert.strictEqual(removeFilesCalls[0].files.length, 2);
    });

    test("2.3: User selects No (no removal)", async () => {
      const uri = Uri.file("/test/repo/file.txt");
      (window as any).showInformationMessage = async () => {
        return "No";
      };

      await promptRemove.execute(mockRepository as Repository, uri);

      assert.strictEqual(removeFilesCalls.length, 0);
      assert.strictEqual(configUpdateCalls.length, 0);
    });

    test("2.4: User cancels prompt (undefined)", async () => {
      const uri = Uri.file("/test/repo/file.txt");
      (window as any).showInformationMessage = async () => {
        return undefined;
      };

      await promptRemove.execute(mockRepository as Repository, uri);

      assert.strictEqual(removeFilesCalls.length, 0);
      assert.strictEqual(configUpdateCalls.length, 0);
    });

    test("2.5: Add to ignored list", async () => {
      const uri = Uri.file("/test/repo/file.txt");
      (window as any).showInformationMessage = async () => {
        return "Add to ignored list";
      };

      await promptRemove.execute(mockRepository as Repository, uri);

      assert.strictEqual(removeFilesCalls.length, 0);
      assert.strictEqual(configGetCalls.length, 1);
      assert.strictEqual(
        configGetCalls[0].section,
        "delete.ignoredRulesForDeletedFiles"
      );
      assert.strictEqual(configUpdateCalls.length, 1);
      assert.strictEqual(
        configUpdateCalls[0].section,
        "delete.ignoredRulesForDeletedFiles"
      );
      assert.ok(Array.isArray(configUpdateCalls[0].value));
      assert.ok(configUpdateCalls[0].value.includes("file.txt"));
    });

    test("2.6: Add multiple files to ignored list", async () => {
      const uri1 = Uri.file("/test/repo/file1.txt");
      const uri2 = Uri.file("/test/repo/file2.txt");
      (window as any).showInformationMessage = async () => {
        return "Add to ignored list";
      };

      await promptRemove.execute(mockRepository as Repository, uri1, uri2);

      assert.strictEqual(configUpdateCalls.length, 1);
      const value = configUpdateCalls[0].value;
      assert.ok(value.includes("file1.txt"));
      assert.ok(value.includes("file2.txt"));
    });

    test("2.7: Remove duplicates from ignore list", async () => {
      const uri = Uri.file("/test/repo/file.txt");
      (configuration as any).get = <T>(
        section: string,
        defaultValue?: T
      ): T => {
        configGetCalls.push({ section, defaultValue });
        if (section === "delete.ignoredRulesForDeletedFiles") {
          return ["file.txt", "other.txt"] as T;
        }
        return defaultValue as T;
      };

      (window as any).showInformationMessage = async () => {
        return "Add to ignored list";
      };

      await promptRemove.execute(mockRepository as Repository, uri);

      assert.strictEqual(configUpdateCalls.length, 1);
      const value = configUpdateCalls[0].value;
      assert.strictEqual(
        value.filter((v: string) => v === "file.txt").length,
        1
      );
      assert.ok(value.includes("other.txt"));
    });

    test("2.8: Files sorted in message", async () => {
      const uri1 = Uri.file("/test/repo/z-file.txt");
      const uri2 = Uri.file("/test/repo/a-file.txt");
      (window as any).showInformationMessage = async (
        message: string,
        _options: any
      ) => {
        showInfoCalls.push({ message });
        const match = message.match(/"([^"]+)"/);
        if (match) {
          const fileList = match[1]!;
          const files = fileList.split(", ");
          assert.strictEqual(files[0], "a-file.txt");
          assert.strictEqual(files[1], "z-file.txt");
        }
        return "Yes";
      };

      await promptRemove.execute(mockRepository as Repository, uri1, uri2);

      assert.ok(true);
    });

    test("2.9: Relative paths in message", async () => {
      const uri = Uri.file("/test/repo/subdir/file.txt");
      mockRepository.repository!.removeAbsolutePath = (path: string) => {
        return path.replace("/test/repo/", "");
      };

      (window as any).showInformationMessage = async (
        message: string,
        _options: any
      ) => {
        showInfoCalls.push({ message });
        assert.ok(message.includes("subdir/file.txt"));
        assert.ok(!message.includes("/test/repo/"));
        return "Yes";
      };

      await promptRemove.execute(mockRepository as Repository, uri);

      assert.ok(true);
    });

    test("2.10: Modal option set to false", async () => {
      const uri = Uri.file("/test/repo/file.txt");
      (window as any).showInformationMessage = async (
        _message: string,
        options: any,
        ..._items: string[]
      ) => {
        showInfoCalls.push({ options });
        assert.strictEqual(options.modal, false);
        return "Yes";
      };

      await promptRemove.execute(mockRepository as Repository, uri);

      assert.ok(true);
    });

    test("2.11: All three button options present", async () => {
      const uri = Uri.file("/test/repo/file.txt");
      (window as any).showInformationMessage = async (
        _message: string,
        _options: any,
        ...items: string[]
      ) => {
        showInfoCalls.push({ items });
        assert.strictEqual(items.length, 3);
        assert.ok(items.includes("Yes"));
        assert.ok(items.includes("Add to ignored list"));
        assert.ok(items.includes("No"));
        return "Yes";
      };

      await promptRemove.execute(mockRepository as Repository, uri);

      assert.ok(true);
    });

    test("2.12: Empty URIs array", async () => {
      let messageShown = false;
      (window as any).showInformationMessage = async () => {
        messageShown = true;
        return "Yes";
      };

      await promptRemove.execute(mockRepository as Repository);

      assert.ok(messageShown);
      assert.strictEqual(removeFilesCalls.length, 1);
      assert.strictEqual(removeFilesCalls[0].files.length, 0);
    });
  });

  suite("Edge Cases & Complex Scenarios", () => {
    let promptAuth: PromptAuth;
    let promptRemove: PromptRemove;
    let mockRepository: Partial<Repository>;
    let removeFilesCalls: any[] = [];

    setup(() => {
      promptAuth = new PromptAuth();
      promptRemove = new PromptRemove();
      removeFilesCalls = [];

      mockRepository = {
        repository: {
          removeAbsolutePath: (path: string) => {
            return path.replace("/test/repo/", "");
          }
        } as any,
        removeFiles: async (
          files: string[],
          keepLocal: boolean
        ): Promise<string> => {
          removeFilesCalls.push({ files, keepLocal });
          return "Files removed";
        }
      };
    });

    teardown(() => {
      promptAuth.dispose();
      promptRemove.dispose();
    });

    test("3.1: Auth with special characters in password", async () => {
      (window as any).showInputBox = async (options: any) => {
        if (options.placeHolder.includes("username")) {
          return "user@domain.com";
        }
        return "p@$$w0rd!#%";
      };

      const result = await promptAuth.execute();

      assert.ok(result);
      assert.strictEqual((result as IAuth).username, "user@domain.com");
      assert.strictEqual((result as IAuth).password, "p@$$w0rd!#%");
    });

    test("3.2: Auth with whitespace in credentials", async () => {
      (window as any).showInputBox = async (options: any) => {
        if (options.placeHolder.includes("username")) {
          return " user ";
        }
        return " pass ";
      };

      const result = await promptAuth.execute();

      assert.ok(result);
      assert.strictEqual((result as IAuth).username, " user ");
      assert.strictEqual((result as IAuth).password, " pass ");
    });

    test("3.3: Remove with file paths containing spaces", async () => {
      const uri = Uri.file("/test/repo/file with spaces.txt");
      (window as any).showInformationMessage = async (
        message: string,
        _options: any
      ) => {
        assert.ok(message.includes("file with spaces.txt"));
        return "Yes";
      };

      await promptRemove.execute(mockRepository as Repository, uri);

      assert.strictEqual(removeFilesCalls.length, 1);
      assert.ok(removeFilesCalls[0].files[0].includes("file with spaces.txt"));
    });

    test("3.4: Remove with file paths containing special characters", async () => {
      const uri = Uri.file("/test/repo/file@#$.txt");
      (window as any).showInformationMessage = async () => {
        return "Yes";
      };

      await promptRemove.execute(mockRepository as Repository, uri);

      assert.strictEqual(removeFilesCalls.length, 1);
      assert.ok(removeFilesCalls[0].files[0].includes("file@#$.txt"));
    });

    test("3.5: Large number of files to remove", async () => {
      const uris = [];
      for (let i = 0; i < 50; i++) {
        uris.push(Uri.file(`/test/repo/file${i}.txt`));
      }

      (window as any).showInformationMessage = async () => {
        return "Yes";
      };

      await promptRemove.execute(mockRepository as Repository, ...uris);

      assert.strictEqual(removeFilesCalls.length, 1);
      assert.strictEqual(removeFilesCalls[0].files.length, 50);
    });

    test("3.6: Add large number of files to ignore list", async () => {
      const uris = [];
      for (let i = 0; i < 20; i++) {
        uris.push(Uri.file(`/test/repo/file${i}.txt`));
      }

      (window as any).showInformationMessage = async () => {
        return "Add to ignored list";
      };

      await promptRemove.execute(mockRepository as Repository, ...uris);

      assert.strictEqual(configUpdateCalls.length, 1);
      assert.strictEqual(configUpdateCalls[0].value.length, 20);
    });

    test("3.7: Ignore list merge with existing entries", async () => {
      const uri1 = Uri.file("/test/repo/new1.txt");
      const uri2 = Uri.file("/test/repo/new2.txt");

      (configuration as any).get = <T>(
        section: string,
        defaultValue?: T
      ): T => {
        if (section === "delete.ignoredRulesForDeletedFiles") {
          return ["existing1.txt", "existing2.txt"] as T;
        }
        return defaultValue as T;
      };

      (window as any).showInformationMessage = async () => {
        return "Add to ignored list";
      };

      await promptRemove.execute(mockRepository as Repository, uri1, uri2);

      assert.strictEqual(configUpdateCalls.length, 1);
      const value = configUpdateCalls[0].value;
      assert.strictEqual(value.length, 4);
      assert.ok(value.includes("existing1.txt"));
      assert.ok(value.includes("existing2.txt"));
      assert.ok(value.includes("new1.txt"));
      assert.ok(value.includes("new2.txt"));
    });

    test("3.8: Auth with very long credentials", async () => {
      const longUsername = "a".repeat(200);
      const longPassword = "b".repeat(200);

      (window as any).showInputBox = async (options: any) => {
        if (options.placeHolder.includes("username")) {
          return longUsername;
        }
        return longPassword;
      };

      const result = await promptAuth.execute();

      assert.ok(result);
      assert.strictEqual((result as IAuth).username.length, 200);
      assert.strictEqual((result as IAuth).password.length, 200);
    });

    test("3.9: Remove with nested directory paths", async () => {
      const uri = Uri.file("/test/repo/a/b/c/file.txt");
      mockRepository.repository!.removeAbsolutePath = (path: string) => {
        return path.replace("/test/repo/", "");
      };

      (window as any).showInformationMessage = async (message: string) => {
        assert.ok(message.includes("a/b/c/file.txt"));
        return "Yes";
      };

      await promptRemove.execute(mockRepository as Repository, uri);

      assert.ok(true);
    });

    test("3.10: Duplicate URIs in remove list", async () => {
      const uri = Uri.file("/test/repo/file.txt");
      (window as any).showInformationMessage = async () => {
        return "Yes";
      };

      await promptRemove.execute(mockRepository as Repository, uri, uri, uri);

      assert.strictEqual(removeFilesCalls.length, 1);
      assert.strictEqual(removeFilesCalls[0].files.length, 3);
    });
  });
});
