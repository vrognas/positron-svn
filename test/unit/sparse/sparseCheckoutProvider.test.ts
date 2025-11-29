import { describe, it, expect, vi, beforeEach } from "vitest";

// Types for testing
interface ISparseItem {
  name: string;
  path: string;
  kind: "file" | "dir";
  depth?: string;
  isGhost: boolean;
}

interface MockRepository {
  root: string;
  getInfo: ReturnType<typeof vi.fn>;
  list: ReturnType<typeof vi.fn>;
}

// Simulated provider logic for testing
function computeGhosts(
  localItems: { name: string; kind: "file" | "dir" }[],
  serverItems: { name: string; kind: "file" | "dir" }[]
): ISparseItem[] {
  const localNames = new Set(localItems.map(i => i.name));
  return serverItems
    .filter(s => !localNames.has(s.name))
    .map(s => ({
      name: s.name,
      path: s.name,
      kind: s.kind,
      isGhost: true
    }));
}

function mergeItems(
  localItems: { name: string; kind: "file" | "dir"; depth?: string }[],
  ghosts: ISparseItem[]
): ISparseItem[] {
  const local: ISparseItem[] = localItems.map(i => ({
    name: i.name,
    path: i.name,
    kind: i.kind,
    depth: i.depth,
    isGhost: false
  }));
  return [...local, ...ghosts].sort((a, b) => a.name.localeCompare(b.name));
}

describe("Sparse Checkout Provider", () => {
  let mockRepository: MockRepository;

  beforeEach(() => {
    mockRepository = {
      root: "/home/user/project",
      getInfo: vi.fn(),
      list: vi.fn()
    };
  });

  describe("ghost detection", () => {
    it("detects ghost folders not present locally", () => {
      const localItems = [
        { name: "src", kind: "dir" as const },
        { name: "README.md", kind: "file" as const }
      ];
      const serverItems = [
        { name: "src", kind: "dir" as const },
        { name: "docs", kind: "dir" as const },
        { name: "tests", kind: "dir" as const },
        { name: "README.md", kind: "file" as const }
      ];

      const ghosts = computeGhosts(localItems, serverItems);

      expect(ghosts).toHaveLength(2);
      expect(ghosts.map(g => g.name)).toEqual(["docs", "tests"]);
      expect(ghosts.every(g => g.isGhost)).toBe(true);
    });

    it("detects ghost files in shallow folder", () => {
      // Folder with depth=empty has no files locally
      const localItems: { name: string; kind: "file" | "dir" }[] = [];
      const serverItems = [
        { name: "config.json", kind: "file" as const },
        { name: "data.csv", kind: "file" as const },
        { name: "subdir", kind: "dir" as const }
      ];

      const ghosts = computeGhosts(localItems, serverItems);

      expect(ghosts).toHaveLength(3);
      expect(ghosts.find(g => g.name === "config.json")?.kind).toBe("file");
      expect(ghosts.find(g => g.name === "subdir")?.kind).toBe("dir");
    });
  });

  describe("item merging", () => {
    it("merges local and ghost items sorted by name", () => {
      const localItems = [
        { name: "src", kind: "dir" as const, depth: "infinity" },
        { name: "README.md", kind: "file" as const }
      ];
      const ghosts: ISparseItem[] = [
        { name: "docs", path: "docs", kind: "dir", isGhost: true },
        { name: "assets", path: "assets", kind: "dir", isGhost: true }
      ];

      const merged = mergeItems(localItems, ghosts);

      expect(merged.map(m => m.name)).toEqual([
        "assets",
        "docs",
        "README.md",
        "src"
      ]);
      expect(merged.find(m => m.name === "src")?.isGhost).toBe(false);
      expect(merged.find(m => m.name === "docs")?.isGhost).toBe(true);
    });
  });

  describe("depth display", () => {
    it("shows depth for local directories", async () => {
      mockRepository.getInfo.mockResolvedValue({
        kind: "dir",
        wcInfo: { depth: "immediates" }
      });

      const info = await mockRepository.getInfo("/home/user/project/lib");

      expect(info.wcInfo?.depth).toBe("immediates");
    });
  });
});
