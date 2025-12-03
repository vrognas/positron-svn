import { describe, it, expect, vi, beforeEach } from "vitest";
import { StagingService } from "../../../src/services/stagingService";
import { Uri } from "vscode";

// Mock vscode
vi.mock("vscode", () => ({
  Uri: {
    file: (path: string) => ({ fsPath: path, toString: () => path })
  },
  EventEmitter: class {
    event = vi.fn();
    fire = vi.fn();
    dispose = vi.fn();
  }
}));

describe("StagingService", () => {
  let service: StagingService;
  let mockMemento: {
    get: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockMemento = {
      get: vi.fn().mockReturnValue([]),
      update: vi.fn()
    };
    service = new StagingService("/repo", mockMemento);
  });

  describe("staging files", () => {
    it("stages a file by path", () => {
      service.stage("/repo/file.txt");
      expect(service.isStaged("/repo/file.txt")).toBe(true);
    });

    it("stages a file by Uri", () => {
      const uri = Uri.file("/repo/file.txt");
      service.stage(uri);
      expect(service.isStaged(uri)).toBe(true);
    });

    it("stages multiple files", () => {
      service.stageAll(["/repo/a.txt", "/repo/b.txt"]);
      expect(service.getStagedPaths()).toHaveLength(2);
    });

    it("persists to workspace state", () => {
      service.stage("/repo/file.txt");
      expect(mockMemento.update).toHaveBeenCalled();
    });
  });

  describe("unstaging files", () => {
    it("unstages a file", () => {
      service.stage("/repo/file.txt");
      service.unstage("/repo/file.txt");
      expect(service.isStaged("/repo/file.txt")).toBe(false);
    });

    it("unstages all files", () => {
      service.stageAll(["/repo/a.txt", "/repo/b.txt"]);
      service.unstageAll();
      expect(service.stagedCount).toBe(0);
    });

    it("unstages specific files", () => {
      service.stageAll(["/repo/a.txt", "/repo/b.txt", "/repo/c.txt"]);
      service.unstageAll(["/repo/a.txt", "/repo/b.txt"]);
      expect(service.stagedCount).toBe(1);
      expect(service.isStaged("/repo/c.txt")).toBe(true);
    });
  });

  describe("toggle", () => {
    it("stages unstaged file", () => {
      const result = service.toggle("/repo/file.txt");
      expect(result).toBe(true);
      expect(service.isStaged("/repo/file.txt")).toBe(true);
    });

    it("unstages staged file", () => {
      service.stage("/repo/file.txt");
      const result = service.toggle("/repo/file.txt");
      expect(result).toBe(false);
      expect(service.isStaged("/repo/file.txt")).toBe(false);
    });
  });

  describe("cleanup", () => {
    it("removes stale paths not in valid set", () => {
      service.stageAll(["/repo/a.txt", "/repo/deleted.txt"]);
      const validPaths = new Set(["/repo/a.txt"]);
      service.cleanupStalePaths(validPaths);
      expect(service.stagedCount).toBe(1);
      expect(service.isStaged("/repo/deleted.txt")).toBe(false);
    });

    it("clears all staged files", () => {
      service.stageAll(["/repo/a.txt", "/repo/b.txt"]);
      service.clear();
      expect(service.stagedCount).toBe(0);
    });
  });

  describe("path normalization", () => {
    it("normalizes backslashes to forward slashes", () => {
      service.stage("C:\\repo\\file.txt");
      expect(service.isStaged("C:/repo/file.txt")).toBe(true);
    });
  });

  describe("persistence", () => {
    it("restores staged files from workspace state", () => {
      mockMemento.get.mockReturnValue(["/repo/saved.txt"]);
      const restored = new StagingService("/repo", mockMemento);
      expect(restored.isStaged("/repo/saved.txt")).toBe(true);
    });
  });
});
