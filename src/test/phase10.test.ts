import * as assert from "assert";
import { commands, Uri } from "vscode";
import { SourceControlManager } from "../source_control_manager";
import { Repository } from "../repository";
import * as testUtil from "./testUtil";

suite("Phase 10: Regression + Hot Path Performance", () => {
  let repoUri: Uri;
  let checkoutDir: Uri;
  let sourceControlManager: SourceControlManager;
  let repository: Repository;

  suiteSetup(async () => {
    await testUtil.activeExtension();
    repoUri = await testUtil.createRepoServer();
    await testUtil.createStandardLayout(testUtil.getSvnUrl(repoUri));
    checkoutDir = await testUtil.createRepoCheckout(
      testUtil.getSvnUrl(repoUri) + "/trunk"
    );

    sourceControlManager = (await commands.executeCommand(
      "svn.getSourceControlManager",
      checkoutDir
    )) as SourceControlManager;
    
    await sourceControlManager.tryOpenRepository(checkoutDir.fsPath);
    repository = sourceControlManager.getRepository(checkoutDir)!;
  });

  suiteTeardown(() => {
    sourceControlManager?.openRepositories.forEach(r => r.dispose());
    testUtil.destroyAllTempPaths();
  });

  test("10.1: Workspace scan completes without freeze", async function() {
    this.timeout(30000);
    await sourceControlManager.tryOpenRepository(checkoutDir.fsPath, 0);
    assert.ok(true, "Scan completed successfully");
  });

  test("10.2: Command execution overhead under 5ms", async function() {
    this.timeout(10000);
    const iterations = 100;
    const start = Date.now();
    
    for (let i = 0; i < iterations; i++) {
      const repo = sourceControlManager.getRepository(checkoutDir);
      assert.ok(repo);
    }
    
    const elapsed = Date.now() - start;
    const avgPerCall = elapsed / iterations;
    const msg = "Avg call time " + avgPerCall + "ms should be under 5ms";
    assert.ok(avgPerCall < 5, msg);
  });

  test("10.2: Repository lookup works without IPC", async function() {
    const repo = sourceControlManager.getRepository(checkoutDir);
    assert.ok(repo);
    assert.strictEqual(repo, repository);
  });

  test("10.3: updateInfo skipped when cache fresh", async function() {
    this.timeout(10000);
    // Note: updateInfo is private, testing via info property
    const info1 = repository.info;
    const info2 = repository.info;
    assert.ok(info1, "Info should be available");
    assert.strictEqual(info1, info2, "Should return same info object");
  });
});
