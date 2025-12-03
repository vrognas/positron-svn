import { describe, it, expect } from "vitest";

/**
 * Tests for SVN peg revision handling.
 * Issue: Double-@ bug when path with embedded peg revision passed to log method.
 *
 * Root cause: repoLogProvider manually constructed `path@revision` and passed to
 * log method, which then called fixPegRevision() and added another @ because
 * it detected the existing @.
 *
 * Fix: Add pegRevision parameter to log/logBatch methods so peg revision is
 * passed separately and constructed correctly after path escaping.
 */

// Simulate fixPegRevision behavior
function fixPegRevision(file: string): string {
  if (/@/.test(file)) {
    file += "@";
  }
  return file;
}

// Simulate old (buggy) log path construction
function buildLogPathOld(path: string, pegRevision: string): string {
  // Old approach: caller embeds peg revision, then fixPegRevision escapes it
  const pathWithPeg = `${path}@${pegRevision}`;
  return fixPegRevision(pathWithPeg);
}

// Simulate new (fixed) log path construction
function buildLogPathNew(path: string, pegRevision?: string): string {
  // New approach: escape path first, then add peg revision
  let targetPath = fixPegRevision(path);
  if (pegRevision) {
    targetPath += "@" + pegRevision;
  }
  return targetPath;
}

describe("Peg Revision Path Construction", () => {
  describe("Old (buggy) behavior", () => {
    it("double escapes paths with embedded peg revision", () => {
      // Normal file at revision 1454
      const path = "svn://server/repo/trunk/report.pdf";
      const result = buildLogPathOld(path, "1454");

      // BUG: path@1454 gets escaped to path@1454@ (trailing @ indicates empty peg)
      expect(result).toBe("svn://server/repo/trunk/report.pdf@1454@");
      // This tells SVN: look at file named "report.pdf@1454" at HEAD revision
      // But we wanted: look at file "report.pdf" at revision 1454
    });

    it("triple escapes files with @ in name and peg revision", () => {
      // File named "data@2024.csv" at revision 1454
      const path = "svn://server/repo/trunk/data@2024.csv";
      const result = buildLogPathOld(path, "1454");

      // BUG: path@2024.csv@1454 gets escaped to path@2024.csv@1454@
      expect(result).toBe("svn://server/repo/trunk/data@2024.csv@1454@");
    });
  });

  describe("New (fixed) behavior", () => {
    it("correctly constructs peg revision path for normal files", () => {
      const path = "svn://server/repo/trunk/report.pdf";
      const result = buildLogPathNew(path, "1454");

      // Correct: no @ in original path, so no escaping needed, just add peg
      expect(result).toBe("svn://server/repo/trunk/report.pdf@1454");
    });

    it("correctly constructs peg revision path for files with @ in name", () => {
      const path = "svn://server/repo/trunk/data@2024.csv";
      const result = buildLogPathNew(path, "1454");

      // Correct: escape the @ in filename first, then add peg revision
      // data@2024.csv@ (escaped) + @1454 (peg) = data@2024.csv@@1454
      expect(result).toBe("svn://server/repo/trunk/data@2024.csv@@1454");
    });

    it("handles HEAD revision correctly", () => {
      const path = "svn://server/repo/trunk/report.pdf";
      const result = buildLogPathNew(path, undefined);

      // No peg revision, just the path
      expect(result).toBe("svn://server/repo/trunk/report.pdf");
    });

    it("handles path without peg revision that contains @", () => {
      const path = "svn://server/repo/trunk/data@2024.csv";
      const result = buildLogPathNew(path, undefined);

      // Escape the @ in filename to indicate it's part of the name
      expect(result).toBe("svn://server/repo/trunk/data@2024.csv@");
    });
  });

  describe("Edge cases", () => {
    it("handles multiple @ in filename", () => {
      const path = "svn://server/repo/trunk/file@v1@final.txt";
      const result = buildLogPathNew(path, "100");

      // Multiple @ get escaped, then peg revision added
      expect(result).toBe("svn://server/repo/trunk/file@v1@final.txt@@100");
    });

    it("handles empty peg revision string", () => {
      const path = "svn://server/repo/trunk/report.pdf";
      const result = buildLogPathNew(path, "");

      // Empty string peg revision should not add @
      expect(result).toBe("svn://server/repo/trunk/report.pdf");
    });
  });
});
