// Integration test for svn:needs-lock property behavior
// Requires svn CLI and a test SVN repository

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import { execSync } from "child_process";
import { tmpdir } from "os";

/**
 * Execute svn command and return stdout
 */
function svn(args: string, cwd: string): string {
  return execSync(`svn ${args}`, { cwd, encoding: "utf8" });
}

/**
 * Check if file is read-only on Windows
 */
async function isReadOnly(filePath: string): Promise<boolean> {
  const stats = await fs.stat(filePath);
  // On Windows, check the mode (readonly = no write permission)
  // 0o200 = owner write permission
  return (stats.mode & 0o200) === 0;
}

describe("Integration: svn:needs-lock", () => {
  let testDir: string;
  let repoDir: string;
  let wcDir: string;
  let testFile: string;
  let skipTests = false;

  beforeAll(async () => {
    // Skip if svn not available
    try {
      execSync("svn --version", { encoding: "utf8" });
    } catch {
      skipTests = true;
      return;
    }

    // Create temp directory structure
    testDir = path.join(tmpdir(), `svn-needs-lock-test-${Date.now()}`);
    repoDir = path.join(testDir, "repo");
    wcDir = path.join(testDir, "wc");

    await fs.mkdir(testDir, { recursive: true });

    // Create SVN repository
    execSync(`svnadmin create "${repoDir}"`, { encoding: "utf8" });

    // Checkout working copy
    const repoUrl = `file:///${repoDir.replace(/\\/g, "/")}`;
    execSync(`svn checkout "${repoUrl}" "${wcDir}"`, { encoding: "utf8" });

    // Create test file
    testFile = path.join(wcDir, "testfile.txt");
    await fs.writeFile(testFile, "test content");
    svn(`add "${testFile}"`, wcDir);
    svn(`commit -m "Add test file"`, wcDir);

    // Set svn:needs-lock property and commit
    svn(`propset svn:needs-lock "*" "${testFile}"`, wcDir);
    svn(`commit -m "Set needs-lock"`, wcDir);

    // Update to apply the property (makes file read-only)
    svn("update", wcDir);
  }, 30000);

  afterAll(async () => {
    if (testDir) {
      try {
        await fs.rm(testDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  it("File with needs-lock is read-only when not locked", async () => {
    if (skipTests) {
      return;
    }
    // After setting needs-lock and updating, file should be read-only
    const readOnly = await isReadOnly(testFile);
    expect(readOnly).toBe(true);
  });

  it("File becomes writable after lock", async () => {
    if (skipTests) {
      return;
    }
    // Lock the file
    svn(`lock -m "test lock" "${testFile}"`, wcDir);

    // File should now be writable
    const readOnly = await isReadOnly(testFile);
    expect(readOnly).toBe(false);
  });

  it("File returns to read-only after unlock", async () => {
    if (skipTests) {
      return;
    }
    // Unlock the file
    svn(`unlock "${testFile}"`, wcDir);

    // File should be read-only again
    const readOnly = await isReadOnly(testFile);
    expect(readOnly).toBe(true);
  });
});
