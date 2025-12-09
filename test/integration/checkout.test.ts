// Integration test for svn checkout operations
// Requires svn CLI

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import { execSync } from "child_process";
import { tmpdir } from "os";

function svn(args: string, cwd?: string): string {
  return execSync(`svn ${args}`, { cwd, encoding: "utf8" });
}

function svnadmin(args: string): string {
  return execSync(`svnadmin ${args}`, { encoding: "utf8" });
}

describe("Integration: svn checkout", () => {
  let testDir: string;
  let repoDir: string;
  let repoUrl: string;
  let skipTests = false;

  beforeAll(async () => {
    // Skip if svn not available
    try {
      execSync("svn --version", { encoding: "utf8" });
    } catch {
      skipTests = true;
      return;
    }

    // Create temp directory and repo
    testDir = path.join(tmpdir(), `svn-checkout-test-${Date.now()}`);
    repoDir = path.join(testDir, "repo");
    await fs.mkdir(testDir, { recursive: true });

    // Create SVN repository with initial content
    svnadmin(`create "${repoDir}"`);
    repoUrl = `file:///${repoDir.replace(/\\/g, "/")}`;

    // Create initial content via import
    const importDir = path.join(testDir, "import");
    await fs.mkdir(importDir);
    await fs.writeFile(path.join(importDir, "README.txt"), "Hello World");
    await fs.mkdir(path.join(importDir, "src"));
    await fs.writeFile(
      path.join(importDir, "src", "main.ts"),
      "console.log('main');"
    );

    svn(`import "${importDir}" "${repoUrl}" -m "Initial import"`);
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

  it("checks out repository to new directory", async () => {
    if (skipTests) return;

    const wcDir = path.join(testDir, "wc1");
    svn(`checkout "${repoUrl}" "${wcDir}"`);

    // Verify .svn exists
    const svnDir = await fs.stat(path.join(wcDir, ".svn"));
    expect(svnDir.isDirectory()).toBe(true);

    // Verify files exist
    const readme = await fs.readFile(path.join(wcDir, "README.txt"), "utf8");
    expect(readme).toBe("Hello World");
  });

  it("checks out specific revision", async () => {
    if (skipTests) return;

    // First, make a second commit
    const wcDir = path.join(testDir, "wc-rev");
    svn(`checkout "${repoUrl}" "${wcDir}"`);
    await fs.writeFile(path.join(wcDir, "README.txt"), "Updated content");
    svn(`commit -m "Update readme"`, wcDir);

    // Checkout at revision 1 (initial import)
    const wcOld = path.join(testDir, "wc-r1");
    svn(`checkout -r 1 "${repoUrl}" "${wcOld}"`);

    const readme = await fs.readFile(path.join(wcOld, "README.txt"), "utf8");
    expect(readme).toBe("Hello World");
  });

  it("checks out with depth=empty for sparse checkout", async () => {
    if (skipTests) return;

    const wcSparse = path.join(testDir, "wc-sparse");
    svn(`checkout --depth=empty "${repoUrl}" "${wcSparse}"`);

    // Should have .svn but no files
    const entries = await fs.readdir(wcSparse);
    expect(entries).toContain(".svn");
    expect(entries).not.toContain("README.txt");
    expect(entries).not.toContain("src");
  });
});
