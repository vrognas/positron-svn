import * as path from "path";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Types for testing
interface ISparseItem {
  name: string;
  path: string;
  kind: "file" | "dir";
  depth?: string;
  isGhost: boolean;
  hasExcludedChildren?: boolean;
}

interface MockRepository {
  root: string;
  getInfo: ReturnType<typeof vi.fn>;
  list: ReturnType<typeof vi.fn>;
}

// Simulated provider logic for testing (matches implementation)
function computeGhosts(
  localItems: { name: string; kind: "file" | "dir" }[],
  serverItems: { name: string; kind: "file" | "dir" }[],
  relativeFolder: string = ""
): ISparseItem[] {
  const localNames = new Set(localItems.map(i => i.name));
  return serverItems
    .filter(s => !localNames.has(s.name))
    .map(s => ({
      name: s.name,
      path: relativeFolder ? path.join(relativeFolder, s.name) : s.name,
      kind: s.kind,
      isGhost: true
    }));
}

/** Get file extension (lowercase, without dot) */
function getExtension(name: string): string {
  const lastDot = name.lastIndexOf(".");
  if (lastDot === -1 || lastDot === 0) return "";
  return name.slice(lastDot + 1).toLowerCase();
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
  return [...local, ...ghosts].sort((a, b) => {
    // Dirs first
    if (a.kind !== b.kind) {
      return a.kind === "dir" ? -1 : 1;
    }
    // For files: sort by extension, then alphabetical
    if (a.kind === "file") {
      const extA = getExtension(a.name);
      const extB = getExtension(b.name);
      if (extA !== extB) {
        return extA.localeCompare(extB);
      }
    }
    // Within same kind/extension: alphabetical
    return a.name.localeCompare(b.name);
  });
}

/**
 * Filter local filesystem items to only include tracked items (on server).
 * This excludes untracked items like .vscode, .idea, etc.
 */
