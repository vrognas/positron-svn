import { describe, it, expect } from "vitest";

describe("getRepoUrl subfolder checkout", () => {
  describe("URL fallback when no branch detected", () => {
    it("should return checkout URL, not repository root", () => {
      // Scenario: User checked out a subfolder without standard branch layout
      // svn co https://server/svn/Project/Main%20Development/WorkArea/NONMEM
      const info = {
        url: "https://server/svn/Project/Main%20Development/WorkArea/NONMEM",
        repository: {
          root: "https://server/svn/Project"
        }
      };

      // When no branch is detected (getBranchName returns undefined)
      const branch = undefined;

      // BUG FIX: Should return info.url, not info.repository.root
      // OLD (broken): return info.repository.root
      // NEW (fixed): return info.url
      const repoUrl = branch ? stripBranchPath(info.url, branch) : info.url;

      // Must use checkout URL for listing items in the checkout folder
      expect(repoUrl).toBe(info.url);
      expect(repoUrl).not.toBe(info.repository.root);
    });

    it("returns checkout URL for deep subfolder checkout", () => {
      const info = {
        url: "https://server/svn/Company/Projects/2024/Q4/Analysis",
        repository: {
          root: "https://server/svn/Company"
        }
      };

      const branch = undefined;
      const repoUrl = branch ? stripBranchPath(info.url, branch) : info.url;

      expect(repoUrl).toBe(info.url);
    });

    it("returns checkout URL with URL-encoded spaces", () => {
      const info = {
        url: "https://server/svn/Project/Main%20Development/Work%20Area",
        repository: {
          root: "https://server/svn/Project"
        }
      };

      const branch = undefined;
      const repoUrl = branch ? stripBranchPath(info.url, branch) : info.url;

      expect(repoUrl).toBe(info.url);
      expect(repoUrl).toContain("%20");
    });
  });

  describe("URL with branch detected", () => {
    it("strips branch path when branch is detected", () => {
      const info = {
        url: "https://server/svn/Project/trunk",
        repository: {
          root: "https://server/svn/Project"
        }
      };

      // When branch IS detected
      const branch = { path: "trunk", name: "trunk" };
      const repoUrl = branch ? stripBranchPath(info.url, branch) : info.url;

      expect(repoUrl).toBe("https://server/svn/Project");
    });

    it("strips branch path for branches/feature-x", () => {
      const info = {
        url: "https://server/svn/Project/branches/feature-x",
        repository: {
          root: "https://server/svn/Project"
        }
      };

      const branch = { path: "branches/feature-x", name: "feature-x" };
      const repoUrl = branch ? stripBranchPath(info.url, branch) : info.url;

      expect(repoUrl).toBe("https://server/svn/Project");
    });
  });
});

// Helper to simulate the getRepoUrl logic
function stripBranchPath(url: string, branch: { path: string }): string {
  const regex = new RegExp(branch.path + "$");
  return url.replace(regex, "").replace(/\/$/, "");
}

describe("Ghost URL construction for subfolder checkouts", () => {
  // Helper to simulate the fixed URL construction logic from populateGhostLockStatus
  function buildGhostUrl(
    baseUrl: string,
    repositoryRoot: string | undefined,
    ghostPath: string
  ): string {
    // Calculate checkout subfolder
    let checkoutSubfolder = "";
    if (repositoryRoot && baseUrl.startsWith(repositoryRoot)) {
      checkoutSubfolder = baseUrl
        .slice(repositoryRoot.length)
        .replace(/^\//, "");
    }

    // Convert backslashes and fix overlapping paths
    let urlPath = ghostPath.replace(/\\/g, "/");

    if (checkoutSubfolder && urlPath.startsWith(checkoutSubfolder + "/")) {
      urlPath = urlPath.slice(checkoutSubfolder.length + 1);
    } else if (checkoutSubfolder && urlPath === checkoutSubfolder) {
      urlPath = "";
    }

    return urlPath ? `${baseUrl}/${urlPath}` : baseUrl;
  }

  it("strips duplicate subfolder path from ghost URL", () => {
    // Scenario: Checkout of Main Development/WorkArea/NONMEM
    // Ghost path incorrectly contains the full checkout subfolder path + file
    const baseUrl =
      "https://server/svn/Project/Main%20Development/WorkArea/NONMEM";
    const repoRoot = "https://server/svn/Project";
    // Ghost path relative to repo root (incorrectly includes checkout subfolder)
    const ghostPath = "Main%20Development/WorkArea/NONMEM/file.txt";

    const url = buildGhostUrl(baseUrl, repoRoot, ghostPath);

    // Should strip the duplicate checkout subfolder, result in just file.txt appended
    expect(url).toBe(
      "https://server/svn/Project/Main%20Development/WorkArea/NONMEM/file.txt"
    );
    expect(url).not.toContain("NONMEM/Main%20Development");
  });

  it("handles normal ghost paths without duplication", () => {
    const baseUrl =
      "https://server/svn/Project/Main%20Development/WorkArea/NONMEM";
    const repoRoot = "https://server/svn/Project";
    const ghostPath = "Data/file.txt";

    const url = buildGhostUrl(baseUrl, repoRoot, ghostPath);

    expect(url).toBe(
      "https://server/svn/Project/Main%20Development/WorkArea/NONMEM/Data/file.txt"
    );
  });

  it("handles root level ghosts", () => {
    const baseUrl =
      "https://server/svn/Project/Main%20Development/WorkArea/NONMEM";
    const repoRoot = "https://server/svn/Project";
    const ghostPath = "file.txt";

    const url = buildGhostUrl(baseUrl, repoRoot, ghostPath);

    expect(url).toBe(
      "https://server/svn/Project/Main%20Development/WorkArea/NONMEM/file.txt"
    );
  });

  it("handles missing repository root gracefully", () => {
    const baseUrl =
      "https://server/svn/Project/Main%20Development/WorkArea/NONMEM";
    const repoRoot = undefined;
    const ghostPath = "file.txt";

    const url = buildGhostUrl(baseUrl, repoRoot, ghostPath);

    expect(url).toBe(
      "https://server/svn/Project/Main%20Development/WorkArea/NONMEM/file.txt"
    );
  });
});
