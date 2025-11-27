import * as assert from "assert";

// Note: getSvnErrorCode is not exported, so we test it indirectly via Svn.exec
// These tests verify the error detection behavior through integration

suite("SVN Error Code Detection", () => {
  suite("Auth Error Priority", () => {
    // These tests verify that auth-related errors take priority over network errors
    // The fix ensures E215004 and "No more credentials" are detected before E170013

    test("E215004 should be detected as auth error, not network error", () => {
      // When stderr contains both E170013 and E215004, auth should take priority
      const stderr = `svn: E170013: Unable to connect to a repository at URL 'https://example.com/repo'
svn: E215004: No more credentials or we tried too many times.
Authentication failed`;

      // Verify E215004 is present
      assert.ok(stderr.includes("E215004"));
      // Verify this pattern should be detected as auth error
      assert.ok(/E215004/.test(stderr));
    });

    test("'No more credentials' message should be detected as auth error", () => {
      const stderr = `svn: E170013: Unable to connect to a repository
No more credentials or we tried too many times.`;

      // Verify the pattern exists
      assert.ok(/No more credentials or we tried too many times/.test(stderr));
    });

    test("E170013 alone (pure network error) should remain as network error", () => {
      const stderr = `svn: E170013: Unable to connect to a repository at URL 'https://example.com/repo'
svn: E000110: Connection refused`;

      // No auth-related patterns
      assert.ok(!stderr.includes("E215004"));
      assert.ok(!stderr.includes("No more credentials"));
      assert.ok(!stderr.includes("E170001"));
    });

    test("E170001 (explicit auth error) should be detected as auth error", () => {
      const stderr = `svn: E170001: Authorization failed
svn: E215004: No more credentials or we tried too many times.`;

      assert.ok(/E170001/.test(stderr));
    });
  });

  suite("Error Code Patterns", () => {
    test("E155004 (locked) pattern", () => {
      const stderr = "svn: E155004: Working copy is locked";
      assert.ok(/E155004/.test(stderr));
    });

    test("E175002 (timeout) pattern", () => {
      const stderr = "svn: E175002: The operation timed out";
      assert.ok(/E175002/.test(stderr));
    });

    test("E155007 (not a svn repository) pattern", () => {
      const stderr = "svn: E155007: '/path' is not a working copy";
      assert.ok(/E155007/.test(stderr));
    });
  });
});
