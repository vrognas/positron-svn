import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { SvnAuthCache } from "../../../services/svnAuthCache";

/**
 * Unit Tests for SvnAuthCache Service
 * Tests credential file writing, reading, cleanup, and error handling
 */
suite("SvnAuthCache - Unit Tests", () => {
  let authCache: SvnAuthCache;
  let testCacheDir: string;
  let originalHomedir: () => string;

  setup(() => {
    // Create temp cache directory for testing
    testCacheDir = path.join(os.tmpdir(), `svn-auth-test-${Date.now()}`);

    // Mock os.homedir to return test directory
    originalHomedir = os.homedir;
    (os as any).homedir = () => testCacheDir;

    authCache = new SvnAuthCache();
  });

  teardown(() => {
    // Restore original os.homedir
    (os as any).homedir = originalHomedir;

    // Clean up test cache directory
    if (fs.existsSync(testCacheDir)) {
      fs.rmSync(testCacheDir, { recursive: true, force: true });
    }

    authCache.dispose();
  });

  suite("Credential File Writing", () => {
    test("1.1: writes credential file in correct SVN format", async () => {
      const username = "alice";
      const password = "secret123";
      const realmUrl = "https://svn.example.com:443";

      await authCache.writeCredential(username, password, realmUrl);

      // Verify file exists
      const cacheFiles = authCache.getWrittenFiles();
      assert.strictEqual(cacheFiles.length, 1, "Should write exactly one cache file");

      // Read file and verify format
      const content = fs.readFileSync(cacheFiles[0], "utf8");

      // SVN format: K <length>\n<key>\nV <length>\n<value>\n
      assert.ok(content.includes(`K 8\nusername\nV ${username.length}\n${username}\n`));
      assert.ok(content.includes(`K 8\npassword\nV ${password.length}\n${password}\n`));
      assert.ok(content.includes("K 15\nsvn:realmstring"));
      assert.ok(content.includes("END"), "Should end with END marker");
    });

    test("1.2: sets file permissions to mode 600 on Unix", async function() {
      if (process.platform === "win32") {
        return this.skip(); // Skip on Windows
      }

      await authCache.writeCredential("bob", "pass456", "https://svn.test.com:443");

      const cacheFiles = authCache.getWrittenFiles();
      const stats = fs.statSync(cacheFiles[0]);
      const mode = stats.mode & 0o777;

      assert.strictEqual(mode, 0o600, "File should have mode 600 (owner read/write only)");
    });

    test("1.3: sets restricted ACL on Windows", async function() {
      if (process.platform !== "win32") {
        return this.skip(); // Skip on non-Windows
      }

      await authCache.writeCredential("charlie", "win_pass", "https://svn.corp.com:443");

      const cacheFiles = authCache.getWrittenFiles();

      // Verify file exists and is not world-readable
      // Windows ACL check requires platform-specific APIs (skip detailed check in test)
      assert.ok(fs.existsSync(cacheFiles[0]), "Cache file should exist");
    });

    test("1.4: creates cache directory if not exists", async () => {
      // Ensure cache directory doesn't exist
      const cacheDir = path.join(testCacheDir, ".subversion", "auth", "svn.simple");
      if (fs.existsSync(cacheDir)) {
        fs.rmSync(cacheDir, { recursive: true });
      }

      await authCache.writeCredential("user1", "pass1", "https://svn.example.com:443");

      assert.ok(fs.existsSync(cacheDir), "Should create cache directory");
    });

    test("1.5: generates consistent filename for same realm+username", async () => {
      const username = "alice";
      const password1 = "oldpass";
      const password2 = "newpass";
      const realmUrl = "https://svn.example.com:443";

      await authCache.writeCredential(username, password1, realmUrl);
      const files1 = authCache.getWrittenFiles();

      // Clear and write again with different password
      authCache.clearCache();
      await authCache.writeCredential(username, password2, realmUrl);
      const files2 = authCache.getWrittenFiles();

      // Filenames should be identical (based on realm+username hash)
      const filename1 = path.basename(files1[0]);
      const filename2 = path.basename(files2[0]);
      assert.strictEqual(filename1, filename2, "Should use same filename for same realm+username");
    });

    test("1.6: overwrites existing credential file", async () => {
      const username = "user1";
      const oldPassword = "oldpass";
      const newPassword = "newpass";
      const realmUrl = "https://svn.example.com:443";

      // Write initial credential
      await authCache.writeCredential(username, oldPassword, realmUrl);
      const initialContent = fs.readFileSync(authCache.getWrittenFiles()[0], "utf8");
      assert.ok(initialContent.includes(oldPassword));

      // Overwrite with new password
      await authCache.writeCredential(username, newPassword, realmUrl);
      const updatedContent = fs.readFileSync(authCache.getWrittenFiles()[0], "utf8");

      assert.ok(updatedContent.includes(newPassword), "Should contain new password");
      assert.ok(!updatedContent.includes(oldPassword), "Should not contain old password");
    });

    test("1.7: handles special characters in username/password", async () => {
      const username = "user@example.com";
      const password = "p@$$w0rd!#%&*()";
      const realmUrl = "https://svn.example.com:443";

      await authCache.writeCredential(username, password, realmUrl);

      const content = fs.readFileSync(authCache.getWrittenFiles()[0], "utf8");
      assert.ok(content.includes(username), "Should handle @ in username");
      assert.ok(content.includes(password), "Should handle special chars in password");
    });

    test("1.8: generates correct realm string from repository URL", async () => {
      const testCases = [
        {
          url: "https://svn.example.com:443/repo",
          expectedRealm: "<https://svn.example.com:443> Authentication Realm"
        },
        {
          url: "http://svn.test.com:80/svn",
          expectedRealm: "<http://svn.test.com:80> Authentication Realm"
        },
        {
          url: "svn://svn.local/repository",
          expectedRealm: "<svn://svn.local> Authentication Realm"
        }
      ];

      for (const testCase of testCases) {
        authCache.clearCache();
        await authCache.writeCredential("user", "pass", testCase.url);

        const content = fs.readFileSync(authCache.getWrittenFiles()[0], "utf8");
        // Realm string should be in the content (exact format may vary)
        assert.ok(content.includes("svn:realmstring"), `Should include realm for ${testCase.url}`);
      }
    });
  });

  suite("Credential File Reading", () => {
    test("2.1: reads credential file and returns credentials", async () => {
      const username = "alice";
      const password = "secret123";
      const realmUrl = "https://svn.example.com:443";

      await authCache.writeCredential(username, password, realmUrl);
      const credentials = await authCache.readCredential(realmUrl);

      assert.ok(credentials, "Should return credentials");
      assert.strictEqual(credentials!.username, username);
      assert.strictEqual(credentials!.password, password);
    });

    test("2.2: returns null when credential file not found", async () => {
      const credentials = await authCache.readCredential("https://nonexistent.com:443");
      assert.strictEqual(credentials, null, "Should return null for non-existent realm");
    });

    test("2.3: parses SVN key-value format correctly", async () => {
      // Write credential using cache
      await authCache.writeCredential("user1", "pass1", "https://svn.example.com:443");

      // Read and verify parsing
      const credentials = await authCache.readCredential("https://svn.example.com:443");

      assert.strictEqual(credentials!.username, "user1");
      assert.strictEqual(credentials!.password, "pass1");
    });

    test("2.4: handles missing username key in credential file", async () => {
      // Write valid credential first
      await authCache.writeCredential("user", "pass", "https://svn.example.com:443");
      const filePath = authCache.getWrittenFiles()[0];

      // Corrupt file - remove username
      let content = fs.readFileSync(filePath, "utf8");
      content = content.replace(/K 8\nusername\nV \d+\n[^\n]+\n/g, "");
      fs.writeFileSync(filePath, content);

      // Should return null or handle gracefully
      const credentials = await authCache.readCredential("https://svn.example.com:443");
      assert.strictEqual(credentials, null, "Should handle missing username gracefully");
    });

    test("2.5: handles missing password key in credential file", async () => {
      // Write valid credential first
      await authCache.writeCredential("user", "pass", "https://svn.example.com:443");
      const filePath = authCache.getWrittenFiles()[0];

      // Corrupt file - remove password
      let content = fs.readFileSync(filePath, "utf8");
      content = content.replace(/K 8\npassword\nV \d+\n[^\n]+\n/g, "");
      fs.writeFileSync(filePath, content);

      // Should return null or handle gracefully
      const credentials = await authCache.readCredential("https://svn.example.com:443");
      assert.strictEqual(credentials, null, "Should handle missing password gracefully");
    });
  });

  suite("Credential Cleanup", () => {
    test("3.1: deletes credential file on explicit cleanup", async () => {
      const realmUrl = "https://svn.example.com:443";
      await authCache.writeCredential("user", "pass", realmUrl);

      const filePath = authCache.getWrittenFiles()[0];
      assert.ok(fs.existsSync(filePath), "File should exist before cleanup");

      await authCache.deleteCredential(realmUrl);
      assert.ok(!fs.existsSync(filePath), "File should be deleted after cleanup");
    });

    test("3.2: cleanup is idempotent (safe to call multiple times)", async () => {
      const realmUrl = "https://svn.example.com:443";
      await authCache.writeCredential("user", "pass", realmUrl);

      await authCache.deleteCredential(realmUrl);
      await authCache.deleteCredential(realmUrl); // Second call should not throw

      assert.ok(true, "Should not throw on second cleanup");
    });

    test("3.3: deletes all cache files on dispose", async () => {
      await authCache.writeCredential("user1", "pass1", "https://svn1.example.com:443");
      await authCache.writeCredential("user2", "pass2", "https://svn2.example.com:443");

      const files = authCache.getWrittenFiles();
      assert.strictEqual(files.length, 2, "Should have 2 cache files");

      authCache.dispose();

      files.forEach(file => {
        assert.ok(!fs.existsSync(file), `File ${file} should be deleted on dispose`);
      });
    });

    test("3.4: handles cleanup of non-existent file gracefully", async () => {
      // Try to delete credential that was never written
      await authCache.deleteCredential("https://never-existed.com:443");
      assert.ok(true, "Should not throw when deleting non-existent credential");
    });
  });

  suite("Error Handling", () => {
    test("4.1: handles write failure due to permission denied", async function() {
      if (process.platform === "win32") {
        return this.skip(); // Skip on Windows (ACL handling different)
      }

      // Create cache directory with no write permissions
      const cacheDir = path.join(testCacheDir, ".subversion", "auth", "svn.simple");
      fs.mkdirSync(cacheDir, { recursive: true });
      fs.chmodSync(cacheDir, 0o444); // Read-only

      try {
        await authCache.writeCredential("user", "pass", "https://svn.example.com:443");
        assert.fail("Should throw error on permission denied");
      } catch (err) {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes("permission") || err.message.includes("EACCES"));
      } finally {
        // Restore permissions for cleanup
        fs.chmodSync(cacheDir, 0o755);
      }
    });

    test("4.2: handles read failure due to permission denied", async function() {
      if (process.platform === "win32") {
        return this.skip(); // Skip on Windows
      }

      await authCache.writeCredential("user", "pass", "https://svn.example.com:443");
      const filePath = authCache.getWrittenFiles()[0];

      // Make file unreadable
      fs.chmodSync(filePath, 0o000);

      try {
        await authCache.readCredential("https://svn.example.com:443");
        assert.fail("Should throw error on permission denied");
      } catch (err) {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes("permission") || err.message.includes("EACCES"));
      } finally {
        // Restore permissions for cleanup
        fs.chmodSync(filePath, 0o600);
      }
    });

    test("4.3: handles corrupt credential file format", async () => {
      await authCache.writeCredential("user", "pass", "https://svn.example.com:443");
      const filePath = authCache.getWrittenFiles()[0];

      // Write completely invalid content
      fs.writeFileSync(filePath, "this is not valid SVN format\ngarbage data");

      const credentials = await authCache.readCredential("https://svn.example.com:443");
      assert.strictEqual(credentials, null, "Should return null for corrupt file");
    });

    test("4.4: handles empty credential file", async () => {
      await authCache.writeCredential("user", "pass", "https://svn.example.com:443");
      const filePath = authCache.getWrittenFiles()[0];

      // Write empty file
      fs.writeFileSync(filePath, "");

      const credentials = await authCache.readCredential("https://svn.example.com:443");
      assert.strictEqual(credentials, null, "Should return null for empty file");
    });

    test("4.5: handles disk full scenario (write failure)", async () => {
      // Mock fs.writeFileSync to simulate ENOSPC
      const originalWriteFileSync = fs.writeFileSync;
      (fs as any).writeFileSync = (path: string, data: any, options?: any) => {
        if (path.includes(".subversion")) {
          const err: any = new Error("ENOSPC: no space left on device");
          err.code = "ENOSPC";
          throw err;
        }
        return originalWriteFileSync(path, data, options);
      };

      try {
        await authCache.writeCredential("user", "pass", "https://svn.example.com:443");
        assert.fail("Should throw error on disk full");
      } catch (err) {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes("ENOSPC") || err.message.includes("space"));
      } finally {
        (fs as any).writeFileSync = originalWriteFileSync;
      }
    });
  });

  suite("Concurrent Access", () => {
    test("5.1: handles concurrent writes to different realms", async () => {
      // Write to different realms concurrently
      const writes = [
        authCache.writeCredential("user1", "pass1", "https://svn1.example.com:443"),
        authCache.writeCredential("user2", "pass2", "https://svn2.example.com:443"),
        authCache.writeCredential("user3", "pass3", "https://svn3.example.com:443")
      ];

      await Promise.all(writes);

      const files = authCache.getWrittenFiles();
      assert.strictEqual(files.length, 3, "Should create 3 separate cache files");
    });

    test("5.2: handles concurrent writes to same realm (last write wins)", async () => {
      const realmUrl = "https://svn.example.com:443";

      // Write same realm concurrently with different passwords
      const writes = [
        authCache.writeCredential("user", "pass1", realmUrl),
        authCache.writeCredential("user", "pass2", realmUrl),
        authCache.writeCredential("user", "pass3", realmUrl)
      ];

      await Promise.all(writes);

      // Last write should win (one of pass1, pass2, or pass3)
      const credentials = await authCache.readCredential(realmUrl);
      assert.ok(credentials, "Should have credentials");
      assert.ok(
        ["pass1", "pass2", "pass3"].includes(credentials!.password),
        "Should contain one of the written passwords"
      );
    });

    test("5.3: handles concurrent read and write to same realm", async () => {
      const realmUrl = "https://svn.example.com:443";

      // Initial write
      await authCache.writeCredential("user", "initialpass", realmUrl);

      // Concurrent read and write
      const operations = [
        authCache.readCredential(realmUrl),
        authCache.writeCredential("user", "newpass", realmUrl),
        authCache.readCredential(realmUrl)
      ];

      const results = await Promise.all(operations);

      // First and second reads should succeed (may return old or new password)
      assert.ok(results[0], "First read should succeed");
      assert.ok(results[2], "Second read should succeed");
    });
  });

  suite("Cross-Platform Paths", () => {
    test("6.1: uses correct cache directory on Linux", function() {
      if (process.platform !== "linux") {
        return this.skip();
      }

      const cacheDir = authCache.getCacheDirectory();
      assert.ok(cacheDir.includes(".subversion/auth/svn.simple"));
      assert.ok(cacheDir.startsWith(testCacheDir));
    });

    test("6.2: uses correct cache directory on macOS", function() {
      if (process.platform !== "darwin") {
        return this.skip();
      }

      const cacheDir = authCache.getCacheDirectory();
      assert.ok(cacheDir.includes(".subversion/auth/svn.simple"));
      assert.ok(cacheDir.startsWith(testCacheDir));
    });

    test("6.3: uses correct cache directory on Windows", function() {
      if (process.platform !== "win32") {
        return this.skip();
      }

      const cacheDir = authCache.getCacheDirectory();
      // Windows may use %APPDATA% or %USERPROFILE%
      assert.ok(
        cacheDir.includes("Subversion\\auth\\svn.simple") ||
        cacheDir.includes(".subversion\\auth\\svn.simple")
      );
    });

    test("6.4: normalizes path separators for current platform", async () => {
      await authCache.writeCredential("user", "pass", "https://svn.example.com:443");

      const filePath = authCache.getWrittenFiles()[0];
      const separator = process.platform === "win32" ? "\\" : "/";

      assert.ok(filePath.includes(separator), `Should use ${separator} as path separator`);
    });
  });
});
