import * as assert from "assert";
import { Uri } from "vscode";
import { BlameStateManager } from "../../../blame/blameStateManager";

suite("Blame Commands Tests", () => {
  let stateManager: BlameStateManager;
  let testUri: Uri;

  setup(() => {
    stateManager = new BlameStateManager();
    testUri = Uri.file("/test/file.ts");
  });

  teardown(() => {
    stateManager.dispose();
  });

  suite("ToggleBlame Command", () => {
    test("should toggle blame from disabled to enabled", () => {
      const initialState = stateManager.isBlameEnabled(testUri);
      stateManager.toggleBlame(testUri);
      assert.strictEqual(stateManager.isBlameEnabled(testUri), !initialState);
    });

    test("should toggle blame from enabled to disabled", () => {
      stateManager.setBlameEnabled(testUri, true);
      stateManager.toggleBlame(testUri);
      assert.strictEqual(stateManager.isBlameEnabled(testUri), false);
    });

    test("should return new state after toggle", () => {
      const newState = stateManager.toggleBlame(testUri);
      assert.strictEqual(newState, stateManager.isBlameEnabled(testUri));
    });
  });

  suite("ShowBlame Command", () => {
    test("should enable blame for file", () => {
      stateManager.setBlameEnabled(testUri, false);
      stateManager.setBlameEnabled(testUri, true);
      assert.strictEqual(stateManager.isBlameEnabled(testUri), true);
    });

    test("should not change state if already enabled", () => {
      stateManager.setBlameEnabled(testUri, true);
      stateManager.setBlameEnabled(testUri, true);
      assert.strictEqual(stateManager.isBlameEnabled(testUri), true);
    });
  });

  suite("ClearBlame Command", () => {
    test("should disable blame for file", () => {
      stateManager.setBlameEnabled(testUri, true);
      stateManager.clearBlame(testUri);
      assert.strictEqual(stateManager.isBlameEnabled(testUri), false);
    });

    test("should not error if blame already disabled", () => {
      stateManager.clearBlame(testUri);
      assert.strictEqual(stateManager.isBlameEnabled(testUri), false);
    });

    test("should remove file from enabled files list", () => {
      stateManager.setBlameEnabled(testUri, true);
      assert.strictEqual(stateManager.getEnabledFiles().length, 1);

      stateManager.clearBlame(testUri);
      assert.strictEqual(stateManager.getEnabledFiles().length, 0);
    });
  });
});
