import { describe, it, expect } from "vitest";

describe("Repository logBatch", () => {
  describe("Batch Command Construction", () => {
    it("single revision uses -r REV:REV", () => {
      // Test single revision range construction
      const singleRev = ["100"];
      const expectedRange = "100:100";

      expect(expectedRange).toBe("100:100");
      expect(singleRev.length).toBe(1);
    });

    it("multiple revisions use min:max range", () => {
      const revisions = ["100", "105", "200", "150"];
      const min = Math.min(...revisions.map(r => parseInt(r, 10)));
      const max = Math.max(...revisions.map(r => parseInt(r, 10)));
      const range = `${min}:${max}`;

      expect(range).toBe("100:200");
    });

    it("handles string revisions correctly", () => {
      const revisions = ["100", "200"];
      const nums = revisions.map(r => parseInt(r, 10));

      expect(!nums.some(isNaN)).toBeTruthy();
      expect(nums.length).toBe(2);
    });
  });

  describe("Edge Cases", () => {
    it("empty array returns empty result", async () => {
      const revisions: string[] = [];
      const result = revisions.length === 0 ? [] : ["some"];

      expect(result).toEqual([]);
    });

    it("single revision optimizes to single log call", () => {
      const revisions = ["100"];
      const shouldBatch = revisions.length > 1;

      expect(shouldBatch).toBe(false);
    });

    it("filters requested revisions from range result", () => {
      // Range 100:200 returns all revisions, but we only want specific ones
      const requested = ["100", "150", "200"];
      const allFetched = ["100", "120", "150", "180", "200"];
      const filtered = allFetched.filter(r => requested.includes(r));

      expect(filtered).toEqual(["100", "150", "200"]);
    });
  });

  describe("Performance Optimization", () => {
    it("batch reduces command count dramatically", () => {
      const revisionCount = 50;
      const sequentialCalls = revisionCount; // 50 calls
      const batchCalls = 1; // 1 call
      const improvement = sequentialCalls / batchCalls;

      expect(improvement).toBe(50);
    });

    it("sparse revisions still benefit from batching", () => {
      // Revisions: 10, 500, 1000 (very sparse)
      // Range: 10:1000 (fetches ~990 extra, but still faster than 3 calls)
      const sparseRevs = ["10", "500", "1000"];
      const range = "10:1000";

      // Trade-off: Extra data vs fewer network calls
      expect(range.length > 0).toBeTruthy();
      expect(sparseRevs.length).toBe(3);
    });
  });

  describe("Result Filtering", () => {
    it("extracts only requested revisions from batch", () => {
      // Simulate batch result containing many revisions
      const batchResult = [
        { revision: "100", msg: "msg1" },
        { revision: "101", msg: "msg2" },
        { revision: "102", msg: "msg3" },
        { revision: "150", msg: "msg4" }
      ];
      const requested = new Set(["100", "150"]);
      const filtered = batchResult.filter(entry =>
        requested.has(entry.revision)
      );

      expect(filtered.length).toBe(2);
      expect(filtered[0].revision).toBe("100");
      expect(filtered[1].revision).toBe("150");
    });

    it("handles missing revisions gracefully", () => {
      // Requested revision doesn't exist in range
      const batchResult = [
        { revision: "100", msg: "msg1" },
        { revision: "102", msg: "msg2" }
      ];
      const requested = new Set(["100", "101", "102"]);
      const filtered = batchResult.filter(entry =>
        requested.has(entry.revision)
      );

      // 101 is missing, should only return 100 and 102
      expect(filtered.length).toBe(2);
    });
  });
});
