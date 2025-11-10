import * as assert from "assert";
import * as fs from "original-fs";
import * as path from "path";
import { Uri } from "vscode";
import { Repository } from "../repository";
import { SourceControlManager } from "../source_control_manager";
import { Status } from "../common/types";
import * as testUtil from "./testUtil";

suite("StatusService Tests", () => {
  let repoUri: Uri;
  let checkoutDir: Uri;
  let sourceControlManager: SourceControlManager;
  let repository: Repository | null;

  suiteSetup(async function () {
    this.timeout(60000);
    await testUtil.activeExtension();

    repoUri = await testUtil.createRepoServer();
    await testUtil.createStandardLayout(testUtil.getSvnUrl(repoUri));
    checkoutDir = await testUtil.createRepoCheckout(
      testUtil.getSvnUrl(repoUri) + "/trunk"
    );

    sourceControlManager = (await require("vscode").commands.executeCommand(
      "svn.getSourceControlManager",
      checkoutDir
    )) as SourceControlManager;

    await sourceControlManager.tryOpenRepository(checkoutDir.fsPath);
    repository = sourceControlManager.getRepository(checkoutDir.fsPath);
  });

  suiteTeardown(() => {
    sourceControlManager?.openRepositories.forEach(repo => repo.dispose());
    testUtil.destroyAllTempPaths();
  });

  test("Empty status - no changes", async function () {
    this.timeout(10000);
    assert.ok(repository, "Repository should exist");

    // Initial status should be empty
    assert.strictEqual(
      repository!.changes.resourceStates.length,
      0,
      "Should have no changes initially"
    );
    assert.strictEqual(
      repository!.unversioned.resourceStates.length,
      0,
      "Should have no unversioned files initially"
    );
    assert.strictEqual(
      repository!.conflicts.resourceStates.length,
      0,
      "Should have no conflicts initially"
    );
  });

  test("Status update detects new unversioned file", async function () {
    this.timeout(10000);
    assert.ok(repository, "Repository should exist");

    const testFile = path.join(checkoutDir.fsPath, "unversioned.txt");
    fs.writeFileSync(testFile, "test content");

    await repository!.updateModelState();

    assert.strictEqual(
      repository!.unversioned.resourceStates.length,
      1,
      "Should detect one unversioned file"
    );
    assert.strictEqual(
      repository!.unversioned.resourceStates[0].resourceUri.fsPath,
      testFile,
      "Should detect correct file"
    );

    // Cleanup
    fs.unlinkSync(testFile);
    await repository!.updateModelState();
  });

  test("Status update detects modified file", async function () {
    this.timeout(10000);
    assert.ok(repository, "Repository should exist");

    // Add and commit a file first
    const testFile = path.join(checkoutDir.fsPath, "modified.txt");
    fs.writeFileSync(testFile, "original content");
    await repository!.addFiles([testFile]);
    await repository!.commitFiles("Add test file", [testFile]);

    // Verify no changes after commit
    assert.strictEqual(
      repository!.changes.resourceStates.length,
      0,
      "Should have no changes after commit"
    );

    // Modify the file
    fs.writeFileSync(testFile, "modified content");
    await repository!.updateModelState();

    // Verify modified file is detected
    assert.strictEqual(
      repository!.changes.resourceStates.length,
      1,
      "Should detect one modified file"
    );
    assert.strictEqual(
      repository!.changes.resourceStates[0].type,
      Status.MODIFIED,
      "Status should be modified"
    );

    // Cleanup - revert the file
    await repository!.revert([testFile], "infinity" as const);
    await repository!.updateModelState();
  });
});
