import * as assert from "assert";
import { EventEmitter } from "events";
import * as sinon from "sinon";
import { RepositoryFilesWatcher } from "../../../watchers/repositoryFilesWatcher";

suite("RepositoryFilesWatcher Error Handling", () => {
  let sandbox: sinon.SinonSandbox;
  let consoleErrorStub: sinon.SinonStub;

  setup(() => {
    sandbox = sinon.createSandbox();
    consoleErrorStub = sandbox.stub(console, "error");
  });

  teardown(() => {
    sandbox.restore();
  });

  test("fs.watch error does not crash extension", async () => {
    // This test verifies that fs.watch errors are caught and logged
    // instead of crashing the entire extension

    const mockError = new Error("ENOENT: .svn directory deleted");

    // Stub fs.watch to return a mock watcher that emits error
    const mockWatcher = new EventEmitter();
    const watchStub = sandbox.stub(require("fs"), "watch").returns(mockWatcher);

    // Create watcher (should not throw)
    const root = "/test/repo";
    let thrownError: Error | null = null;

    try {
      const watcher = new RepositoryFilesWatcher(root);

      // Emit error event - should NOT crash
      mockWatcher.emit("error", mockError);

      // Give time for async error handling
      await new Promise(resolve => setTimeout(resolve, 10));

      // Watcher should still be functional
      assert.ok(watcher, "Watcher should exist after error");
      watcher.dispose();
    } catch (error) {
      thrownError = error as Error;
    }

    // Verify no error was thrown (extension didn't crash)
    assert.strictEqual(thrownError, null, "Error should not crash extension");

    // Verify error was logged to console
    assert.ok(
      consoleErrorStub.called,
      "Error should be logged to console"
    );

    watchStub.restore();
  });

  test("fs.watch error is logged with context", async () => {
    const mockError = new Error("EACCES: permission denied");
    const mockWatcher = new EventEmitter();
    const watchStub = sandbox.stub(require("fs"), "watch").returns(mockWatcher);

    const root = "/test/repo";
    const watcher = new RepositoryFilesWatcher(root);

    // Emit error
    mockWatcher.emit("error", mockError);
    await new Promise(resolve => setTimeout(resolve, 10));

    // Verify error log includes context
    assert.ok(consoleErrorStub.called, "Error should be logged");
    const loggedMessage = consoleErrorStub.firstCall.args[0];
    assert.ok(
      typeof loggedMessage === "string" &&
      loggedMessage.includes("watch") &&
      loggedMessage.includes("error"),
      "Error message should include 'watch' context"
    );

    watcher.dispose();
    watchStub.restore();
  });

  test("watcher continues functioning after error", async () => {
    const mockError = new Error("Test error");
    const mockWatcher = new EventEmitter();
    const watchStub = sandbox.stub(require("fs"), "watch").returns(mockWatcher);

    const root = "/test/repo";
    const watcher = new RepositoryFilesWatcher(root);

    // Emit error
    mockWatcher.emit("error", mockError);
    await new Promise(resolve => setTimeout(resolve, 10));

    // Watcher should still work - verify it's not disposed
    assert.ok(watcher, "Watcher should remain functional");

    // Dispose should still work
    assert.doesNotThrow(() => {
      watcher.dispose();
    }, "Dispose should work after error");

    watchStub.restore();
  });
});
