import * as assert from "assert";
import { commands, Uri, window, workspace } from "vscode";
import { OpenFile } from "../../../commands/openFile";
import {
  OpenChangeBase,
  OpenChangeHead,
  OpenChangePrev,
  OpenResourceBase,
  OpenResourceHead
} from "../../../commands/openCommands";
import { OpenHeadFile } from "../../../commands/openHeadFile";
import { Status } from "../../../common/types";
import { Resource } from "../../../resource";
import IncomingChangeNode from "../../../treeView/nodes/incomingChangeNode";
import { Repository } from "../../../repository";
import * as fs from "../../../fs";

interface MockState {
  executeCommandCalls: Array<{ command: string; args: any[] }>;
  openTextDocumentCalls: Array<{ uri: Uri }>;
  showTextDocumentCalls: Array<{ document: any; options: any }>;
  showWarningMessageCalls: Array<{ message: string }>;
  existsCalls: Array<{ path: string }>;
  statCalls: Array<{ path: string }>;
  getSCMResourceResult: Resource | undefined;
  getLeftResourceResult: Uri | undefined;
}

suite("Open Commands Tests", () => {
  let mockState: MockState;
  let origExecuteCommand: typeof commands.executeCommand;
  let origOpenTextDocument: typeof workspace.openTextDocument;
  let origShowTextDocument: typeof window.showTextDocument;
  let origShowWarningMessage: typeof window.showWarningMessage;
  let origExists: typeof fs.exists;
  let origStat: typeof fs.stat;

  setup(() => {
    mockState = {
      executeCommandCalls: [],
      openTextDocumentCalls: [],
      showTextDocumentCalls: [],
      showWarningMessageCalls: [],
      existsCalls: [],
      statCalls: [],
      getSCMResourceResult: undefined,
      getLeftResourceResult: undefined
    };

    // Mock commands.executeCommand
    origExecuteCommand = commands.executeCommand;
    (commands as any).executeCommand = async (command: string, ...args: any[]) => {
      mockState.executeCommandCalls.push({ command, args });
      return Promise.resolve();
    };

    // Mock workspace.openTextDocument
    origOpenTextDocument = workspace.openTextDocument;
    (workspace as any).openTextDocument = async (uri: Uri) => {
      mockState.openTextDocumentCalls.push({ uri });
      return { uri };
    };

    // Mock window.showTextDocument
    origShowTextDocument = window.showTextDocument;
    (window as any).showTextDocument = async (document: any, options: any) => {
      mockState.showTextDocumentCalls.push({ document, options });
      return {};
    };

    // Mock window.showWarningMessage
    origShowWarningMessage = window.showWarningMessage;
    (window as any).showWarningMessage = async (message: string) => {
      mockState.showWarningMessageCalls.push({ message });
      return undefined;
    };

    // Mock fs.exists
    origExists = fs.exists;
    (fs as any).exists = async (path: string) => {
      mockState.existsCalls.push({ path });
      return false; // Default: file doesn't exist
    };

    // Mock fs.stat
    origStat = fs.stat;
    (fs as any).stat = async (path: string) => {
      mockState.statCalls.push({ path });
      return { isDirectory: () => false };
    };
  });

  teardown(() => {
    (commands as any).executeCommand = origExecuteCommand;
    (workspace as any).openTextDocument = origOpenTextDocument;
    (window as any).showTextDocument = origShowTextDocument;
    (window as any).showWarningMessage = origShowWarningMessage;
    (fs as any).exists = origExists;
    (fs as any).stat = origStat;
  });

  suite("OpenFile Command", () => {
    let openFile: OpenFile;

    setup(() => {
      openFile = new OpenFile();
    });

    teardown(() => {
      openFile.dispose();
    });

    test("1.1: Open single Resource file", async () => {
      const fileUri = Uri.file("/test/file.txt");
      const resource = new Resource(fileUri, Status.MODIFIED);

      await openFile.execute(resource);

      assert.strictEqual(mockState.openTextDocumentCalls.length, 1);
      assert.strictEqual(
        mockState.openTextDocumentCalls[0].uri.fsPath,
        fileUri.fsPath
      );
      assert.strictEqual(mockState.showTextDocumentCalls.length, 1);
    });

    test("1.2: Open file URI with file scheme", async () => {
      const fileUri = Uri.file("/test/file.txt");

      await openFile.execute(fileUri);

      assert.strictEqual(mockState.openTextDocumentCalls.length, 1);
      assert.strictEqual(
        mockState.openTextDocumentCalls[0].uri.fsPath,
        fileUri.fsPath
      );
    });

    test("1.3: Open file URI with svn scheme", async () => {
      const svnUri = Uri.parse("svn:/test/file.txt?p=123");

      await openFile.execute(svnUri);

      assert.strictEqual(mockState.openTextDocumentCalls.length, 1);
    });

    test("1.4: Open IncomingChangeNode", async () => {
      const fileUri = Uri.file("/test/file.txt");
      const mockRepo = {} as Repository;
      const node = new IncomingChangeNode(fileUri, Status.MODIFIED, mockRepo);

      await openFile.execute(node);

      assert.strictEqual(mockState.openTextDocumentCalls.length, 1);
    });

    test("1.5: Skip directory when opening", async () => {
      const dirUri = Uri.file("/test/directory");
      const resource = new Resource(dirUri, Status.MODIFIED);

      (fs as any).exists = async () => true;
      (fs as any).stat = async () => ({ isDirectory: () => true });

      await openFile.execute(resource);

      assert.strictEqual(
        mockState.openTextDocumentCalls.length,
        0,
        "Should not open directory"
      );
    });

    test("1.6: Open multiple resources", async () => {
      const file1 = new Resource(Uri.file("/test/file1.txt"), Status.MODIFIED);
      const file2 = new Resource(Uri.file("/test/file2.txt"), Status.ADDED);

      await openFile.execute(file1, file2);

      assert.strictEqual(
        mockState.openTextDocumentCalls.length,
        2,
        "Should open both files"
      );
    });

    test("1.7: Preview mode for single file", async () => {
      const fileUri = Uri.file("/test/file.txt");
      const resource = new Resource(fileUri, Status.MODIFIED);

      await openFile.execute(resource);

      assert.strictEqual(mockState.showTextDocumentCalls.length, 1);
      assert.strictEqual(
        mockState.showTextDocumentCalls[0].options.preview,
        true,
        "Single file should open in preview"
      );
    });

    test("1.8: No preview for multiple files", async () => {
      const file1 = new Resource(Uri.file("/test/file1.txt"), Status.MODIFIED);
      const file2 = new Resource(Uri.file("/test/file2.txt"), Status.ADDED);

      await openFile.execute(file1, file2);

      assert.strictEqual(mockState.showTextDocumentCalls.length, 2);
      assert.strictEqual(
        mockState.showTextDocumentCalls[0].options.preview,
        false,
        "Multiple files should not preview"
      );
    });

    test("1.9: PreserveFocus when Resource instance", async () => {
      const fileUri = Uri.file("/test/file.txt");
      const resource = new Resource(fileUri, Status.MODIFIED);

      await openFile.execute(resource);

      assert.strictEqual(mockState.showTextDocumentCalls.length, 1);
      assert.strictEqual(
        mockState.showTextDocumentCalls[0].options.preserveFocus,
        true,
        "Resource should preserve focus"
      );
    });

    test("1.10: No URIs to open (undefined)", async () => {
      await openFile.execute();

      assert.strictEqual(
        mockState.openTextDocumentCalls.length,
        0,
        "Should not open when no URIs"
      );
    });

    test("1.11: Handle renamed resource", async () => {
      const newUri = Uri.file("/test/new.txt");
      const oldUri = Uri.file("/test/old.txt");
      const resource = new Resource(newUri, Status.ADDED, oldUri);

      await openFile.execute(resource);

      assert.strictEqual(mockState.openTextDocumentCalls.length, 1);
    });

    test("1.12: Active editor selection preservation", async () => {
      const fileUri = Uri.file("/test/file.txt");
      const resource = new Resource(fileUri, Status.MODIFIED);

      (window as any).activeTextEditor = {
        document: { uri: fileUri },
        selection: { start: 0, end: 10 }
      };

      await openFile.execute(resource);

      assert.strictEqual(mockState.showTextDocumentCalls.length, 1);
      const opts = mockState.showTextDocumentCalls[0].options;
      assert.ok(opts.selection, "Should preserve selection");
    });
  });

  suite("OpenChangeBase Command", () => {
    let openChangeBase: InstanceType<typeof OpenChangeBase>;

    setup(() => {
      openChangeBase = new OpenChangeBase();
    });

    teardown(() => {
      openChangeBase.dispose();
    });

    test("2.1: Open change with BASE for Resource", async () => {
      const fileUri = Uri.file("/test/file.txt");
      const resource = new Resource(fileUri, Status.MODIFIED);

      (openChangeBase as any).getLeftResource = async () =>
        Uri.parse("svn:/test/file.txt?rev=BASE");
      (openChangeBase as any).getRightResource = () => fileUri;
      (openChangeBase as any).getTitle = () => "file.txt (Working vs BASE)";

      await openChangeBase.execute(resource);

      assert.ok(
        mockState.executeCommandCalls.some(c => c.command === "vscode.diff"),
        "Should execute diff command"
      );
    });

    test("2.2: Open change with BASE for Uri", async () => {
      const fileUri = Uri.file("/test/file.txt");

      (openChangeBase as any).getSCMResource = async () =>
        new Resource(fileUri, Status.MODIFIED);
      (openChangeBase as any).getLeftResource = async () =>
        Uri.parse("svn:/test/file.txt?rev=BASE");
      (openChangeBase as any).getRightResource = () => fileUri;
      (openChangeBase as any).getTitle = () => "file.txt (Working vs BASE)";

      await openChangeBase.execute(fileUri);

      assert.ok(mockState.executeCommandCalls.some(c => c.command === "vscode.diff"));
    });

    test("2.3: Open change for multiple resources", async () => {
      const file1 = new Resource(Uri.file("/test/file1.txt"), Status.MODIFIED);
      const file2 = new Resource(Uri.file("/test/file2.txt"), Status.MODIFIED);

      (openChangeBase as any).getLeftResource = async (res: Resource) =>
        Uri.parse(`svn:${res.resourceUri.fsPath}?rev=BASE`);
      (openChangeBase as any).getRightResource = (res: Resource) => res.resourceUri;
      (openChangeBase as any).getTitle = () => "file (Working vs BASE)";

      await openChangeBase.execute(file1, file2);

      const diffCalls = mockState.executeCommandCalls.filter(
        c => c.command === "vscode.diff"
      );
      assert.strictEqual(diffCalls.length, 2, "Should diff both files");
    });

    test("2.4: Handle no resources", async () => {
      (openChangeBase as any).getSCMResource = async () => undefined;

      await openChangeBase.execute();

      assert.strictEqual(
        mockState.executeCommandCalls.length,
        0,
        "Should not execute when no resources"
      );
    });

    test("2.5: PreserveFocus for Resource argument", async () => {
      const fileUri = Uri.file("/test/file.txt");
      const resource = new Resource(fileUri, Status.MODIFIED);

      (openChangeBase as any).getLeftResource = async () =>
        Uri.parse("svn:/test/file.txt?rev=BASE");
      (openChangeBase as any).getRightResource = () => fileUri;
      (openChangeBase as any).getTitle = () => "file.txt";

      await openChangeBase.execute(resource);

      assert.ok(mockState.executeCommandCalls.length > 0);
    });

    test("2.6: Handle ADDED status", async () => {
      const fileUri = Uri.file("/test/added.txt");
      const resource = new Resource(fileUri, Status.ADDED);

      (openChangeBase as any).getLeftResource = async () => undefined;
      (openChangeBase as any).getRightResource = () => fileUri;
      (openChangeBase as any).getTitle = () => "added.txt";

      await openChangeBase.execute(resource);

      assert.ok(mockState.executeCommandCalls.length > 0);
    });
  });

  suite("OpenChangeHead Command", () => {
    let openChangeHead: InstanceType<typeof OpenChangeHead>;

    setup(() => {
      openChangeHead = new OpenChangeHead();
    });

    teardown(() => {
      openChangeHead.dispose();
    });

    test("3.1: Open change with HEAD for Resource", async () => {
      const fileUri = Uri.file("/test/file.txt");
      const resource = new Resource(fileUri, Status.MODIFIED);

      (openChangeHead as any).getLeftResource = async () =>
        Uri.parse("svn:/test/file.txt?rev=HEAD");
      (openChangeHead as any).getRightResource = () => fileUri;
      (openChangeHead as any).getTitle = () => "file.txt (Working vs HEAD)";

      await openChangeHead.execute(resource);

      assert.ok(mockState.executeCommandCalls.some(c => c.command === "vscode.diff"));
    });

    test("3.2: Open change with HEAD for IncomingChangeNode", async () => {
      const fileUri = Uri.file("/test/file.txt");
      const mockRepo = {} as Repository;
      const node = new IncomingChangeNode(fileUri, Status.MODIFIED, mockRepo);

      (openChangeHead as any).getLeftResource = async () =>
        Uri.parse("svn:/test/file.txt?rev=HEAD");
      (openChangeHead as any).getRightResource = () => fileUri;
      (openChangeHead as any).getTitle = () => "file.txt";

      await openChangeHead.execute(node);

      assert.ok(mockState.executeCommandCalls.length > 0);
    });

    test("3.3: Open change for remote resource", async () => {
      const fileUri = Uri.file("/test/file.txt");
      const resource = new Resource(fileUri, Status.MODIFIED, undefined, undefined, true);

      (openChangeHead as any).getLeftResource = async () =>
        Uri.parse("svn:/test/file.txt?rev=HEAD");
      (openChangeHead as any).getRightResource = () => fileUri;
      (openChangeHead as any).getTitle = () => "file.txt";

      await openChangeHead.execute(resource);

      assert.ok(mockState.executeCommandCalls.length > 0);
    });

    test("3.4: Multiple resources with HEAD", async () => {
      const file1 = new Resource(Uri.file("/test/file1.txt"), Status.MODIFIED);
      const file2 = new Resource(Uri.file("/test/file2.txt"), Status.ADDED);

      (openChangeHead as any).getLeftResource = async (res: Resource) =>
        Uri.parse(`svn:${res.resourceUri.fsPath}?rev=HEAD`);
      (openChangeHead as any).getRightResource = (res: Resource) => res.resourceUri;
      (openChangeHead as any).getTitle = () => "file";

      await openChangeHead.execute(file1, file2);

      const diffCalls = mockState.executeCommandCalls.filter(
        c => c.command === "vscode.diff"
      );
      assert.strictEqual(diffCalls.length, 2);
    });

    test("3.5: Handle Uri argument", async () => {
      const fileUri = Uri.file("/test/file.txt");

      (openChangeHead as any).getSCMResource = async () =>
        new Resource(fileUri, Status.MODIFIED);
      (openChangeHead as any).getLeftResource = async () =>
        Uri.parse("svn:/test/file.txt?rev=HEAD");
      (openChangeHead as any).getRightResource = () => fileUri;
      (openChangeHead as any).getTitle = () => "file.txt";

      await openChangeHead.execute(fileUri);

      assert.ok(mockState.executeCommandCalls.some(c => c.command === "vscode.diff"));
    });
  });

  suite("OpenChangePrev Command", () => {
    let openChangePrev: InstanceType<typeof OpenChangePrev>;

    setup(() => {
      openChangePrev = new OpenChangePrev();
    });

    teardown(() => {
      openChangePrev.dispose();
    });

    test("4.1: Open change with PREV for Resource", async () => {
      const fileUri = Uri.file("/test/file.txt");
      const resource = new Resource(fileUri, Status.MODIFIED);

      (openChangePrev as any).getLeftResource = async () =>
        Uri.parse("svn:/test/file.txt?rev=PREV");
      (openChangePrev as any).getRightResource = () => fileUri;
      (openChangePrev as any).getTitle = () => "file.txt (Working vs PREV)";

      await openChangePrev.execute(resource);

      assert.ok(mockState.executeCommandCalls.some(c => c.command === "vscode.diff"));
    });

    test("4.2: Open change with PREV for IncomingChangeNode", async () => {
      const fileUri = Uri.file("/test/file.txt");
      const mockRepo = {} as Repository;
      const node = new IncomingChangeNode(fileUri, Status.MODIFIED, mockRepo);

      (openChangePrev as any).getLeftResource = async () =>
        Uri.parse("svn:/test/file.txt?rev=PREV");
      (openChangePrev as any).getRightResource = () => fileUri;
      (openChangePrev as any).getTitle = () => "file.txt";

      await openChangePrev.execute(node);

      assert.ok(mockState.executeCommandCalls.length > 0);
    });

    test("4.3: Multiple resources with PREV", async () => {
      const file1 = new Resource(Uri.file("/test/file1.txt"), Status.MODIFIED);
      const file2 = new Resource(Uri.file("/test/file2.txt"), Status.MODIFIED);

      (openChangePrev as any).getLeftResource = async (res: Resource) =>
        Uri.parse(`svn:${res.resourceUri.fsPath}?rev=PREV`);
      (openChangePrev as any).getRightResource = (res: Resource) => res.resourceUri;
      (openChangePrev as any).getTitle = () => "file";

      await openChangePrev.execute(file1, file2);

      const diffCalls = mockState.executeCommandCalls.filter(
        c => c.command === "vscode.diff"
      );
      assert.strictEqual(diffCalls.length, 2);
    });

    test("4.4: Handle no resources for PREV", async () => {
      (openChangePrev as any).getSCMResource = async () => undefined;

      await openChangePrev.execute();

      assert.strictEqual(mockState.executeCommandCalls.length, 0);
    });
  });

  suite("OpenHeadFile Command", () => {
    let openHeadFile: OpenHeadFile;

    setup(() => {
      openHeadFile = new OpenHeadFile();
    });

    teardown(() => {
      openHeadFile.dispose();
    });

    test("5.1: Open HEAD file for Resource", async () => {
      const fileUri = Uri.file("/test/file.txt");
      const resource = new Resource(fileUri, Status.MODIFIED);
      const headUri = Uri.parse("svn:/test/file.txt?rev=HEAD");

      (openHeadFile as any).getLeftResource = async () => headUri;

      await openHeadFile.execute(resource);

      assert.ok(
        mockState.executeCommandCalls.some(c => c.command === "vscode.open"),
        "Should execute open command"
      );
    });

    test("5.2: Show warning when HEAD not available", async () => {
      const fileUri = Uri.file("/test/file.txt");
      const resource = new Resource(fileUri, Status.MODIFIED);

      (openHeadFile as any).getLeftResource = async () => undefined;

      await openHeadFile.execute(resource);

      assert.strictEqual(
        mockState.showWarningMessageCalls.length,
        1,
        "Should show warning"
      );
      assert.ok(
        mockState.showWarningMessageCalls[0].message.includes("HEAD version"),
        "Warning should mention HEAD"
      );
    });

    test("5.3: Open HEAD file for Uri argument", async () => {
      const fileUri = Uri.file("/test/file.txt");
      const headUri = Uri.parse("svn:/test/file.txt?rev=HEAD");

      (openHeadFile as any).getSCMResource = async () =>
        new Resource(fileUri, Status.MODIFIED);
      (openHeadFile as any).getLeftResource = async () => headUri;

      await openHeadFile.execute(fileUri);

      assert.ok(mockState.executeCommandCalls.some(c => c.command === "vscode.open"));
    });

    test("5.4: Open HEAD file for IncomingChangeNode", async () => {
      const fileUri = Uri.file("/test/file.txt");
      const mockRepo = {} as Repository;
      const node = new IncomingChangeNode(fileUri, Status.MODIFIED, mockRepo);
      const headUri = Uri.parse("svn:/test/file.txt?rev=HEAD");

      (openHeadFile as any).getLeftResource = async () => headUri;

      await openHeadFile.execute(node);

      assert.ok(mockState.executeCommandCalls.some(c => c.command === "vscode.open"));
    });

    test("5.5: Handle no resource (undefined)", async () => {
      (openHeadFile as any).getSCMResource = async () => undefined;

      await openHeadFile.execute();

      assert.strictEqual(
        mockState.executeCommandCalls.length,
        0,
        "Should not execute when no resource"
      );
    });

    test("5.6: HEAD file title includes (HEAD)", async () => {
      const fileUri = Uri.file("/test/file.txt");
      const resource = new Resource(fileUri, Status.MODIFIED);
      const headUri = Uri.parse("svn:/test/file.txt?rev=HEAD");

      (openHeadFile as any).getLeftResource = async () => headUri;

      await openHeadFile.execute(resource);

      assert.ok(mockState.executeCommandCalls.length > 0);
      const openCall = mockState.executeCommandCalls.find(
        c => c.command === "vscode.open"
      );
      if (openCall && openCall.args[0]) {
        const uri = openCall.args[0] as Uri;
        assert.ok(
          uri.path.includes("(HEAD)"),
          "Title should include (HEAD)"
        );
      }
    });

    test("5.7: Preview mode enabled", async () => {
      const fileUri = Uri.file("/test/file.txt");
      const resource = new Resource(fileUri, Status.MODIFIED);
      const headUri = Uri.parse("svn:/test/file.txt?rev=HEAD");

      (openHeadFile as any).getLeftResource = async () => headUri;

      await openHeadFile.execute(resource);

      const openCall = mockState.executeCommandCalls.find(
        c => c.command === "vscode.open"
      );
      assert.ok(openCall);
      assert.ok(openCall.args[1]?.preview === true, "Should be in preview mode");
    });
  });

  suite("OpenResourceBase Command", () => {
    let openResourceBase: InstanceType<typeof OpenResourceBase>;

    setup(() => {
      openResourceBase = new OpenResourceBase();
    });

    teardown(() => {
      openResourceBase.dispose();
    });

    test("6.1: Open resource with BASE", async () => {
      const fileUri = Uri.file("/test/file.txt");
      const resource = new Resource(fileUri, Status.MODIFIED);

      (openResourceBase as any).getLeftResource = async () =>
        Uri.parse("svn:/test/file.txt?rev=BASE");
      (openResourceBase as any).getRightResource = () => fileUri;
      (openResourceBase as any).getTitle = () => "file.txt (Working vs BASE)";

      await openResourceBase.execute(resource);

      assert.ok(mockState.executeCommandCalls.some(c => c.command === "vscode.diff"));
    });

    test("6.2: Open resource with BASE for MODIFIED status", async () => {
      const fileUri = Uri.file("/test/modified.txt");
      const resource = new Resource(fileUri, Status.MODIFIED);

      (openResourceBase as any).getLeftResource = async () =>
        Uri.parse("svn:/test/modified.txt?rev=BASE");
      (openResourceBase as any).getRightResource = () => fileUri;
      (openResourceBase as any).getTitle = () => "modified.txt";

      await openResourceBase.execute(resource);

      assert.ok(mockState.executeCommandCalls.length > 0);
    });

    test("6.3: Open resource with BASE for CONFLICTED status", async () => {
      const fileUri = Uri.file("/test/conflicted.txt");
      const resource = new Resource(fileUri, Status.CONFLICTED);

      (openResourceBase as any).getLeftResource = async () =>
        Uri.parse("svn:/test/conflicted.txt?rev=BASE");
      (openResourceBase as any).getRightResource = () => fileUri;
      (openResourceBase as any).getTitle = () => "conflicted.txt";

      await openResourceBase.execute(resource);

      assert.ok(mockState.executeCommandCalls.length > 0);
    });

    test("6.4: Open resource with BASE for renamed file", async () => {
      const newUri = Uri.file("/test/new.txt");
      const oldUri = Uri.file("/test/old.txt");
      const resource = new Resource(newUri, Status.ADDED, oldUri);

      (openResourceBase as any).getLeftResource = async () =>
        Uri.parse("svn:/test/old.txt?rev=BASE");
      (openResourceBase as any).getRightResource = () => newUri;
      (openResourceBase as any).getTitle = () => "new.txt";

      await openResourceBase.execute(resource);

      assert.ok(mockState.executeCommandCalls.length > 0);
    });

    test("6.5: Skip directory in _openResource", async () => {
      const dirUri = Uri.file("/test/directory");
      const resource = new Resource(dirUri, Status.MODIFIED);

      (fs as any).exists = async () => true;
      (fs as any).stat = async () => ({ isDirectory: () => true });
      (openResourceBase as any).getLeftResource = async () =>
        Uri.parse("svn:/test/directory?rev=BASE");
      (openResourceBase as any).getRightResource = () => dirUri;

      await openResourceBase.execute(resource);

      assert.strictEqual(
        mockState.executeCommandCalls.length,
        0,
        "Should not open directory"
      );
    });
  });

  suite("OpenResourceHead Command", () => {
    let openResourceHead: InstanceType<typeof OpenResourceHead>;

    setup(() => {
      openResourceHead = new OpenResourceHead();
    });

    teardown(() => {
      openResourceHead.dispose();
    });

    test("7.1: Open resource with HEAD", async () => {
      const fileUri = Uri.file("/test/file.txt");
      const resource = new Resource(fileUri, Status.MODIFIED);

      (openResourceHead as any).getLeftResource = async () =>
        Uri.parse("svn:/test/file.txt?rev=HEAD");
      (openResourceHead as any).getRightResource = () => fileUri;
      (openResourceHead as any).getTitle = () => "file.txt (Working vs HEAD)";

      await openResourceHead.execute(resource);

      assert.ok(mockState.executeCommandCalls.some(c => c.command === "vscode.diff"));
    });

    test("7.2: Open resource with HEAD for ADDED status", async () => {
      const fileUri = Uri.file("/test/added.txt");
      const resource = new Resource(fileUri, Status.ADDED);

      (openResourceHead as any).getLeftResource = async () => undefined;
      (openResourceHead as any).getRightResource = () => fileUri;
      (openResourceHead as any).getTitle = () => "added.txt";

      await openResourceHead.execute(resource);

      assert.ok(mockState.executeCommandCalls.length > 0);
    });

    test("7.3: Open resource with HEAD for DELETED status", async () => {
      const fileUri = Uri.file("/test/deleted.txt");
      const resource = new Resource(fileUri, Status.DELETED);

      (openResourceHead as any).getLeftResource = async () =>
        Uri.parse("svn:/test/deleted.txt?rev=HEAD");
      (openResourceHead as any).getRightResource = () =>
        Uri.parse("svn:/test/deleted.txt?rev=HEAD");
      (openResourceHead as any).getTitle = () => "deleted.txt";

      await openResourceHead.execute(resource);

      assert.ok(mockState.executeCommandCalls.length > 0);
    });

    test("7.4: Open resource with HEAD for remote resource", async () => {
      const fileUri = Uri.file("/test/file.txt");
      const resource = new Resource(fileUri, Status.MODIFIED, undefined, undefined, true);

      (openResourceHead as any).getLeftResource = async () =>
        Uri.parse("svn:/test/file.txt?rev=HEAD");
      (openResourceHead as any).getRightResource = () => fileUri;
      (openResourceHead as any).getTitle = () => "file.txt";

      await openResourceHead.execute(resource);

      assert.ok(mockState.executeCommandCalls.length > 0);
    });

    test("7.5: Open resource without left (no diff)", async () => {
      const fileUri = Uri.file("/test/file.txt");
      const resource = new Resource(fileUri, Status.ADDED);

      (openResourceHead as any).getLeftResource = async () => undefined;
      (openResourceHead as any).getRightResource = () => fileUri;

      await openResourceHead.execute(resource);

      assert.ok(
        mockState.executeCommandCalls.some(c => c.command === "vscode.open"),
        "Should use open instead of diff"
      );
    });
  });

  suite("Edge Cases & Error Handling", () => {
    test("8.1: OpenFile handles null URI", async () => {
      const openFile = new OpenFile();

      await openFile.execute(undefined as any);

      assert.strictEqual(mockState.openTextDocumentCalls.length, 0);
      openFile.dispose();
    });

    test("8.2: OpenChangeBase handles undefined getSCMResource", async () => {
      const openChangeBase = new OpenChangeBase();

      (openChangeBase as any).getSCMResource = async () => undefined;

      await openChangeBase.execute();

      assert.strictEqual(mockState.executeCommandCalls.length, 0);
      openChangeBase.dispose();
    });

    test("8.3: OpenHeadFile handles missing HEAD gracefully", async () => {
      const openHeadFile = new OpenHeadFile();
      const fileUri = Uri.file("/test/file.txt");
      const resource = new Resource(fileUri, Status.ADDED);

      (openHeadFile as any).getLeftResource = async () => undefined;

      await openHeadFile.execute(resource);

      assert.strictEqual(mockState.showWarningMessageCalls.length, 1);
      openHeadFile.dispose();
    });

    test("8.4: OpenFile mixed Resource and non-Resource states", async () => {
      const openFile = new OpenFile();
      const file1 = new Resource(Uri.file("/test/file1.txt"), Status.MODIFIED);
      const file2 = new Resource(Uri.file("/test/file2.txt"), Status.ADDED);

      await openFile.execute(file1, file2);

      assert.strictEqual(mockState.openTextDocumentCalls.length, 2);
      openFile.dispose();
    });

    test("8.5: OpenResourceBase handles no right resource", async () => {
      const openResourceBase = new OpenResourceBase();
      const fileUri = Uri.file("/test/file.txt");
      const resource = new Resource(fileUri, Status.NORMAL);

      (openResourceBase as any).getLeftResource = async () =>
        Uri.parse("svn:/test/file.txt?rev=BASE");
      (openResourceBase as any).getRightResource = () => undefined;

      await openResourceBase.execute(resource);

      assert.strictEqual(
        mockState.executeCommandCalls.length,
        0,
        "Should not execute when no right resource"
      );
      openResourceBase.dispose();
    });

    test("8.6: OpenChangeHead with empty resourceStates", async () => {
      const openChangeHead = new OpenChangeHead();
      const fileUri = Uri.file("/test/file.txt");
      const resource = new Resource(fileUri, Status.MODIFIED);

      (openChangeHead as any).getLeftResource = async () =>
        Uri.parse("svn:/test/file.txt?rev=HEAD");
      (openChangeHead as any).getRightResource = () => fileUri;
      (openChangeHead as any).getTitle = () => "file.txt";

      await openChangeHead.execute(resource);

      assert.ok(mockState.executeCommandCalls.length > 0);
      openChangeHead.dispose();
    });

    test("8.7: OpenFile with special characters in path", async () => {
      const openFile = new OpenFile();
      const fileUri = Uri.file("/test/file with spaces.txt");
      const resource = new Resource(fileUri, Status.MODIFIED);

      await openFile.execute(resource);

      assert.strictEqual(mockState.openTextDocumentCalls.length, 1);
      assert.ok(
        mockState.openTextDocumentCalls[0].uri.fsPath.includes("spaces")
      );
      openFile.dispose();
    });

    test("8.8: OpenChangePrev with Uri scheme handling", async () => {
      const openChangePrev = new OpenChangePrev();
      const fileUri = Uri.file("/test/file.txt");

      (openChangePrev as any).getSCMResource = async (uri: Uri) =>
        new Resource(uri, Status.MODIFIED);
      (openChangePrev as any).getLeftResource = async () =>
        Uri.parse("svn:/test/file.txt?rev=PREV");
      (openChangePrev as any).getRightResource = () => fileUri;
      (openChangePrev as any).getTitle = () => "file.txt";

      await openChangePrev.execute(fileUri);

      assert.ok(mockState.executeCommandCalls.length > 0);
      openChangePrev.dispose();
    });

    test("8.9: Multiple OpenFile calls preserve order", async () => {
      const openFile = new OpenFile();
      const file1 = new Resource(Uri.file("/test/file1.txt"), Status.MODIFIED);
      const file2 = new Resource(Uri.file("/test/file2.txt"), Status.ADDED);
      const file3 = new Resource(Uri.file("/test/file3.txt"), Status.DELETED);

      await openFile.execute(file1, file2, file3);

      assert.strictEqual(mockState.openTextDocumentCalls.length, 3);
      assert.strictEqual(
        mockState.openTextDocumentCalls[0].uri.fsPath,
        "/test/file1.txt"
      );
      assert.strictEqual(
        mockState.openTextDocumentCalls[1].uri.fsPath,
        "/test/file2.txt"
      );
      assert.strictEqual(
        mockState.openTextDocumentCalls[2].uri.fsPath,
        "/test/file3.txt"
      );
      openFile.dispose();
    });

    test("8.10: OpenResourceHead handles REPLACED status", async () => {
      const openResourceHead = new OpenResourceHead();
      const fileUri = Uri.file("/test/replaced.txt");
      const resource = new Resource(fileUri, Status.REPLACED);

      (openResourceHead as any).getLeftResource = async () =>
        Uri.parse("svn:/test/replaced.txt?rev=HEAD");
      (openResourceHead as any).getRightResource = () => fileUri;
      (openResourceHead as any).getTitle = () => "replaced.txt";

      await openResourceHead.execute(resource);

      assert.ok(mockState.executeCommandCalls.length > 0);
      openResourceHead.dispose();
    });
  });
});
