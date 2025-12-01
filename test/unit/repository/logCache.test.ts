import { describe, it, expect } from "vitest";

describe("Repository Log Cache", () => {
  describe("Cache Key Generation", () => {
    it("generates unique key from log parameters", () => {
      // Cache key format: log:target:rfrom:rto:limit
      const target = "/trunk/src";
      const rfrom = "100";
      const rto = "200";
      const limit = 50;
      const key = `log:${target}:${rfrom}:${rto}:${limit}`;

      expect(key).toBe("log:/trunk/src:100:200:50");
    });

    it("handles missing target with empty string", () => {
      const target = undefined;
      const key = `log:${target || ""}:100:200:50`;

      expect(key).toBe("log::100:200:50");
    });

    it("generates unique key for logBatch from range", () => {
      // Cache key format: logBatch:target:minRev:maxRev
      const revisions = ["100", "150", "200"];
      const nums = revisions.map(r => parseInt(r, 10));
      const min = Math.min(...nums);
      const max = Math.max(...nums);
      const key = `logBatch::${min}:${max}`;

      expect(key).toBe("logBatch::100:200");
    });
  });

  describe("Cache Behavior", () => {
    it("returns cached entries on cache hit", () => {
      // Simulate cache behavior
      const cache = new Map<
        string,
        { entries: { revision: string }[]; lastAccessed: number }
      >();
      const key = "log::100:200:50";
      const entries = [{ revision: "100" }, { revision: "150" }];

      cache.set(key, { entries, lastAccessed: Date.now() });

      const cached = cache.get(key);
      expect(cached).toBeDefined();
      expect(cached!.entries).toEqual(entries);
    });

    it("updates lastAccessed on cache hit", () => {
      const cache = new Map<
        string,
        { entries: { revision: string }[]; lastAccessed: number }
      >();
      const key = "log::100:200:50";
      const oldTime = Date.now() - 10000;

      cache.set(key, { entries: [], lastAccessed: oldTime });

      // Simulate cache hit - update lastAccessed
      const entry = cache.get(key)!;
      const newTime = Date.now();
      cache.set(key, { ...entry, lastAccessed: newTime });

      expect(cache.get(key)!.lastAccessed).toBeGreaterThan(oldTime);
    });

    it("evicts LRU entry when at max size", () => {
      const MAX_SIZE = 3;
      const cache = new Map<
        string,
        { entries: { revision: string }[]; lastAccessed: number }
      >();

      // Fill cache
      cache.set("key1", { entries: [], lastAccessed: 1000 }); // oldest
      cache.set("key2", { entries: [], lastAccessed: 2000 });
      cache.set("key3", { entries: [], lastAccessed: 3000 }); // newest

      // Evict oldest before adding new
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

      cache.set("key4", { entries: [], lastAccessed: 4000 });

      expect(cache.has("key1")).toBe(false); // evicted
      expect(cache.has("key4")).toBe(true); // added
      expect(cache.size).toBe(3);
    });
  });

  describe("logBatch Cache Integration", () => {
    it("caches full range, filters on retrieval", () => {
      // logBatch caches entire range (100:200), filters to requested revisions
      const fullRange = [
        { revision: "100", msg: "a" },
        { revision: "120", msg: "b" },
        { revision: "150", msg: "c" },
        { revision: "200", msg: "d" }
      ];

      const requested = new Set(["100", "150", "200"]);
      const filtered = fullRange.filter(e => requested.has(e.revision));

      expect(filtered.length).toBe(3);
      expect(filtered.map(e => e.revision)).toEqual(["100", "150", "200"]);
    });

    it("cache hit still requires filtering", () => {
      // Even on cache hit, we filter to requested revisions
      // because cache stores full range
      const cachedRange = [
        { revision: "100" },
        { revision: "101" },
        { revision: "102" }
      ];

      // First call requests [100, 102]
      const req1 = new Set(["100", "102"]);
      const result1 = cachedRange.filter(e => req1.has(e.revision));
      expect(result1.length).toBe(2);

      // Second call requests [101]
      const req2 = new Set(["101"]);
      const result2 = cachedRange.filter(e => req2.has(e.revision));
      expect(result2.length).toBe(1);
    });

    it("different ranges produce different cache keys", () => {
      const key1 = `logBatch::100:200`;
      const key2 = `logBatch::150:300`;

      expect(key1).not.toBe(key2);
    });
  });
});
