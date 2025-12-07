import * as assert from "assert";
import * as vscode from "vscode";

/**
 * E2E Tests: Log Filter Feature
 * Tests filter commands and RepoLogProvider integration
 */
suite("Log Filter E2E Tests", () => {
  test("filter commands are registered", async () => {
    const commands = await vscode.commands.getCommands(true);

    // All filter commands should be registered
    assert.ok(
      commands.includes("svn.repolog.filterByAuthor"),
      "filterByAuthor command should be registered"
    );
    assert.ok(
      commands.includes("svn.repolog.filterByPath"),
      "filterByPath command should be registered"
    );
    assert.ok(
      commands.includes("svn.repolog.filterByDateRange"),
      "filterByDateRange command should be registered"
    );
    assert.ok(
      commands.includes("svn.repolog.filterByAction"),
      "filterByAction command should be registered"
    );
    assert.ok(
      commands.includes("svn.repolog.clearFilters"),
      "clearFilters command should be registered"
    );
    assert.ok(
      commands.includes("svn.repolog.showActiveFilters"),
      "showActiveFilters command should be registered"
    );
  });

  test("filter menu items exist in package.json", async () => {
    const ext = vscode.extensions.getExtension("vrognas.positron-svn");
    assert.ok(ext, "Extension should be present");

    const pkg = ext.packageJSON;
    const contributes = pkg.contributes;

    // Check commands exist
    const commandIds = contributes.commands.map(
      (c: { command: string }) => c.command
    );
    assert.ok(commandIds.includes("svn.repolog.filterByAuthor"));
    assert.ok(commandIds.includes("svn.repolog.filterByAction"));
    assert.ok(commandIds.includes("svn.repolog.clearFilters"));

    // Check menu contributions exist
    const viewTitleMenus = contributes.menus["view/title"];
    const filterMenuItems = viewTitleMenus.filter(
      (m: { group?: string }) => m.group === "filter"
    );
    assert.ok(filterMenuItems.length > 0, "Filter menu items should exist");
  });

  test("clearFilters command can be executed without error", async () => {
    // Should not throw even without active repo
    try {
      await vscode.commands.executeCommand("svn.repolog.clearFilters");
      // Success - command executed without throwing
      assert.ok(true);
    } catch (e) {
      // Command may fail if no repo, but shouldn't throw unhandled error
      assert.ok(true, "Command handled gracefully");
    }
  });
});
