import * as assert from "assert";
import { camelcase, validateSvnPath } from "../../util";

suite("Util - Security Tests", () => {
  suite("camelcase", () => {
    test("converts hyphenated names", () => {
      assert.strictEqual(camelcase("wc-status"), "wcStatus");
      assert.strictEqual(camelcase("wcroot-abspath"), "wcrootAbspath");
      assert.strictEqual(camelcase("relative-url"), "relativeUrl");
    });

    test("rejects overly long names (ReDoS protection)", () => {
      const longName = 'a'.repeat(2000);
      assert.throws(() => {
        camelcase(longName);
      }, /tag name too long/i);
    });

    test("rejects invalid characters", () => {
      assert.throws(() => {
        camelcase("invalid<tag>");
      }, /invalid characters/i);

      assert.throws(() => {
        camelcase("tag&name");
      }, /invalid characters/i);
    });
  });

  suite("validateSvnPath", () => {
    test("allows valid relative paths", () => {
      assert.strictEqual(validateSvnPath("file.txt"), "file.txt");
      assert.strictEqual(validateSvnPath("dir/file.txt"), "dir/file.txt");
      assert.strictEqual(validateSvnPath("a/b/c/file.txt"), "a/b/c/file.txt");
    });

    test("rejects absolute Unix paths", () => {
      assert.throws(() => {
        validateSvnPath("/etc/passwd");
      }, /absolute paths not allowed/i);
    });

    test("rejects absolute Windows paths", () => {
      assert.throws(() => {
        validateSvnPath("C:\\Windows\\System32");
      }, /absolute paths not allowed/i);

      assert.throws(() => {
        validateSvnPath("D:/data");
      }, /absolute paths not allowed/i);
    });

    test("rejects path traversal", () => {
      assert.throws(() => {
        validateSvnPath("../etc/passwd");
      }, /path traversal not allowed/i);

      assert.throws(() => {
        validateSvnPath("dir/../../secret");
      }, /path traversal not allowed/i);
    });

    test("rejects null bytes", () => {
      assert.throws(() => {
        validateSvnPath("file\u0000.txt");
      }, /null bytes/i);
    });

    test("rejects empty paths", () => {
      assert.throws(() => {
        validateSvnPath("");
      }, /empty/i);

      assert.throws(() => {
        validateSvnPath("   ");
      }, /empty/i);
    });

    test("normalizes paths", () => {
      // Should normalize but not reject valid paths
      const result = validateSvnPath("dir/./file.txt");
      assert.ok(!result.includes('.'));
    });
  });
});
