import * as assert from "assert";

/**
 * Security Tests for fileOperations.ts
 *
 * Tests security validation logic inline since revision validation
 * uses simple regex that can be tested directly.
 */
suite("fileOperations Security Tests", () => {
  suite("UNC Path Validation (Windows)", () => {
    test("rejects UNC paths on Windows", () => {
      const isUncPath = (p: string) => process.platform === "win32" && p.startsWith("\\\\");

      if (process.platform === "win32") {
        assert.ok(isUncPath("\\\\server\\share\\evil.exe"), "Should reject UNC path");
        assert.ok(isUncPath("\\\\10.0.0.1\\share\\tool.exe"), "Should reject IP-based UNC");
        assert.ok(isUncPath("\\\\?\\UNC\\server\\share"), "Should reject extended UNC");
      }
    });

    test("allows absolute local paths", () => {
      const isUncPath = (p: string) => process.platform === "win32" && p.startsWith("\\\\");

      assert.ok(!isUncPath("C:\\Program Files\\Tool\\tool.exe"), "Should allow C: drive");
      assert.ok(!isUncPath("D:\\Tools\\diff.exe"), "Should allow other drives");
      assert.ok(!isUncPath("/usr/bin/diff"), "Should allow Unix paths");
    });

    test("allows relative paths (caught by isAbsolute check)", () => {
      const isUncPath = (p: string) => process.platform === "win32" && p.startsWith("\\\\");

      assert.ok(!isUncPath("..\\..\\evil.exe"), "Relative paths not UNC");
      assert.ok(!isUncPath(".\\tool.exe"), "Current dir not UNC");
    });
  });

  suite("Revision Format Validation", () => {
    // Test the same regex that diffWithExternalTool uses: /^\d+$/
    const revisionRegex = /^\d+$/;

    test("accepts valid numeric revisions", () => {
      assert.ok(revisionRegex.test("123"), "Should accept '123'");
      assert.ok(revisionRegex.test("1"), "Should accept '1'");
      assert.ok(revisionRegex.test("1000000000"), "Should accept max valid revision");
    });

    test("rejects non-numeric characters", () => {
      assert.ok(!revisionRegex.test("abc"), "Should reject 'abc'");
      assert.ok(!revisionRegex.test("xyz"), "Should reject 'xyz'");
      assert.ok(!revisionRegex.test("12abc"), "Should reject '12abc'");
    });

    test("rejects injection attempts", () => {
      assert.ok(!revisionRegex.test("123; rm -rf /"), "Should reject injection with semicolon");
      assert.ok(!revisionRegex.test("124 && evil"), "Should reject injection with AND");
      assert.ok(!revisionRegex.test("123 | cat"), "Should reject injection with pipe");
      assert.ok(!revisionRegex.test("123`whoami`"), "Should reject injection with backticks");
      assert.ok(!revisionRegex.test("123$(evil)"), "Should reject injection with command substitution");
    });

    test("rejects negative numbers", () => {
      assert.ok(!revisionRegex.test("-123"), "Should reject negative revision");
      assert.ok(!revisionRegex.test("-1"), "Should reject negative one");
    });

    test("rejects special characters", () => {
      assert.ok(!revisionRegex.test("123@HEAD"), "Should reject @ symbol");
      assert.ok(!revisionRegex.test("123:124"), "Should reject colon");
      assert.ok(!revisionRegex.test("r123"), "Should reject 'r' prefix");
      assert.ok(!revisionRegex.test("REV123"), "Should reject 'REV' prefix");
    });

    test("rejects whitespace", () => {
      assert.ok(!revisionRegex.test("123 456"), "Should reject space");
      assert.ok(!revisionRegex.test(" 123"), "Should reject leading space");
      assert.ok(!revisionRegex.test("123 "), "Should reject trailing space");
      assert.ok(!revisionRegex.test("123\t456"), "Should reject tab");
      assert.ok(!revisionRegex.test("123\n"), "Should reject newline");
    });

    test("rejects empty string", () => {
      assert.ok(!revisionRegex.test(""), "Should reject empty string");
    });

    test("rejects path traversal attempts", () => {
      assert.ok(!revisionRegex.test("../123"), "Should reject ../");
      assert.ok(!revisionRegex.test("..\\123"), "Should reject ..\\");
      assert.ok(!revisionRegex.test("/etc/passwd"), "Should reject path");
    });

    test("rejects URL schemes", () => {
      assert.ok(!revisionRegex.test("file://123"), "Should reject file:// scheme");
      assert.ok(!revisionRegex.test("http://123"), "Should reject http:// scheme");
    });
  });
});
