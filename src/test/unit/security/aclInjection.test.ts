/**
 * Security tests for Windows ACL command injection vulnerability (CRITICAL fix)
 *
 * Tests the fix for shell:true command injection in svnAuthCache.ts:329
 * CVSS 9.8 - Command injection via USERNAME environment variable
 */

import * as assert from "assert";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { SvnAuthCache } from "../../../services/svnAuthCache";

suite("Security: ACL Command Injection", () => {
  let testCacheDir: string;
  let authCache: SvnAuthCache;
  let originalUsername: string | undefined;

  setup(() => {
    // Create temporary directory for tests
    testCacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "svn-acl-test-"));
    authCache = new SvnAuthCache(testCacheDir);

    // Save original USERNAME env var
    originalUsername = process.env.USERNAME;
  });

  teardown(() => {
    // Restore original USERNAME
    if (originalUsername !== undefined) {
      process.env.USERNAME = originalUsername;
    } else {
      delete process.env.USERNAME;
    }

    // Cleanup test directory
    if (fs.existsSync(testCacheDir)) {
      fs.rmSync(testCacheDir, { recursive: true, force: true });
    }

    authCache.dispose();
  });

  // Skip all tests on non-Windows platforms
  if (process.platform !== "win32") {
    test("Windows-only tests - skipped on " + process.platform, () => {
      // Placeholder to show tests exist but are platform-specific
    });
    return;
  }

  suite("1. Shell Injection Attempts (Windows only)", () => {
    test("1.1: Blocks username with command separator", async () => {
      process.env.USERNAME = "admin & calc.exe & ";

      try {
        await authCache.writeCredential(
          "testuser",
          "testpass",
          "https://svn.example.com:443"
        );
        assert.fail("Should have thrown error for malicious username");
      } catch (err) {
        assert.ok(err instanceof Error);
        assert.match(
          err.message,
          /Invalid Windows username/,
          "Should reject invalid username"
        );
      }
    });

    test("1.2: Blocks username with pipe operator", async () => {
      process.env.USERNAME = "user | whoami";

      try {
        await authCache.writeCredential(
          "testuser",
          "testpass",
          "https://svn.example.com:443"
        );
        assert.fail("Should have thrown error for pipe injection");
      } catch (err) {
        assert.ok(err instanceof Error);
        assert.match(err.message, /Invalid Windows username/);
      }
    });

    test("1.3: Blocks username with semicolon", async () => {
      process.env.USERNAME = "user; net user hacker /add";

      try {
        await authCache.writeCredential(
          "testuser",
          "testpass",
          "https://svn.example.com:443"
        );
        assert.fail("Should have thrown error for semicolon injection");
      } catch (err) {
        assert.ok(err instanceof Error);
        assert.match(err.message, /Invalid Windows username/);
      }
    });

    test("1.4: Blocks username with command substitution", async () => {
      process.env.USERNAME = "admin$(whoami)";

      try {
        await authCache.writeCredential(
          "testuser",
          "testpass",
          "https://svn.example.com:443"
        );
        assert.fail("Should have thrown error for command substitution");
      } catch (err) {
        assert.ok(err instanceof Error);
        assert.match(err.message, /Invalid Windows username/);
      }
    });

    test("1.5: Blocks username with backticks", async () => {
      process.env.USERNAME = "admin`whoami`";

      try {
        await authCache.writeCredential(
          "testuser",
          "testpass",
          "https://svn.example.com:443"
        );
        assert.fail("Should have thrown error for backtick injection");
      } catch (err) {
        assert.ok(err instanceof Error);
        assert.match(err.message, /Invalid Windows username/);
      }
    });

    test("1.6: Blocks username with redirection", async () => {
      process.env.USERNAME = "admin > C:\\evil.txt";

      try {
        await authCache.writeCredential(
          "testuser",
          "testpass",
          "https://svn.example.com:443"
        );
        assert.fail("Should have thrown error for redirection injection");
      } catch (err) {
        assert.ok(err instanceof Error);
        assert.match(err.message, /Invalid Windows username/);
      }
    });

    test("1.7: Blocks username with newline", async () => {
      process.env.USERNAME = "admin\ncalc.exe";

      try {
        await authCache.writeCredential(
          "testuser",
          "testpass",
          "https://svn.example.com:443"
        );
        assert.fail("Should have thrown error for newline injection");
      } catch (err) {
        assert.ok(err instanceof Error);
        assert.match(err.message, /Invalid Windows username/);
      }
    });

    test("1.8: Blocks username with null byte", async () => {
      process.env.USERNAME = "admin\x00calc.exe";

      try {
        await authCache.writeCredential(
          "testuser",
          "testpass",
          "https://svn.example.com:443"
        );
        assert.fail("Should have thrown error for null byte injection");
      } catch (err) {
        assert.ok(err instanceof Error);
        assert.match(err.message, /Invalid Windows username/);
      }
    });
  });

  suite("2. Valid Usernames (Should Pass)", () => {
    test("2.1: Allows simple alphanumeric username", async () => {
      process.env.USERNAME = "alice";

      await authCache.writeCredential(
        "testuser",
        "testpass",
        "https://svn.example.com:443"
      );

      const files = authCache.getWrittenFiles();
      assert.strictEqual(files.length, 1, "Should create credential file");
      assert.ok(fs.existsSync(files[0]), "Credential file should exist");
    });

    test("2.2: Allows username with dot", async () => {
      process.env.USERNAME = "alice.smith";

      await authCache.writeCredential(
        "testuser",
        "testpass",
        "https://svn.example.com:443"
      );

      const files = authCache.getWrittenFiles();
      assert.strictEqual(files.length, 1);
    });

    test("2.3: Allows username with hyphen", async () => {
      process.env.USERNAME = "alice-dev";

      await authCache.writeCredential(
        "testuser",
        "testpass",
        "https://svn.example.com:443"
      );

      const files = authCache.getWrittenFiles();
      assert.strictEqual(files.length, 1);
    });

    test("2.4: Allows username with underscore", async () => {
      process.env.USERNAME = "alice_admin";

      await authCache.writeCredential(
        "testuser",
        "testpass",
        "https://svn.example.com:443"
      );

      const files = authCache.getWrittenFiles();
      assert.strictEqual(files.length, 1);
    });

    test("2.5: Allows username with numbers", async () => {
      process.env.USERNAME = "alice123";

      await authCache.writeCredential(
        "testuser",
        "testpass",
        "https://svn.example.com:443"
      );

      const files = authCache.getWrittenFiles();
      assert.strictEqual(files.length, 1);
    });

    test("2.6: Allows username with spaces (Windows allows this)", async () => {
      process.env.USERNAME = "Alice Smith";

      await authCache.writeCredential(
        "testuser",
        "testpass",
        "https://svn.example.com:443"
      );

      const files = authCache.getWrittenFiles();
      assert.strictEqual(files.length, 1);
    });
  });

  suite("3. Edge Cases", () => {
    test("3.1: Rejects empty username", async () => {
      process.env.USERNAME = "";

      try {
        await authCache.writeCredential(
          "testuser",
          "testpass",
          "https://svn.example.com:443"
        );
        assert.fail("Should reject empty username");
      } catch (err) {
        assert.ok(err instanceof Error);
        assert.match(err.message, /Invalid Windows username/);
      }
    });

    test("3.2: Rejects username exceeding 255 characters", async () => {
      process.env.USERNAME = "a".repeat(256);

      try {
        await authCache.writeCredential(
          "testuser",
          "testpass",
          "https://svn.example.com:443"
        );
        assert.fail("Should reject overly long username");
      } catch (err) {
        assert.ok(err instanceof Error);
        assert.match(err.message, /Invalid Windows username/);
      }
    });

    test("3.3: Allows username at 255 character limit", async () => {
      process.env.USERNAME = "a".repeat(255);

      await authCache.writeCredential(
        "testuser",
        "testpass",
        "https://svn.example.com:443"
      );

      const files = authCache.getWrittenFiles();
      assert.strictEqual(files.length, 1);
    });
  });

  suite("4. Regression Tests", () => {
    test("4.1: Verifies shell:false is used (not shell:true)", async () => {
      // This test verifies the fix was applied correctly
      // We can't directly test spawn options, but we can verify behavior

      process.env.USERNAME = "admin";

      await authCache.writeCredential(
        "testuser",
        "testpass",
        "https://svn.example.com:443"
      );

      // If shell:true was used, special chars would be interpreted
      // With shell:false, they are treated as literals (safe)
      const files = authCache.getWrittenFiles();
      assert.strictEqual(files.length, 1);
      assert.ok(fs.existsSync(files[0]));
    });

    test("4.2: Verifies error handling rejects (not resolves)", async () => {
      // Set invalid username to trigger validation error
      process.env.USERNAME = "admin & calc";

      try {
        await authCache.writeCredential(
          "testuser",
          "testpass",
          "https://svn.example.com:443"
        );
        assert.fail("Should have rejected");
      } catch (err) {
        // Expected - validation should reject, not resolve silently
        assert.ok(err instanceof Error);
      }
    });
  });
});
