import * as assert from "assert";
import { Uri, window } from "vscode";
import { Add } from "../../../commands/add";
import { Remove } from "../../../commands/remove";
import { Resource } from "../../../resource";
import { Repository } from "../../../repository";
import { Status, IExecutionResult } from "../../../common/types";

suite("Add Command Tests", () => {
  let addCmd: Add;
  let mockRepository: Partial<Repository>;
  let addFilesCalls: string[][];
  let showErrorCalls: string[];

  setup(() => {
    addCmd = new Add();
    addFilesCalls = [];
    showErrorCalls = [];

    // Mock Repository.addFiles()
    mockRepository = {
      addFiles: async (files: string[]): Promise<IExecutionResult> => {
        addFilesCalls.push(files);
        return { exitCode: 0, stdout: "", stderr: "" };
      }
    };

    // Mock window.showErrorMessage
    (window as any).showErrorMessage = (msg: string) => {
      showErrorCalls.push(msg);
      return Promise.resolve(undefined);
    };
  });

  teardown(() => {
    addCmd.dispose();
  });

  test("add single unversioned file", async () => {
    const fileUri = Uri.file("/workspace/newfile.txt");
    const resource = new Resource(fileUri, Status.UNVERSIONED);

    // Mock getResourceStates to return our resource
    const origGetResourceStates = (addCmd as any).getResourceStates;
    (addCmd as any).getResourceStates = async () => [resource];

    // Mock runByRepository to execute operation immediately
    const origRunByRepository = (addCmd as any).runByRepository;
    (addCmd as any).runByRepository = async (uris: any, fn: any) => {
      await fn(
        mockRepository,
        uris.map((u: Uri) => u.fsPath)
      );
    };

    await addCmd.execute(resource);

    assert.strictEqual(addFilesCalls.length, 1);
    assert.deepStrictEqual(addFilesCalls[0]!, ["/workspace/newfile.txt"]);
    assert.strictEqual(showErrorCalls.length, 0);

    (addCmd as any).getResourceStates = origGetResourceStates;
    (addCmd as any).runByRepository = origRunByRepository;
  });

  test("add multiple unversioned files", async () => {
    const file1 = Uri.file("/workspace/file1.txt");
    const file2 = Uri.file("/workspace/file2.txt");
    const file3 = Uri.file("/workspace/file3.txt");

    const resource1 = new Resource(file1, Status.UNVERSIONED);
    const resource2 = new Resource(file2, Status.UNVERSIONED);
    const resource3 = new Resource(file3, Status.UNVERSIONED);

    (addCmd as any).getResourceStates = async () => [
      resource1,
      resource2,
      resource3
    ];
    (addCmd as any).runByRepository = async (uris: any, fn: any) => {
      await fn(
        mockRepository,
        uris.map((u: Uri) => u.fsPath)
      );
    };

    await addCmd.execute(resource1, resource2, resource3);

    assert.strictEqual(addFilesCalls.length, 1);
    assert.deepStrictEqual(addFilesCalls[0]!, [
      "/workspace/file1.txt",
      "/workspace/file2.txt",
      "/workspace/file3.txt"
    ]);
  });

  test("add with UNVERSIONED status validation", async () => {
    const fileUri = Uri.file("/workspace/test.txt");
    const resource = new Resource(fileUri, Status.UNVERSIONED);

    assert.strictEqual(resource.type, Status.UNVERSIONED);

    (addCmd as any).getResourceStates = async () => [resource];
    (addCmd as any).runByRepository = async (uris: any, fn: any) => {
      await fn(
        mockRepository,
        uris.map((u: Uri) => u.fsPath)
      );
    };

    await addCmd.execute(resource);

    assert.strictEqual(addFilesCalls.length, 1);
  });

  test("add with no resources returns early", async () => {
    (addCmd as any).getResourceStates = async () => [];
    (addCmd as any).runByRepository = async () => {
      throw new Error("Should not be called");
    };

    await addCmd.execute();

    assert.strictEqual(addFilesCalls.length, 0);
  });

  test("add with wrong status (MODIFIED) still attempts", async () => {
    const fileUri = Uri.file("/workspace/modified.txt");
    const resource = new Resource(fileUri, Status.MODIFIED);

    // executeOnResources doesn't validate status - it passes all resources
    (addCmd as any).getResourceStates = async () => [resource];
    (addCmd as any).runByRepository = async (uris: any, fn: any) => {
      await fn(
        mockRepository,
        uris.map((u: Uri) => u.fsPath)
      );
    };

    await addCmd.execute(resource);

    assert.strictEqual(addFilesCalls.length, 1);
    assert.deepStrictEqual(addFilesCalls[0]!, ["/workspace/modified.txt"]);
  });

  test("add handles repository error", async () => {
    const fileUri = Uri.file("/workspace/error.txt");
    const resource = new Resource(fileUri, Status.UNVERSIONED);

    mockRepository.addFiles = async () => {
      throw new Error("SVN add failed");
    };

    (addCmd as any).getResourceStates = async () => [resource];
    (addCmd as any).runByRepository = async (uris: any, fn: any) => {
      await fn(
        mockRepository,
        uris.map((u: Uri) => u.fsPath)
      );
    };

    await addCmd.execute(resource);

    assert.strictEqual(showErrorCalls.length, 1);
    assert.strictEqual(showErrorCalls[0], "Unable to add file");
    assert.strictEqual(addFilesCalls.length, 0);
  });

  test("add calls Repository.addFiles with correct paths", async () => {
    const files = [
      Uri.file("/repo/src/main.ts"),
      Uri.file("/repo/src/utils.ts")
    ];

    const resources = files.map(f => new Resource(f, Status.UNVERSIONED));

    (addCmd as any).getResourceStates = async () => resources;
    (addCmd as any).runByRepository = async (uris: any, fn: any) => {
      await fn(
        mockRepository,
        uris.map((u: Uri) => u.fsPath)
      );
    };

    await addCmd.execute(...resources);

    assert.strictEqual(addFilesCalls.length, 1);
    assert.deepStrictEqual(addFilesCalls[0]!, [
      "/repo/src/main.ts",
      "/repo/src/utils.ts"
    ]);
  });
});

