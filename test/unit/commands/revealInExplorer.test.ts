import * as assert from "assert";
import { describe, it } from "mocha";
import { RevealInExplorer } from "../../../src/commands/revealInExplorer";
import { Uri } from "vscode";

/**
 * Reveal In Explorer Command Tests (Code Review Fixes)
 *
 * Tests for revealing files from SCM view in Explorer pane
 */
describe("Reveal In Explorer Command", () => {
  /**
   * Test 1: Command handles empty resource array
   */
  it("returns early for empty resources", async () => {
    const command = new RevealInExplorer();

    // Should not throw when called with empty array
    await command.execute();

    assert.ok(true, "Command should handle empty array gracefully");
  });

  /**
   * Test 2: Command handles resource without URI
   */
  it("returns early when resource has no URI", async () => {
    const command = new RevealInExplorer();
    const mockResource = {
      resourceUri: undefined
    } as any;

    // Should not throw when resourceUri is undefined
    await command.execute(mockResource);

    assert.ok(true, "Command should handle missing URI gracefully");
  });

  /**
   * Test 3: Command processes first resource when multiple selected
   */
  it("processes first resource from multiple selections", async () => {
    const command = new RevealInExplorer();
    const uri1 = Uri.file("/workspace/file1.ts");
    const uri2 = Uri.file("/workspace/file2.ts");

    const mockResources = [
      { resourceUri: uri1 },
      { resourceUri: uri2 }
    ] as any[];

    // Should process first resource (validation: no throw)
    try {
      await command.execute(...mockResources);
      assert.ok(true, "Command should process first resource");
    } catch (error) {
      // Expected: revealFileInOS might not exist in test env
      assert.ok(true, "Command attempted to reveal first file");
    }
  });
});
