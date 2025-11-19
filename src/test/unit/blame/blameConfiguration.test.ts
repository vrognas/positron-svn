import * as assert from "assert";
import { blameConfiguration } from "../../../blame/blameConfiguration";

suite("BlameConfiguration Tests", () => {
  setup(() => {
    // Reset to defaults before each test
  });

  teardown(() => {
    // Clean up after tests
  });

  suite("Basic Configuration Access", () => {
    test("should read blame enabled setting", () => {
      const enabled = blameConfiguration.get("enabled", true);
      assert.strictEqual(typeof enabled, "boolean");
    });

    test("should read autoBlame setting with default", () => {
      const autoBlame = blameConfiguration.get("autoBlame", false);
      assert.strictEqual(typeof autoBlame, "boolean");
    });

    test("should read dateFormat setting", () => {
      const dateFormat = blameConfiguration.get("dateFormat", "relative");
      assert.ok(["relative", "absolute"].includes(dateFormat));
    });
  });

  suite("Large File Handling", () => {
    test("should have default large file limit", () => {
      const limit = blameConfiguration.get("largeFileLimit", 100000);
      assert.strictEqual(typeof limit, "number");
      assert.ok(limit > 0);
    });

    test("should read large file warning setting", () => {
      const warn = blameConfiguration.get("largeFileWarning", true);
      assert.strictEqual(typeof warn, "boolean");
    });

    test("should determine if file is too large", () => {
      const limit = blameConfiguration.get("largeFileLimit", 100000);
      const isLarge = 150000 > limit;
      assert.strictEqual(isLarge, true);
    });
  });

  suite("Display Settings", () => {
    test("should read status bar visibility setting", () => {
      const visible = blameConfiguration.get("statusBar.enabled", true);
      assert.strictEqual(typeof visible, "boolean");
    });

    test("should read gutter decoration setting", () => {
      const visible = blameConfiguration.get("gutter.enabled", true);
      assert.strictEqual(typeof visible, "boolean");
    });

    test("should read commit message fetching setting", () => {
      const enabled = blameConfiguration.get("enableLogs", true);
      assert.strictEqual(typeof enabled, "boolean");
    });
  });
});