suite("Remove Command Tests", () => {
  let removeCmd: Remove;
  let mockRepository: Partial<Repository>;
  let removeFilesCalls: Array<{ files: string[]; keepLocal: boolean }>;
  let windowWarningCalls: Array<{
    message: string;
    options: any;
    buttons: string[];
  }>;
  let warningResponses: (string | undefined)[];
  let showErrorCalls: string[];

  setup(() => {
    removeCmd = new Remove();
    removeFilesCalls = [];
    windowWarningCalls = [];
    warningResponses = [];
    showErrorCalls = [];

    // Mock Repository.removeFiles()
    mockRepository = {
      removeFiles: async (
        files: string[],
        keepLocal: boolean
      ): Promise<string> => {
        removeFilesCalls.push({ files, keepLocal });
        return "";
      }
    };

    // Mock window.showWarningMessage
    (window as any).showWarningMessage = async (
      message: string,
      options: any,
      ...buttons: string[]
    ) => {
      windowWarningCalls.push({ message, options, buttons });
      return warningResponses.shift();
    };

    // Mock window.showErrorMessage
    (window as any).showErrorMessage = (msg: string) => {
      showErrorCalls.push(msg);
      return Promise.resolve(undefined);
    };
  });

  teardown(() => {
    removeCmd.dispose();
  });

  test("remove single file - keep local copy (Yes)", async () => {
    warningResponses.push("Yes");

    const fileUri = Uri.file("/workspace/file.txt");
    const resource = new Resource(fileUri, Status.ADDED);

    (removeCmd as any).getResourceStatesOrExit = async () => [resource];
    (removeCmd as any).runByRepository = async (uris: any, fn: any) => {
      await fn(
        mockRepository,
        uris.map((u: Uri) => u.fsPath)
      );
    };

    await removeCmd.execute(resource);

    assert.strictEqual(windowWarningCalls.length, 1);
    assert.strictEqual(
      windowWarningCalls[0]!.message,
      "Would you like to keep a local copy of the files?"
    );
    assert.strictEqual(removeFilesCalls.length, 1);
    assert.deepStrictEqual(removeFilesCalls[0]!.files, ["/workspace/file.txt"]);
    assert.strictEqual(removeFilesCalls[0]!.keepLocal, true);
  });

  test("remove single file - delete local copy (No)", async () => {
    warningResponses.push("No");

    const fileUri = Uri.file("/workspace/file.txt");
    const resource = new Resource(fileUri, Status.ADDED);

    (removeCmd as any).getResourceStatesOrExit = async () => [resource];
    (removeCmd as any).runByRepository = async (uris: any, fn: any) => {
      await fn(
        mockRepository,
        uris.map((u: Uri) => u.fsPath)
      );
    };

    await removeCmd.execute(resource);

    assert.strictEqual(removeFilesCalls.length, 1);
    assert.deepStrictEqual(removeFilesCalls[0]!.files, ["/workspace/file.txt"]);
    assert.strictEqual(removeFilesCalls[0]!.keepLocal, false);
  });

  test("remove multiple files - keep local copy", async () => {
    warningResponses.push("Yes");

    const files = [
      Uri.file("/workspace/file1.txt"),
      Uri.file("/workspace/file2.txt"),
      Uri.file("/workspace/file3.txt")
    ];

    const resources = files.map(f => new Resource(f, Status.ADDED));

    (removeCmd as any).getResourceStatesOrExit = async () => resources;
    (removeCmd as any).runByRepository = async (uris: any, fn: any) => {
      await fn(
        mockRepository,
        uris.map((u: Uri) => u.fsPath)
      );
    };

    await removeCmd.execute(...resources);

    assert.strictEqual(removeFilesCalls.length, 1);
    assert.deepStrictEqual(removeFilesCalls[0]!.files, [
      "/workspace/file1.txt",
      "/workspace/file2.txt",
      "/workspace/file3.txt"
    ]);
    assert.strictEqual(removeFilesCalls[0]!.keepLocal, true);
  });

  test("remove multiple files - delete local copy", async () => {
    warningResponses.push("No");

    const files = [
      Uri.file("/workspace/file1.txt"),
      Uri.file("/workspace/file2.txt")
    ];

    const resources = files.map(f => new Resource(f, Status.MODIFIED));

    (removeCmd as any).getResourceStatesOrExit = async () => resources;
    (removeCmd as any).runByRepository = async (uris: any, fn: any) => {
      await fn(
        mockRepository,
        uris.map((u: Uri) => u.fsPath)
      );
    };

    await removeCmd.execute(...resources);

    assert.strictEqual(removeFilesCalls.length, 1);
    assert.deepStrictEqual(removeFilesCalls[0]!.files, [
      "/workspace/file1.txt",
      "/workspace/file2.txt"
    ]);
    assert.strictEqual(removeFilesCalls[0]!.keepLocal, false);
  });

  test("remove with user cancellation", async () => {
    warningResponses.push(undefined); // User clicks Cancel

    const fileUri = Uri.file("/workspace/file.txt");
    const resource = new Resource(fileUri, Status.ADDED);

    (removeCmd as any).getResourceStatesOrExit = async () => [resource];
    (removeCmd as any).runByRepository = async () => {
      throw new Error("Should not be called");
    };

    await removeCmd.execute(resource);

    assert.strictEqual(windowWarningCalls.length, 1);
    assert.strictEqual(
      removeFilesCalls.length,
      0,
      "Should not call removeFiles"
    );
  });

  test("remove with no resources returns early", async () => {
    (removeCmd as any).getResourceStatesOrExit = async () => null;
    (removeCmd as any).runByRepository = async () => {
      throw new Error("Should not be called");
    };

    await removeCmd.execute();

    assert.strictEqual(windowWarningCalls.length, 0);
    assert.strictEqual(removeFilesCalls.length, 0);
  });

  test("remove shows warning message with modal option", async () => {
    warningResponses.push("Yes");

    const fileUri = Uri.file("/workspace/file.txt");
    const resource = new Resource(fileUri, Status.ADDED);

    (removeCmd as any).getResourceStatesOrExit = async () => [resource];
    (removeCmd as any).runByRepository = async (uris: any, fn: any) => {
      await fn(
        mockRepository,
        uris.map((u: Uri) => u.fsPath)
      );
    };

    await removeCmd.execute(resource);

    assert.strictEqual(windowWarningCalls.length, 1);
    const call = windowWarningCalls[0]!;
    assert.strictEqual(call.options.modal, true);
    assert.deepStrictEqual(call.buttons, ["Yes", "No"]);
  });

  test("remove handles repository error", async () => {
    warningResponses.push("Yes");

    const fileUri = Uri.file("/workspace/file.txt");
    const resource = new Resource(fileUri, Status.ADDED);

    mockRepository.removeFiles = async () => {
      throw new Error("SVN remove failed");
    };

    (removeCmd as any).getResourceStatesOrExit = async () => [resource];
    (removeCmd as any).runByRepository = async (uris: any, fn: any) => {
      await fn(
        mockRepository,
        uris.map((u: Uri) => u.fsPath)
      );
    };

    await removeCmd.execute(resource);

    assert.strictEqual(showErrorCalls.length, 1);
    assert.strictEqual(showErrorCalls[0], "Unable to remove files");
  });

  test("remove calls Repository.removeFiles with keepLocal=true", async () => {
    warningResponses.push("Yes");

    const fileUri = Uri.file("/workspace/test.txt");
    const resource = new Resource(fileUri, Status.MODIFIED);

    (removeCmd as any).getResourceStatesOrExit = async () => [resource];
    (removeCmd as any).runByRepository = async (uris: any, fn: any) => {
      await fn(
        mockRepository,
        uris.map((u: Uri) => u.fsPath)
      );
    };

    await removeCmd.execute(resource);

    assert.strictEqual(removeFilesCalls.length, 1);
    const call = removeFilesCalls[0]!;
    assert.strictEqual(call.keepLocal, true);
  });

  test("remove calls Repository.removeFiles with keepLocal=false", async () => {
    warningResponses.push("No");

    const fileUri = Uri.file("/workspace/test.txt");
    const resource = new Resource(fileUri, Status.MODIFIED);

    (removeCmd as any).getResourceStatesOrExit = async () => [resource];
    (removeCmd as any).runByRepository = async (uris: any, fn: any) => {
      await fn(
        mockRepository,
        uris.map((u: Uri) => u.fsPath)
      );
    };

    await removeCmd.execute(resource);

    assert.strictEqual(removeFilesCalls.length, 1);
    const call = removeFilesCalls[0]!;
    assert.strictEqual(call.keepLocal, false);
  });

  test("remove with mixed status files", async () => {
    warningResponses.push("Yes");

    const files = [
      Uri.file("/workspace/added.txt"),
      Uri.file("/workspace/modified.txt"),
      Uri.file("/workspace/deleted.txt")
    ];

    const resources = [
      new Resource(files[0]!, Status.ADDED),
      new Resource(files[1]!, Status.MODIFIED),
      new Resource(files[2]!, Status.DELETED)
    ];

    (removeCmd as any).getResourceStatesOrExit = async () => resources;
    (removeCmd as any).runByRepository = async (uris: any, fn: any) => {
      await fn(
        mockRepository,
        uris.map((u: Uri) => u.fsPath)
      );
    };

    await removeCmd.execute(...resources);

    assert.strictEqual(removeFilesCalls.length, 1);
    assert.deepStrictEqual(removeFilesCalls[0]!.files, [
      "/workspace/added.txt",
      "/workspace/modified.txt",
      "/workspace/deleted.txt"
    ]);
  });

  test("remove preserves file order in removal call", async () => {
    warningResponses.push("No");

    const files = [
      Uri.file("/workspace/z_file.txt"),
      Uri.file("/workspace/a_file.txt"),
      Uri.file("/workspace/m_file.txt")
    ];

    const resources = files.map(f => new Resource(f, Status.ADDED));

    (removeCmd as any).getResourceStatesOrExit = async () => resources;
    (removeCmd as any).runByRepository = async (uris: any, fn: any) => {
      await fn(
        mockRepository,
        uris.map((u: Uri) => u.fsPath)
      );
    };

    await removeCmd.execute(...resources);

    // Verify file order is preserved (not sorted)
    assert.deepStrictEqual(removeFilesCalls[0]!.files, [
      "/workspace/z_file.txt",
      "/workspace/a_file.txt",
      "/workspace/m_file.txt"
    ]);
  });
});
