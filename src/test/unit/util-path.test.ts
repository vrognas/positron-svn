import * as assert from "assert";
import { fixPathSeparator, normalizePath, isDescendant, fixPegRevision } from "../../util";

suite("Util - Path Tests", () => {
  suite("fixPathSeparator", () => {
    test("converts backslashes to forward slashes", () => {
      assert.strictEqual(fixPathSeparator("C:\\Users\\test"), "C:/Users/test");
      assert.strictEqual(fixPathSeparator("path\\to\\file.txt"), "path/to/file.txt");
    });

    test("handles mixed separators", () => {
      assert.strictEqual(fixPathSeparator("C:\\Users/test\\file.txt"), "C:/Users/test/file.txt");
    });

    test("leaves forward slashes unchanged", () => {
      assert.strictEqual(fixPathSeparator("/usr/local/bin"), "/usr/local/bin");
      assert.strictEqual(fixPathSeparator("path/to/file"), "path/to/file");
    });

    test("handles empty string", () => {
      assert.strictEqual(fixPathSeparator(""), "");
    });
  });

  suite("normalizePath", () => {
    test("converts backslashes and lowercases", () => {
      assert.strictEqual(normalizePath("C:\\Users\\Test"), "c:/users/test");
      assert.strictEqual(normalizePath("PATH\\TO\\FILE"), "path/to/file");
    });

    test("handles forward slashes", () => {
      assert.strictEqual(normalizePath("/Usr/Local/Bin"), "/usr/local/bin");
    });

    test("handles empty string", () => {
      assert.strictEqual(normalizePath(""), "");
    });
  });

  suite("isDescendant", () => {
    test("returns true for direct children", () => {
      assert.strictEqual(isDescendant("/parent", "/parent/child"), true);
      assert.strictEqual(isDescendant("C:/Users", "C:/Users/test"), true);
    });

    test("returns true for nested descendants", () => {
      assert.strictEqual(isDescendant("/parent", "/parent/child/grandchild"), true);
      assert.strictEqual(isDescendant("C:/", "C:/Users/test/file.txt"), true);
    });

    test("returns false for non-descendants", () => {
      assert.strictEqual(isDescendant("/parent", "/other"), false);
      assert.strictEqual(isDescendant("/parent", "/parent-sibling"), false);
      assert.strictEqual(isDescendant("C:/Users", "C:/Program Files"), false);
    });

    test("returns false for parent itself", () => {
      assert.strictEqual(isDescendant("/parent", "/parent"), false);
    });

    test("handles case sensitivity on Windows-style paths", () => {
      // Normalized paths should match
      assert.strictEqual(isDescendant("C:/Users", "c:/users/test"), true);
    });

    test("handles trailing slashes", () => {
      assert.strictEqual(isDescendant("/parent/", "/parent/child"), true);
      assert.strictEqual(isDescendant("/parent", "/parent/child/"), true);
    });
  });

  suite("fixPegRevision", () => {
    test("escapes @ symbol in paths", () => {
      assert.strictEqual(fixPegRevision("file@2x.png"), "file@2x.png@");
      assert.strictEqual(fixPegRevision("path/to/file@.txt"), "path/to/file@.txt@");
    });

    test("leaves paths without @ unchanged", () => {
      assert.strictEqual(fixPegRevision("file.txt"), "file.txt");
      assert.strictEqual(fixPegRevision("path/to/file.txt"), "path/to/file.txt");
    });

    test("handles multiple @ symbols", () => {
      assert.strictEqual(fixPegRevision("file@2@3.txt"), "file@2@3.txt@");
    });

    test("handles empty string", () => {
      assert.strictEqual(fixPegRevision(""), "");
    });
  });
});
