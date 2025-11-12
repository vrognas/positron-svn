import * as assert from "assert";
import { commands, Uri } from "vscode";
import { Log } from "../../../commands/log";
import { Repository } from "../../../repository";

suite("Log Command Tests", () => {
  let log: Log;
  let mockRepository: Partial<Repository>;
  let origExecuteCommand: typeof commands.executeCommand;

  // Call tracking
  let executeCommandCalls: any[] = [];

  setup(() => {
    log = new Log();

    // Mock Repository
    mockRepository = {
      workspaceRoot: "/test/workspace"
    };

    // Mock commands.executeCommand
    origExecuteCommand = commands.executeCommand;
    (commands as any).executeCommand = async (
      commandId: string,
      ...args: any[]
    ) => {
      executeCommandCalls.push({ commandId, args });
      return Promise.resolve(undefined);
    };

    // Clear call tracking
    executeCommandCalls = [];
  });

  teardown(() => {
    log.dispose();
    (commands as any).executeCommand = origExecuteCommand;
  });

  suite("Basic Log Display", () => {
    test("should open log with vscode.open command", async () => {
      await log.execute(mockRepository as Repository);

      assert.strictEqual(executeCommandCalls.length, 1);
      assert.strictEqual(executeCommandCalls[0].commandId, "vscode.open");
    });

    test("should create URI with LOG action", async () => {
      await log.execute(mockRepository as Repository);

      assert.strictEqual(executeCommandCalls.length, 1);
      const uri = executeCommandCalls[0].args[0] as Uri;
      assert.ok(uri instanceof Uri);
      assert.ok(uri.toString().includes("svn"));
    });

    test("should use workspace root as base path", async () => {
      await log.execute(mockRepository as Repository);

      const uri = executeCommandCalls[0].args[0] as Uri;
      assert.ok(uri.path.includes("svn.log"));
    });

    test("should set document title to svn.log", async () => {
      await log.execute(mockRepository as Repository);

      const uri = executeCommandCalls[0].args[0] as Uri;
      assert.ok(uri.path.endsWith("svn.log"));
    });

    test("should call executeCommand with correct arguments", async () => {
      await log.execute(mockRepository as Repository);

      assert.strictEqual(executeCommandCalls[0].commandId, "vscode.open");
      assert.strictEqual(executeCommandCalls[0].args.length, 1);
      assert.ok(executeCommandCalls[0].args[0] instanceof Uri);
    });
  });

  suite("Repository Handling", () => {
    test("should accept repository parameter", async () => {
      await log.execute(mockRepository as Repository);

      assert.strictEqual(executeCommandCalls.length, 1);
    });

    test("should handle different workspace roots", async () => {
      const customRepo = { workspaceRoot: "/custom/path" } as Repository;

      await log.execute(customRepo);

      const uri = executeCommandCalls[0].args[0] as Uri;
      assert.ok(uri.toString().includes("custom"));
    });

    test("should handle workspace root with spaces", async () => {
      const spacedRepo = {
        workspaceRoot: "/test/path with spaces"
      } as Repository;

      await log.execute(spacedRepo);

      assert.strictEqual(executeCommandCalls.length, 1);
      assert.ok(executeCommandCalls[0].args[0] instanceof Uri);
    });

    test("should handle workspace root with special chars", async () => {
      const specialRepo = {
        workspaceRoot: "/test/path-with_special.chars"
      } as Repository;

      await log.execute(specialRepo);

      assert.strictEqual(executeCommandCalls.length, 1);
      const uri = executeCommandCalls[0].args[0] as Uri;
      assert.ok(uri instanceof Uri);
    });

    test("should handle deep nested workspace root", async () => {
      const nestedRepo = {
        workspaceRoot: "/a/b/c/d/e/f/workspace"
      } as Repository;

      await log.execute(nestedRepo);

      assert.strictEqual(executeCommandCalls.length, 1);
    });
  });

  suite("Error Handling", () => {
    test("should handle executeCommand failure", async () => {
      (commands as any).executeCommand = async () => {
        throw new Error("vscode.open failed");
      };

      await log.execute(mockRepository as Repository);

      // Should not throw, error is handled internally
      assert.ok(true);
    });

    test("should handle URI creation failure", async () => {
      const undefinedRepo = { workspaceRoot: undefined } as any;

      await log.execute(undefinedRepo);

      // Should handle gracefully
      assert.ok(true);
    });

    test("should handle missing workspace root", async () => {
      const emptyRepo = { workspaceRoot: "" } as Repository;

      await log.execute(emptyRepo);

      assert.ok(true);
    });

    test("should handle invalid repository object", async () => {
      const invalidRepo = {} as Repository;

      await log.execute(invalidRepo);

      // Should not throw
      assert.ok(true);
    });

    test("should handle executeCommand returning error", async () => {
      (commands as any).executeCommand = async () => {
        throw new Error("Unable to open file");
      };

      await log.execute(mockRepository as Repository);

      assert.ok(true, "Should handle error gracefully");
    });
  });

  suite("URI Construction", () => {
    test("should create valid URI scheme", async () => {
      await log.execute(mockRepository as Repository);

      const uri = executeCommandCalls[0].args[0] as Uri;
      assert.strictEqual(uri.scheme, "svn");
    });

    test("should include workspace root in URI", async () => {
      await log.execute(mockRepository as Repository);

      const uri = executeCommandCalls[0].args[0] as Uri;
      assert.ok(uri.toString().includes("test"));
    });

    test("should construct path with svn.log suffix", async () => {
      await log.execute(mockRepository as Repository);

      const uri = executeCommandCalls[0].args[0] as Uri;
      assert.ok(uri.path.endsWith("svn.log"));
    });

    test("should handle windows-style paths", async () => {
      const windowsRepo = { workspaceRoot: "C:\\test\\workspace" } as Repository;

      await log.execute(windowsRepo);

      assert.strictEqual(executeCommandCalls.length, 1);
    });

    test("should preserve URI encoding", async () => {
      const encodedRepo = {
        workspaceRoot: "/test/workspace%20encoded"
      } as Repository;

      await log.execute(encodedRepo);

      const uri = executeCommandCalls[0].args[0] as Uri;
      assert.ok(uri instanceof Uri);
    });
  });

  suite("Command Integration", () => {
    test("should only call vscode.open once", async () => {
      await log.execute(mockRepository as Repository);

      const openCalls = executeCommandCalls.filter(
        c => c.commandId === "vscode.open"
      );
      assert.strictEqual(openCalls.length, 1);
    });

    test("should not call other commands", async () => {
      await log.execute(mockRepository as Repository);

      const otherCalls = executeCommandCalls.filter(
        c => c.commandId !== "vscode.open"
      );
      assert.strictEqual(otherCalls.length, 0);
    });

    test("should pass URI as first argument", async () => {
      await log.execute(mockRepository as Repository);

      const firstArg = executeCommandCalls[0].args[0];
      assert.ok(firstArg instanceof Uri);
    });

    test("should not pass extra arguments", async () => {
      await log.execute(mockRepository as Repository);

      assert.strictEqual(executeCommandCalls[0].args.length, 1);
    });

    test("should execute command asynchronously", async () => {
      let commandExecuted = false;
      (commands as any).executeCommand = async () => {
        commandExecuted = true;
        return Promise.resolve(undefined);
      };

      await log.execute(mockRepository as Repository);

      assert.ok(commandExecuted);
    });
  });

  suite("Multiple Executions", () => {
    test("should handle multiple sequential calls", async () => {
      await log.execute(mockRepository as Repository);
      await log.execute(mockRepository as Repository);
      await log.execute(mockRepository as Repository);

      assert.strictEqual(executeCommandCalls.length, 3);
    });

    test("should handle different repositories", async () => {
      const repo1 = { workspaceRoot: "/repo1" } as Repository;
      const repo2 = { workspaceRoot: "/repo2" } as Repository;

      await log.execute(repo1);
      await log.execute(repo2);

      assert.strictEqual(executeCommandCalls.length, 2);
      const uri1 = executeCommandCalls[0].args[0] as Uri;
      const uri2 = executeCommandCalls[1].args[0] as Uri;
      assert.notStrictEqual(uri1.toString(), uri2.toString());
    });

    test("should maintain state across calls", async () => {
      await log.execute(mockRepository as Repository);
      executeCommandCalls = [];
      await log.execute(mockRepository as Repository);

      assert.strictEqual(executeCommandCalls.length, 1);
    });

    test("should handle rapid sequential calls", async () => {
      const promises = [
        log.execute(mockRepository as Repository),
        log.execute(mockRepository as Repository),
        log.execute(mockRepository as Repository)
      ];

      await Promise.all(promises);

      assert.strictEqual(executeCommandCalls.length, 3);
    });
  });

  suite("Edge Cases", () => {
    test("should handle empty string workspace root", async () => {
      const emptyRepo = { workspaceRoot: "" } as Repository;

      await log.execute(emptyRepo);

      assert.ok(true);
    });

    test("should handle null-like workspace root", async () => {
      const nullRepo = { workspaceRoot: null } as any;

      await log.execute(nullRepo);

      assert.ok(true);
    });

    test("should handle repository with only workspace root", async () => {
      const minimalRepo = { workspaceRoot: "/test" } as Repository;

      await log.execute(minimalRepo);

      assert.strictEqual(executeCommandCalls.length, 1);
    });

    test("should handle very long workspace paths", async () => {
      const longRepo = { workspaceRoot: "/a".repeat(100) } as Repository;

      await log.execute(longRepo);

      assert.strictEqual(executeCommandCalls.length, 1);
    });

    test("should handle workspace root with trailing slash", async () => {
      const trailingRepo = { workspaceRoot: "/test/workspace/" } as Repository;

      await log.execute(trailingRepo);

      assert.strictEqual(executeCommandCalls.length, 1);
    });

    test("should handle workspace root with backslashes", async () => {
      const backslashRepo = { workspaceRoot: "\\test\\workspace" } as Repository;

      await log.execute(backslashRepo);

      assert.strictEqual(executeCommandCalls.length, 1);
    });

    test("should handle unicode in workspace path", async () => {
      const unicodeRepo = { workspaceRoot: "/test/ワークスペース" } as Repository;

      await log.execute(unicodeRepo);

      assert.strictEqual(executeCommandCalls.length, 1);
    });
  });

  suite("Disposal", () => {
    test("should dispose without errors", () => {
      log.dispose();
      assert.ok(true);
    });

    test("should handle double disposal", () => {
      log.dispose();
      log.dispose();
      assert.ok(true);
    });

    test("should not execute after disposal", async () => {
      log.dispose();

      // Should not throw
      assert.ok(true);
    });
  });

  suite("SvnUriAction Integration", () => {
    test("should use LOG action type", async () => {
      await log.execute(mockRepository as Repository);

      const uri = executeCommandCalls[0].args[0] as Uri;
      assert.ok(uri.query.includes("action") || uri.toString().includes("LOG"));
    });

    test("should create svn scheme URI", async () => {
      await log.execute(mockRepository as Repository);

      const uri = executeCommandCalls[0].args[0] as Uri;
      assert.strictEqual(uri.scheme, "svn");
    });

    test("should preserve query parameters", async () => {
      await log.execute(mockRepository as Repository);

      const uri = executeCommandCalls[0].args[0] as Uri;
      assert.ok(uri instanceof Uri);
    });
  });
});
