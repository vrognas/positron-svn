// Integration test for svn update with local modifications
// Requires svn CLI

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import { execSync, spawnSync } from "child_process";
import { tmpdir } from "os";

function svn(args: string, cwd?: string): string {
  return execSync(`svn ${args}`, { cwd, encoding: "utf8" });
}

function svnMayFail(
  args: string,
  cwd?: string
): { stdout: string; stderr: string; status: number } {
  const result = spawnSync("svn", args.split(" "), { cwd, encoding: "utf8" });
  return {
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    status: result.status || 0
  };
}

function svnadmin(args: string): string {
  return execSync(`svnadmin ${args}`, { encoding: "utf8" });
}

describe("Integration: svn update conflicts", () => {
  let testDir: string;
  let repoDir: string;
  let repoUrl: string;
  let wc1: string;
  let wc2: string;
  let skipTests = false;

  beforeAll(async () => {
    // Skip if svn not available
    try {
      execSync("svn --version", { encoding: "utf8" });
    } catch {
      skipTests = true;
      return;
    }

    // Setup: two working copies, make conflicting changes
    testDir = path.join(tmpdir(), `svn-update-test-${Date.now()}`);
    repoDir = path.join(testDir, "repo");
    await fs.mkdir(testDir, { recursive: true });

    svnadmin(`create "${repoDir}"`);
    repoUrl = `file:///${repoDir.replace(/\\/g, "/")}`;

    // Import initial content
    const importDir = path.join(testDir, "import");
    await fs.mkdir(importDir);
    await fs.writeFile(
      path.join(importDir, "data.txt"),
      "original line 1\noriginal line 2\n"
    );
    svn(`import "${importDir}" "${repoUrl}" -m "Initial"`);

    // Create two working copies
    wc1 = path.join(testDir, "wc1");
    wc2 = path.join(testDir, "wc2");
    svn(`checkout "${repoUrl}" "${wc1}"`);
    svn(`checkout "${repoUrl}" "${wc2}"`);
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

  it("update with no local changes succeeds cleanly", async () => {
    if (skipTests) return;

    // Commit from wc1
    await fs.writeFile(
      path.join(wc1, "data.txt"),
      "updated line 1\noriginal line 2\n"
    );
    svn(`commit -m "Update from wc1"`, wc1);

    // Update wc2 - should succeed cleanly
    const output = svn("update", wc2);
    expect(output).toContain("Updated");

    const content = await fs.readFile(path.join(wc2, "data.txt"), "utf8");
    expect(content).toBe("updated line 1\noriginal line 2\n");
  });

  it("update with conflicting local change creates conflict", async () => {
    if (skipTests) return;

    // Make a change in wc1 and commit
    await fs.writeFile(
      path.join(wc1, "data.txt"),
      "wc1 change\noriginal line 2\n"
    );
    svn(`commit -m "wc1 change"`, wc1);

    // Make conflicting change in wc2 (same line)
    await fs.writeFile(
      path.join(wc2, "data.txt"),
      "wc2 local change\noriginal line 2\n"
    );

    // Update wc2 - should create conflict
    svnMayFail("update --accept=postpone", wc2);

    const status = svn("status", wc2);
    expect(status).toMatch(/^C/m); // C = conflicted
  });

  it("cleanup after conflict allows fresh start", async () => {
    if (skipTests) return;

    // Revert to clear conflict
    svn("revert -R .", wc2);
    svn("update", wc2);

    // Status should be clean
    const status = svn("status", wc2);
    expect(status.trim()).toBe("");
  });
});