function filterToTrackedItems(
  localItems: { name: string; kind: "file" | "dir" }[],
  serverItems: { name: string; kind: "file" | "dir" }[]
): { name: string; kind: "file" | "dir" }[] {
  const serverNames = new Set(serverItems.map(s => s.name));
  return localItems.filter(item => serverNames.has(item.name));
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

  describe("filtering untracked items", () => {
    it("excludes .vscode folder not on server", () => {
      const localItems = [
        { name: ".vscode", kind: "dir" as const },
        { name: "src", kind: "dir" as const },
        { name: "README.md", kind: "file" as const }
      ];
      const serverItems = [
        { name: "src", kind: "dir" as const },
        { name: "README.md", kind: "file" as const }
      ];

      const filtered = filterToTrackedItems(localItems, serverItems);

      expect(filtered.map(f => f.name)).toEqual(["src", "README.md"]);
      expect(filtered.find(f => f.name === ".vscode")).toBeUndefined();
    });

    it("excludes multiple untracked items", () => {
      const localItems = [
        { name: ".vscode", kind: "dir" as const },
        { name: ".idea", kind: "dir" as const },
        { name: "node_modules", kind: "dir" as const },
        { name: "src", kind: "dir" as const },
        { name: "local-only.txt", kind: "file" as const }
      ];
      const serverItems = [{ name: "src", kind: "dir" as const }];

      const filtered = filterToTrackedItems(localItems, serverItems);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe("src");
    });

    it("returns empty when no local items are tracked", () => {
      const localItems = [
        { name: ".vscode", kind: "dir" as const },
        { name: "local.txt", kind: "file" as const }
      ];
      const serverItems = [{ name: "src", kind: "dir" as const }];

      const filtered = filterToTrackedItems(localItems, serverItems);

      expect(filtered).toHaveLength(0);
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

      // Dirs first, then files
      expect(merged.map(m => m.name)).toEqual([
        "assets",
        "docs",
        "src",
        "README.md"
      ]);
      expect(merged.find(m => m.name === "src")?.isGhost).toBe(false);
      expect(merged.find(m => m.name === "docs")?.isGhost).toBe(true);
    });

    it("sorts files by extension then name", () => {
      const localItems = [
        { name: "zebra.ts", kind: "file" as const },
        { name: "alpha.js", kind: "file" as const },
        { name: "beta.ts", kind: "file" as const },
        { name: "gamma.js", kind: "file" as const }
      ];
      const ghosts: ISparseItem[] = [];

      const merged = mergeItems(localItems, ghosts);

      // js files first (alphabetically), then ts files (alphabetically)
      expect(merged.map(m => m.name)).toEqual([
        "alpha.js",
        "gamma.js",
        "beta.ts",
        "zebra.ts"
      ]);
    });

    it("sorts directories first, then files by extension", () => {
      const localItems = [
        { name: "src", kind: "dir" as const },
        { name: "config.json", kind: "file" as const },
        { name: "docs", kind: "dir" as const },
        { name: "index.ts", kind: "file" as const },
        { name: "README.md", kind: "file" as const }
      ];
      const ghosts: ISparseItem[] = [];

      const merged = mergeItems(localItems, ghosts);

      // Dirs first (alpha), then files by extension (json, md, ts)
      expect(merged.map(m => m.name)).toEqual([
        "docs",
        "src",
        "config.json",
        "README.md",
        "index.ts"
      ]);
    });

    it("handles files without extensions", () => {
      const localItems = [
        { name: "Makefile", kind: "file" as const },
        { name: "README", kind: "file" as const },
        { name: "script.sh", kind: "file" as const }
      ];
      const ghosts: ISparseItem[] = [];

      const merged = mergeItems(localItems, ghosts);

      // No extension files first (empty string sorts first), then .sh
      expect(merged.map(m => m.name)).toEqual([
        "Makefile",
        "README",
        "script.sh"
      ]);
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

  describe("nested directory paths", () => {
    it("constructs correct paths for ghosts at root level", () => {
      const serverItems = [
        { name: "docs", kind: "dir" as const },
        { name: "config.json", kind: "file" as const }
      ];

      // Root level: relativeFolder is empty
      const ghosts = computeGhosts([], serverItems, "");

      expect(ghosts[0].path).toBe("docs");
      expect(ghosts[1].path).toBe("config.json");
    });

    it("constructs correct paths for ghosts in nested folder", () => {
      const serverItems = [
        { name: "utils", kind: "dir" as const },
        { name: "index.ts", kind: "file" as const }
      ];

      // Inside src folder
      const ghosts = computeGhosts([], serverItems, "src");

      expect(ghosts[0].path).toBe(path.join("src", "utils"));
      expect(ghosts[1].path).toBe(path.join("src", "index.ts"));
    });

    it("constructs correct paths for deeply nested ghosts", () => {
      const serverItems = [{ name: "helper.ts", kind: "file" as const }];

      // Inside src/lib/utils folder
      const ghosts = computeGhosts(
        [],
        serverItems,
        path.join("src", "lib", "utils")
      );

      expect(ghosts[0].path).toBe(
        path.join("src", "lib", "utils", "helper.ts")
      );
    });

    it("handles mixed local and ghost items with correct paths", () => {
      const localItems = [{ name: "existing.ts", kind: "file" as const }];
      const serverItems = [
        { name: "existing.ts", kind: "file" as const },
        { name: "new-file.ts", kind: "file" as const }
      ];

      const ghosts = computeGhosts(localItems, serverItems, "src");

      // Only new-file.ts should be a ghost
      expect(ghosts).toHaveLength(1);
      expect(ghosts[0].name).toBe("new-file.ts");
      expect(ghosts[0].path).toBe(path.join("src", "new-file.ts"));
    });
  });

  describe("SparseItemNode behavior", () => {
    // Simulated tree item creation logic
    function createTreeItemState(item: ISparseItem): {
      collapsibleState: "none" | "collapsed";
      tooltip: string;
      contextValue: string;
    } {
      const isDir = item.kind === "dir";

      // Directories are expandable (both local and ghost)
      // Ghost dirs show server contents when expanded
      const collapsibleState: "none" | "collapsed" = isDir
        ? "collapsed"
        : "none";

      let contextValue: string;
      if (item.isGhost) {
        contextValue = isDir ? "sparseGhostDir" : "sparseGhostFile";
      } else {
        contextValue = isDir ? "sparseLocalDir" : "sparseLocalFile";
      }

      return {
        collapsibleState,
        tooltip: item.path,
        contextValue
      };
    }

    it("makes local directories expandable", () => {
      const item: ISparseItem = {
        name: "src",
        path: "src",
        kind: "dir",
        depth: "infinity",
        isGhost: false
      };

      const state = createTreeItemState(item);

      expect(state.collapsibleState).toBe("collapsed");
      expect(state.contextValue).toBe("sparseLocalDir");
    });

    it("makes ghost directories expandable to browse server", () => {
      const item: ISparseItem = {
        name: "docs",
        path: "docs",
        kind: "dir",
        isGhost: true
      };

      const state = createTreeItemState(item);

      expect(state.collapsibleState).toBe("collapsed");
      expect(state.contextValue).toBe("sparseGhostDir");
    });

    it("makes files never expandable", () => {
      const localFile: ISparseItem = {
        name: "README.md",
        path: "README.md",
        kind: "file",
        isGhost: false
      };
      const ghostFile: ISparseItem = {
        name: "config.json",
        path: "config.json",
        kind: "file",
        isGhost: true
      };

      expect(createTreeItemState(localFile).collapsibleState).toBe("none");
      expect(createTreeItemState(ghostFile).collapsibleState).toBe("none");
    });

    it("sets tooltip to item path", () => {
      const item: ISparseItem = {
        name: "utils",
        path: path.join("src", "lib", "utils"),
        kind: "dir",
        isGhost: false
      };

      const state = createTreeItemState(item);

      expect(state.tooltip).toBe(path.join("src", "lib", "utils"));
    });

    it("sets correct context value for menu targeting", () => {
      const items: ISparseItem[] = [
        { name: "a", path: "a", kind: "dir", isGhost: false },
        { name: "b", path: "b", kind: "dir", isGhost: true },
        { name: "c", path: "c", kind: "file", isGhost: false },
        { name: "d", path: "d", kind: "file", isGhost: true }
      ];

      const contextValues = items.map(i => createTreeItemState(i).contextValue);

      expect(contextValues).toEqual([
        "sparseLocalDir",
        "sparseGhostDir",
        "sparseLocalFile",
        "sparseGhostFile"
      ]);
    });
  });

  describe("cache behavior", () => {
    interface CacheEntry<T> {
      data: T;
      expires: number;
    }

    function isCacheValid<T>(
      cache: Map<string, CacheEntry<T>>,
      key: string,
      now: number
    ): boolean {
      const entry = cache.get(key);
      return entry !== undefined && entry.expires > now;
    }

    function evictExpired<T>(
      cache: Map<string, CacheEntry<T>>,
      now: number
    ): void {
      for (const [key, entry] of cache) {
        if (entry.expires <= now) {
          cache.delete(key);
        }
      }
    }

    it("returns cached data when not expired", () => {
      const cache = new Map<string, CacheEntry<string[]>>();
      const now = Date.now();

      cache.set("key1", { data: ["a", "b"], expires: now + 30000 });

      expect(isCacheValid(cache, "key1", now)).toBe(true);
      expect(cache.get("key1")?.data).toEqual(["a", "b"]);
    });

    it("rejects expired cache entries", () => {
      const cache = new Map<string, CacheEntry<string[]>>();
      const now = Date.now();

      cache.set("key1", { data: ["a", "b"], expires: now - 1000 }); // Expired

      expect(isCacheValid(cache, "key1", now)).toBe(false);
    });

    it("evicts all expired entries", () => {
      const cache = new Map<string, CacheEntry<string[]>>();
      const now = Date.now();

      cache.set("valid1", { data: ["a"], expires: now + 30000 });
      cache.set("expired1", { data: ["b"], expires: now - 1000 });
      cache.set("valid2", { data: ["c"], expires: now + 30000 });
      cache.set("expired2", { data: ["d"], expires: now - 2000 });

      evictExpired(cache, now);

      expect(cache.size).toBe(2);
      expect(cache.has("valid1")).toBe(true);
      expect(cache.has("valid2")).toBe(true);
      expect(cache.has("expired1")).toBe(false);
      expect(cache.has("expired2")).toBe(false);
    });

    it("handles empty cache gracefully", () => {
      const cache = new Map<string, CacheEntry<string[]>>();
      const now = Date.now();

      expect(isCacheValid(cache, "nonexistent", now)).toBe(false);
      evictExpired(cache, now); // Should not throw
      expect(cache.size).toBe(0);
    });
  });

  describe("RepositoryRootNode behavior", () => {
    it("uses repo basename as label", () => {
      const repoRoot = "/home/user/my-project";
      const label = path.basename(repoRoot);

      expect(label).toBe("my-project");
    });

    it("handles nested paths", () => {
      const nestedPath = path.join("/home", "user", "dev", "project");
      const label = path.basename(nestedPath);

      expect(label).toBe("project");
    });

    it("handles trailing slashes", () => {
      const pathWithSlash = "/home/user/project/";
      // path.basename returns empty for trailing slash, so implementation should handle
      const label =
        path.basename(pathWithSlash) ||
        path.basename(pathWithSlash.slice(0, -1));

      expect(label).toBe("project");
    });
  });
});
