import { describe, it, expect } from "vitest";

/**
 * Cleanup Error Detection Tests
 *
 * Tests error patterns that should suggest running SVN cleanup.
 * Error codes: E155004, E155009, E155016, E155032, E155037, E200030, E200033, E200034
 */

/**
 * Detect if an error message indicates cleanup is needed.
 * This mirrors the logic in command.ts needsCleanup()
 */
function needsCleanup(errorMessage: string): boolean {
  const fullError = errorMessage.toLowerCase();
  return (
    fullError.includes("e155004") ||
    fullError.includes("e155009") ||
    fullError.includes("e155016") ||
    fullError.includes("e155032") ||
    fullError.includes("e155037") ||
    fullError.includes("e200030") ||
    fullError.includes("e200033") ||
    fullError.includes("e200034") ||
    /\blocked\b/.test(fullError) ||
    fullError.includes("previous operation") ||
    fullError.includes("run 'cleanup'") ||
    fullError.includes("work queue") ||
    fullError.includes("is corrupt") ||
    /sqlite[:\[]/.test(fullError)
  );
}

describe("Cleanup Error Detection", () => {
  describe("Error Code Detection", () => {
    it("detects E155004 (working copy locked)", () => {
      const error = "svn: E155004: Working copy is locked";
      expect(needsCleanup(error)).toBe(true);
    });

    it("detects E155037 (previous operation interrupted)", () => {
      const error =
        "svn: E155037: Previous operation has not finished; run 'cleanup' if it was interrupted";
      expect(needsCleanup(error)).toBe(true);
    });

    it("detects E200030 (sqlite database issue)", () => {
      const error = "svn: E200030: sqlite: database is locked";
      expect(needsCleanup(error)).toBe(true);
    });

    it("detects E155032 (working copy database problem)", () => {
      const error = "svn: E155032: The working copy database is corrupted";
      expect(needsCleanup(error)).toBe(true);
    });

    it("detects E155009 (failed to run WC DB work queue)", () => {
      const error =
        "svn: E155009: Failed to run the WC DB work queue associated with '/path'";
      expect(needsCleanup(error)).toBe(true);
    });

    it("detects E200033 (sqlite database busy)", () => {
      const error = "svn: E200033: sqlite[S5]: database is busy";
      expect(needsCleanup(error)).toBe(true);
    });

    it("detects E155016 (working copy corrupt)", () => {
      const error = "svn: E155016: Working copy is corrupt";
      expect(needsCleanup(error)).toBe(true);
    });

    it("detects E200034 (sqlite rollback reset)", () => {
      const error =
        "svn: E200034: SQLite busy at transaction rollback; resetting all statements";
      expect(needsCleanup(error)).toBe(true);
    });
  });

  describe("Text Pattern Detection", () => {
    it("detects 'locked' text", () => {
      expect(needsCleanup("The working copy is locked")).toBe(true);
    });

    it("detects 'previous operation' text", () => {
      expect(needsCleanup("Previous operation has not finished")).toBe(true);
    });

    it("detects 'run cleanup' instruction", () => {
      expect(needsCleanup("run 'cleanup' if it was interrupted")).toBe(true);
    });

    it("detects 'sqlite:' errors", () => {
      expect(needsCleanup("sqlite: database is locked")).toBe(true);
    });

    it("detects 'sqlite[S5]' errors", () => {
      expect(needsCleanup("sqlite[S5]: database is locked")).toBe(true);
    });

    it("detects 'work queue' text", () => {
      expect(needsCleanup("Failed to run the WC DB work queue")).toBe(true);
    });

    it("detects 'is corrupt' text", () => {
      expect(needsCleanup("Working copy is corrupt")).toBe(true);
    });

    it("is case-insensitive", () => {
      expect(needsCleanup("SVN: E155004: LOCKED")).toBe(true);
      expect(needsCleanup("SQLITE: DATABASE LOCKED")).toBe(true);
    });
  });

  describe("Non-Cleanup Errors", () => {
    it("does not flag auth errors as cleanup", () => {
      expect(needsCleanup("svn: E170001: Authorization failed")).toBe(false);
    });

    it("does not flag network errors as cleanup", () => {
      expect(needsCleanup("svn: E170013: Unable to connect")).toBe(false);
    });

    it("does not flag conflict errors as cleanup", () => {
      expect(needsCleanup("svn: E155015: Remains in conflict")).toBe(false);
    });

    it("does not flag random errors as cleanup", () => {
      expect(needsCleanup("File not found")).toBe(false);
    });

    it("does not flag 'unlocked' as cleanup (false positive)", () => {
      expect(needsCleanup("'file.txt' unlocked.")).toBe(false);
    });

    it("does not flag successful unlock operation", () => {
      expect(needsCleanup("Unlocked file successfully")).toBe(false);
    });

    it("does not flag 'sqlite' in file paths (false positive)", () => {
      expect(needsCleanup("Error in /path/to/sqlite_backup/")).toBe(false);
    });

    it("does not flag 'sqlite' as substring", () => {
      expect(needsCleanup("mysqlite.db not found")).toBe(false);
    });
  });
});
