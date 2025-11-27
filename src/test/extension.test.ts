import * as assert from "assert";
import * as path from "path";
import * as fs from "fs";
import * as vscode from "vscode";
import * as testUtil from "./testUtil";

suite("Extension Tests", () => {
  setup(async () => {});

  teardown(() => {
    testUtil.destroyAllTempPaths();
  });

  test("should be present", () => {
    assert.ok(vscode.extensions.getExtension("vrognas.positron-svn"));
  });

  test("should have extensionKind set to workspace for remote development", () => {
    // Read package.json and verify extensionKind is properly configured
    const packageJsonPath = path.join(__dirname, "..", "..", "package.json");
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

    // extensionKind should be "workspace" only - extension needs access to SVN CLI on remote
    assert.ok(packageJson.extensionKind, "extensionKind should be defined");
    assert.ok(
      Array.isArray(packageJson.extensionKind),
      "extensionKind should be an array"
    );
    assert.ok(
      packageJson.extensionKind.includes("workspace"),
      "extensionKind should include 'workspace'"
    );
    assert.strictEqual(
      packageJson.extensionKind.length,
      1,
      "extensionKind should only contain 'workspace' to prevent duplicate activation"
    );
  });

  // The extension is already activated by vscode before running mocha test framework.
  // No need to test activate any more. So commenting this case.
  // tslint:disable-next-line: only-arrow-functions
  test("should be able to activate the extension", function (done) {
    this.timeout(60 * 1000);
    const extension = vscode.extensions.getExtension(
      "vrognas.positron-svn"
    ) as vscode.Extension<any>;

    if (!extension) {
      assert.fail("Extension not found");
    }

    if (!extension.isActive) {
      extension.activate().then(
        _api => {
          done();
        },
        () => {
          assert.fail("Failed to activate extension");
        }
      );
    } else {
      done();
    }
  });
});
