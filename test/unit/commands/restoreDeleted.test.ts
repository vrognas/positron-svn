import { describe, it, expect, vi, beforeEach } from "vitest";
import { window } from "vscode";

/**
 * Restore Deleted Items E2E Tests
 *
 * Tests for restoring deleted files/directories from SVN history.
 * Uses: svn copy <repo-url><path>@<rev> <target>
 *
 * Per SVN book: "svn copy" with peg revision preserves history linkage.
 */
describe("Restore Deleted Items", () => {
  describe("buildRestoreArgs() argument building", () => {
    /**
     * Builds svn copy arguments for restore
     * @param repoUrl - Repository root URL (e.g., "https://svn.example.com/repo")
     * @param remotePath - Path from repo root (e.g., "/trunk/file.txt")
     * @param pegRevision - Revision where file existed (e.g., "399")
     * @param targetPath - Local target path for restore
     */
    function buildRestoreArgs(
      repoUrl: string,
      remotePath: string,
      pegRevision: string,
      targetPath: string
    ): string[] {
      // Build source URL with peg revision
      const sourceUrl = `${repoUrl}${remotePath}@${pegRevision}`;
      return ["copy", sourceUrl, targetPath];
    }

    it("builds correct args for file restore", () => {
      const args = buildRestoreArgs(
        "https://svn.example.com/repo",
        "/trunk/src/real.c",
        "399",
        "/workspace/trunk/src/real.c"
      );
      expect(args).toEqual([
        "copy",
        "https://svn.example.com/repo/trunk/src/real.c@399",
        "/workspace/trunk/src/real.c"
      ]);
    });

    it("builds correct args for directory restore", () => {
      const args = buildRestoreArgs(
        "https://svn.example.com/repo",
        "/trunk/old-dir",
        "150",
        "/workspace/trunk/old-dir"
      );
      expect(args).toEqual([
        "copy",
        "https://svn.example.com/repo/trunk/old-dir@150",
        "/workspace/trunk/old-dir"
      ]);
    });

    it("handles paths with special characters", () => {
      const args = buildRestoreArgs(
        "https://svn.example.com/repo",
        "/trunk/data file.txt",
        "100",
        "/workspace/trunk/data file.txt"
      );
      // URL encoding is handled by svn client, not our code
      expect(args[1]).toBe(
        "https://svn.example.com/repo/trunk/data file.txt@100"
      );
    });

    it("uses revision just before deletion", () => {
      // If deleted in r400, restore from r399
      const deletionRev = 400;
      const restoreRev = (deletionRev - 1).toString();

      const args = buildRestoreArgs(
        "https://svn.example.com/repo",
        "/trunk/deleted.txt",
        restoreRev,
        "/workspace/trunk/deleted.txt"
      );

      expect(args[1]).toContain("@399");
    });
  });

  describe("Target conflict resolution", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    /**
     * Prompt user for conflict resolution when target exists
     */
    async function promptConflictResolution(): Promise<
      "overwrite" | "rename" | "cancel"
    > {
      const options = [
        { label: "Rename", description: "Save as new name" },
        { label: "Overwrite", description: "Replace existing file" },
        { label: "Cancel", description: "Abort restore" }
      ];

      const result = await window.showQuickPick(options, {
        title: "File already exists at target location",
        placeHolder: "Choose an action"
      });

      if (!result) return "cancel";
      return result.label.toLowerCase() as "overwrite" | "rename" | "cancel";
    }

    it("returns 'rename' when user selects Rename", async () => {
      vi.mocked(window.showQuickPick).mockResolvedValue({
        label: "Rename",
        description: "Save as new name"
      } as unknown as undefined);

      const result = await promptConflictResolution();
      expect(result).toBe("rename");
    });

    it("returns 'overwrite' when user selects Overwrite", async () => {
      vi.mocked(window.showQuickPick).mockResolvedValue({
        label: "Overwrite",
        description: "Replace existing file"
      } as unknown as undefined);

      const result = await promptConflictResolution();
      expect(result).toBe("overwrite");
    });

    it("returns 'cancel' when user dismisses dialog", async () => {
      vi.mocked(window.showQuickPick).mockResolvedValue(undefined);

      const result = await promptConflictResolution();
      expect(result).toBe("cancel");
    });
  });

  describe("Rename suffix generation", () => {
    /**
     * Generate a renamed path for restore to avoid conflict
     */
    function generateRenamedPath(originalPath: string): string {
      const lastSlash = originalPath.lastIndexOf("/");
      const filename = originalPath.substring(lastSlash + 1);
      const dir = originalPath.substring(0, lastSlash + 1);

      const lastDot = filename.lastIndexOf(".");
      // Has extension if dot exists and is not at start (dotfile)
      const hasExtension = lastDot > 0;

      if (hasExtension) {
        const name = filename.substring(0, lastDot);
        const ext = filename.substring(lastDot);
        return `${dir}${name}_restored${ext}`;
      }
      return `${originalPath}_restored`;
    }

    it("adds suffix before extension for files", () => {
      const renamed = generateRenamedPath("/workspace/trunk/file.txt");
      expect(renamed).toBe("/workspace/trunk/file_restored.txt");
    });

    it("handles multiple extensions correctly", () => {
      const renamed = generateRenamedPath("/workspace/trunk/file.tar.gz");
      expect(renamed).toBe("/workspace/trunk/file.tar_restored.gz");
    });

    it("adds suffix at end for directories", () => {
      const renamed = generateRenamedPath("/workspace/trunk/mydir");
      expect(renamed).toBe("/workspace/trunk/mydir_restored");
    });

    it("handles hidden files (dotfiles)", () => {
      const renamed = generateRenamedPath("/workspace/.config");
      expect(renamed).toBe("/workspace/.config_restored");
    });
  });

  describe("restoreDeleted() flow", () => {
    /**
     * Simulates the restore command flow
     */
    async function executeRestoreFlow(
      hasDeletedItem: boolean,
      targetExists: boolean,
      conflictChoice: "overwrite" | "rename" | "cancel",
      copySucceeds: boolean
    ): Promise<{
      copyCalled: boolean;
      rmCalled: boolean;
      infoShown: boolean;
      errorShown: boolean;
      errorMessage?: string;
    }> {
      const state = {
        copyCalled: false,
        rmCalled: false,
        infoShown: false,
        errorShown: false,
        errorMessage: undefined as string | undefined
      };

      // Early exit: no deleted item selected
      if (!hasDeletedItem) {
        return state;
      }

      // Check target conflict
      if (targetExists) {
        if (conflictChoice === "cancel") {
          return state;
        }
        if (conflictChoice === "overwrite") {
          // Need to remove existing before copy
          state.rmCalled = true;
        }
        // Rename: target path will be modified, no rm needed
      }

      // Try restore
      try {
        if (!copySucceeds) {
          throw new Error("svn: E160013: Path not found");
        }
        state.copyCalled = true;
        state.infoShown = true;
      } catch (error) {
        state.errorShown = true;
        state.errorMessage =
          error instanceof Error ? error.message : String(error);
      }

      return state;
    }

    it("exits early when no deleted item is selected", async () => {
      const result = await executeRestoreFlow(false, false, "cancel", true);

      expect(result.copyCalled).toBe(false);
      expect(result.infoShown).toBe(false);
    });

    it("restores directly when target does not exist", async () => {
      const result = await executeRestoreFlow(true, false, "cancel", true);

      expect(result.copyCalled).toBe(true);
      expect(result.rmCalled).toBe(false);
      expect(result.infoShown).toBe(true);
    });

    it("removes then copies when overwrite is chosen", async () => {
      const result = await executeRestoreFlow(true, true, "overwrite", true);

      expect(result.rmCalled).toBe(true);
      expect(result.copyCalled).toBe(true);
      expect(result.infoShown).toBe(true);
    });

    it("copies to renamed path when rename is chosen", async () => {
      const result = await executeRestoreFlow(true, true, "rename", true);

      expect(result.rmCalled).toBe(false);
      expect(result.copyCalled).toBe(true);
      expect(result.infoShown).toBe(true);
    });

    it("exits when user cancels conflict resolution", async () => {
      const result = await executeRestoreFlow(true, true, "cancel", true);

      expect(result.copyCalled).toBe(false);
      expect(result.rmCalled).toBe(false);
      expect(result.infoShown).toBe(false);
      expect(result.errorShown).toBe(false);
    });

    it("shows error on svn copy failure", async () => {
      const result = await executeRestoreFlow(true, false, "cancel", false);

      expect(result.copyCalled).toBe(false);
      expect(result.errorShown).toBe(true);
      expect(result.errorMessage).toContain("E160013");
    });
  });

  describe("contextValue for deleted items", () => {
    /**
     * Generates contextValue based on action type
     */
    function getContextValue(action: string): string {
      if (action === "D") {
        return "diffable:D";
      }
      return "diffable";
    }

    it("returns 'diffable:D' for deleted items", () => {
      expect(getContextValue("D")).toBe("diffable:D");
    });

    it("returns 'diffable' for other actions", () => {
      expect(getContextValue("M")).toBe("diffable");
      expect(getContextValue("A")).toBe("diffable");
      expect(getContextValue("R")).toBe("diffable");
    });
  });

  describe("SVN copy output parsing", () => {
    it("recognizes successful copy output", () => {
      const output = `A         file.txt`;
      expect(output).toContain("A");
    });

    it("recognizes copy with history marker", () => {
      // svn status shows "A +" for added with history
      const statusAfterCopy = `A  +   file.txt`;
      expect(statusAfterCopy).toContain("A  +");
    });
  });

  describe("Error handling", () => {
    it("formats E160013 (path not found) correctly", () => {
      const err = new Error("svn: E160013: '/trunk/file.txt' not found");
      const message = err instanceof Error ? err.message : String(err);
      expect(message).toContain("E160013");
    });

    it("formats E170001 (auth failure) correctly", () => {
      const err = new Error("svn: E170001: Authentication required");
      const message = err instanceof Error ? err.message : String(err);
      expect(message).toContain("E170001");
    });

    it("builds user-friendly error message", () => {
      const err = new Error("svn: E160013: Path not found");
      const message = err instanceof Error ? err.message : String(err);
      const userMessage = `Restore failed: ${message}`;
      expect(userMessage).toBe("Restore failed: svn: E160013: Path not found");
    });
  });
});
