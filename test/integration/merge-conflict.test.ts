// Integration test for svn merge with conflicts
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

describe("Integration: svn merge conflicts", () => {
  let testDir: string;
  let repoDir: string;
  let repoUrl: string;
  let wcTrunk: string;
  let wcBranch: string;
  let skipTests = false;

  beforeAll(async () => {
    // Skip if svn not available
    try {
      execSync("svn --version", { encoding: "utf8" });
    } catch {
      skipTests = true;
      return;
    }

    // Setup: repo with trunk and branch that have conflicting changes
    testDir = path.join(tmpdir(), `svn-merge-test-${Date.now()}`);
    repoDir = path.join(testDir, "repo");
    await fs.mkdir(testDir, { recursive: true });

    svnadmin(`create "${repoDir}"`);
    repoUrl = `file:///${repoDir.replace(/\\/g, "/")}`;

    // Create trunk with initial file
    const importDir = path.join(testDir, "import");
    await fs.mkdir(path.join(importDir, "trunk"), { recursive: true });
    await fs.mkdir(path.join(importDir, "branches"), { recursive: true });
    await fs.writeFile(
      path.join(importDir, "trunk", "file.txt"),
      "line 1\nline 2\nline 3\n"
    );
    svn(`import "${importDir}" "${repoUrl}" -m "Initial structure"`);

    // Checkout trunk
    wcTrunk = path.join(testDir, "wc-trunk");
    svn(`checkout "${repoUrl}/trunk" "${wcTrunk}"`);

    // Create branch from trunk
    svn(
      `copy "${repoUrl}/trunk" "${repoUrl}/branches/feature" -m "Create branch"`
    );

    // Checkout branch
    wcBranch = path.join(testDir, "wc-branch");
    svn(`checkout "${repoUrl}/branches/feature" "${wcBranch}"`);

    // Make conflicting changes: trunk changes line 2
    await fs.writeFile(
      path.join(wcTrunk, "file.txt"),
      "line 1\ntrunk change\nline 3\n"
    );
    svn(`commit -m "Trunk: modify line 2"`, wcTrunk);

    // Branch also changes line 2 differently
    await fs.writeFile(
      path.join(wcBranch, "file.txt"),
      "line 1\nbranch change\nline 3\n"
    );
    svn(`commit -m "Branch: modify line 2"`, wcBranch);
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

  it("merge creates conflict when same line modified", async () => {
    if (skipTests) return;

    // Update trunk to get latest
    svn("update", wcTrunk);

    // Try to merge branch into trunk - should create conflict
    svnMayFail(`merge "${repoUrl}/branches/feature"`, wcTrunk);

    // Check status shows conflict
    const status = svn("status", wcTrunk);
    expect(status).toMatch(/^C/m); // C = conflicted
  });

  it("conflict markers appear in file", async () => {
    if (skipTests) return;

    const content = await fs.readFile(path.join(wcTrunk, "file.txt"), "utf8");

    // SVN conflict markers
    expect(content).toContain("<<<<<<<");
    expect(content).toContain("=======");
    expect(content).toContain(">>>>>>>");
  });

  it("resolve --accept=working clears conflict", async () => {
    if (skipTests) return;

    // Manually fix the file
    await fs.writeFile(
      path.join(wcTrunk, "file.txt"),
      "line 1\nresolved change\nline 3\n"
    );

    // Mark as resolved
    svn(`resolve --accept=working "${path.join(wcTrunk, "file.txt")}"`);

    // Status should no longer show conflict
    const status = svn("status", wcTrunk);
    expect(status).not.toMatch(/^C/m);
    expect(status).toMatch(/^M/m); // Modified
  });
});
