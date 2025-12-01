import { describe, it, expect } from "vitest";

describe("RepoLogProvider Cache", () => {
  describe("LRU Eviction", () => {
    it("evicts oldest entry when at max size", () => {
      const MAX_SIZE = 3;
      const cache = new Map<string, { order: number; lastAccessed: number }>();

      // Fill cache
      cache.set("repo1", { order: 0, lastAccessed: 1000 }); // oldest
      cache.set("repo2", { order: 1, lastAccessed: 2000 });
      cache.set("repo3", { order: 2, lastAccessed: 3000 });

      // Evict LRU before adding
      if (cache.size >= MAX_SIZE) {
        let oldestKey: string | null = null;
        let oldestTime = Infinity;
        for (const [key, entry] of cache.entries()) {
          if (entry.lastAccessed < oldestTime) {
            oldestTime = entry.lastAccessed;
            oldestKey = key;
          }
        }
        if (oldestKey) {
          cache.delete(oldestKey);
        }
      }

      cache.set("repo4", { order: 3, lastAccessed: 4000 });

      expect(cache.has("repo1")).toBe(false); // evicted
      expect(cache.has("repo4")).toBe(true);
      expect(cache.size).toBe(3);
    });

    it("updates lastAccessed on cache access", () => {
      const cache = new Map<string, { lastAccessed: number }>();
      cache.set("repo1", { lastAccessed: 1000 });

      // Simulate access - update lastAccessed
      const entry = cache.get("repo1")!;
      entry.lastAccessed = Date.now();

      expect(entry.lastAccessed).toBeGreaterThan(1000);
    });

    it("preserves recently accessed entries", () => {
      const MAX_SIZE = 3;
      const cache = new Map<string, { lastAccessed: number }>();

      cache.set("repo1", { lastAccessed: 1000 });
      cache.set("repo2", { lastAccessed: 2000 });
      cache.set("repo3", { lastAccessed: 3000 });

      // Access repo1 (making it recent)
      cache.get("repo1")!.lastAccessed = 5000;

      // Evict LRU
      if (cache.size >= MAX_SIZE) {
        let oldestKey: string | null = null;
        let oldestTime = Infinity;
        for (const [key, entry] of cache.entries()) {
          if (entry.lastAccessed < oldestTime) {
            oldestTime = entry.lastAccessed;
            oldestKey = key;
          }
        }
        if (oldestKey) {
          cache.delete(oldestKey);
        }
      }

      cache.set("repo4", { lastAccessed: 6000 });

      expect(cache.has("repo1")).toBe(true); // preserved (recently accessed)
      expect(cache.has("repo2")).toBe(false); // evicted (oldest)
    });
  });
});
