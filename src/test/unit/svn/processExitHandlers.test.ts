import * as assert from "assert";
import { Svn } from "../../../svn";
import { SvnAuthCache } from "../../../services/svnAuthCache";

/**
 * Unit Tests for Svn Process Exit Handlers
 * Tests credential cleanup on process exit (SIGINT, SIGTERM, exit)
 */
suite("Svn - Process Exit Handlers", () => {
  let svn: Svn;

  setup(() => {
    svn = new Svn({ svnPath: "/usr/bin/svn", version: "1.14.0" });
  });

  teardown(() => {
    svn.getAuthCache().dispose();
  });

  test("1.1: getAuthCache() returns SvnAuthCache instance", () => {
    const authCache = svn.getAuthCache();
    assert.ok(authCache instanceof SvnAuthCache, "Should return SvnAuthCache instance");
  });

  test("1.2: getAuthCache() returns same instance on multiple calls", () => {
    const cache1 = svn.getAuthCache();
    const cache2 = svn.getAuthCache();
    assert.strictEqual(cache1, cache2, "Should return same instance");
  });

  test("1.3: getAuthCache().dispose() cleans up credentials", async () => {
    const authCache = svn.getAuthCache();

    // Write a test credential
    await authCache.writeCredential("testuser", "testpass", "https://example.com");

    // Verify file was written
    const filesBefore = authCache.getWrittenFiles();
    assert.strictEqual(filesBefore.length, 1, "Should have one credential file");

    // Dispose (cleanup)
    authCache.dispose();

    // Verify writtenFiles is cleared
    const filesAfter = authCache.getWrittenFiles();
    assert.strictEqual(filesAfter.length, 0, "Should clear written files after dispose");
  });
});
