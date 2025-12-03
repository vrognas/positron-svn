import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  StagingService,
  STAGING_CHANGELIST
} from "../../../src/services/stagingService";
import { Uri } from "vscode";

// Mock vscode
vi.mock("vscode", () => ({
  Uri: {
    file: (path: string) => ({ fsPath: path, toString: () => path })
  }
}));

describe("StagingService", () => {
  let service: StagingService;

  beforeEach(() => {
    service = new StagingService();
  });

  describe("STAGING_CHANGELIST constant", () => {
    it("has correct value", () => {
      expect(STAGING_CHANGELIST).toBe("__staged__");
    });
  });

  describe("syncFromChangelist", () => {
    it("syncs paths from changelist", () => {
      service.syncFromChangelist(["/repo/a.txt", "/repo/b.txt"]);
      expect(service.stagedCount).toBe(2);
      expect(service.isStaged("/repo/a.txt")).toBe(true);
      expect(service.isStaged("/repo/b.txt")).toBe(true);
    });

    it("clears previous staged paths on sync", () => {
      service.syncFromChangelist(["/repo/old.txt"]);
      service.syncFromChangelist(["/repo/new.txt"]);
      expect(service.stagedCount).toBe(1);
      expect(service.isStaged("/repo/old.txt")).toBe(false);
      expect(service.isStaged("/repo/new.txt")).toBe(true);
    });

    it("handles empty array", () => {
      service.syncFromChangelist(["/repo/file.txt"]);
      service.syncFromChangelist([]);
      expect(service.stagedCount).toBe(0);
    });
  });

  describe("isStaged", () => {
    beforeEach(() => {
      service.syncFromChangelist(["/repo/file.txt"]);
    });

    it("checks staging by path string", () => {
      expect(service.isStaged("/repo/file.txt")).toBe(true);
      expect(service.isStaged("/repo/other.txt")).toBe(false);
    });

    it("checks staging by Uri", () => {
      const stagedUri = Uri.file("/repo/file.txt");
      const unstagedUri = Uri.file("/repo/other.txt");
      expect(service.isStaged(stagedUri)).toBe(true);
      expect(service.isStaged(unstagedUri)).toBe(false);
    });
  });

  describe("getStagedPaths", () => {
    it("returns all staged paths", () => {
      service.syncFromChangelist(["/repo/a.txt", "/repo/b.txt"]);
      const paths = service.getStagedPaths();
      expect(paths).toHaveLength(2);
      expect(paths).toContain("/repo/a.txt");
      expect(paths).toContain("/repo/b.txt");
    });

    it("returns empty array when nothing staged", () => {
      expect(service.getStagedPaths()).toHaveLength(0);
    });
  });

  describe("stagedCount", () => {
    it("returns correct count", () => {
      expect(service.stagedCount).toBe(0);
      service.syncFromChangelist(["/repo/a.txt"]);
      expect(service.stagedCount).toBe(1);
      service.syncFromChangelist(["/repo/a.txt", "/repo/b.txt", "/repo/c.txt"]);
      expect(service.stagedCount).toBe(3);
    });
  });

  describe("path normalization", () => {
    it("normalizes backslashes to forward slashes", () => {
      service.syncFromChangelist(["C:\\repo\\file.txt"]);
      expect(service.isStaged("C:/repo/file.txt")).toBe(true);
    });
  });

  describe("dispose", () => {
    it("clears staged paths on dispose", () => {
      service.syncFromChangelist(["/repo/file.txt"]);
      service.dispose();
      expect(service.stagedCount).toBe(0);
    });
  });
});
