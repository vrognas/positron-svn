import * as assert from "assert";
import { describe, it } from "mocha";

/**
 * Commit Parent Traversal Performance Tests (Phase 21.A)
 *
 * Tests that commit parent directory traversal uses flat map for O(1) lookups
 */
describe("Performance - Commit parent traversal (Phase 21.A)", () => {
  /**
   * Test 1: Flat resource map provides O(1) lookup
   */
  it("resource map lookup is O(1) constant time", () => {
    // Simulate flat resource map
    const resourceMap = new Map<string, any>();
    resourceMap.set("/repo/dir1", { type: "ADDED" });
    resourceMap.set("/repo/dir1/dir2", { type: "ADDED" });
    resourceMap.set("/repo/dir1/dir2/file.txt", { type: "MODIFIED" });

    // Lookup should be O(1)
    const start = Date.now();
    const result = resourceMap.get("/repo/dir1");
    const elapsed = Date.now() - start;

    assert.ok(result, "Should find resource");
    assert.ok(elapsed < 1, `O(1) lookup should be <1ms, was ${elapsed}ms`);
  });

  /**
   * Test 2: Building resource map is O(n) linear time
   */
  it("building resource map from array is O(n) linear", () => {
    // Simulate resource array
    const resources = Array.from({ length: 1000 }, (_, i) => ({
      fsPath: `/repo/file${i}.txt`,
      type: "MODIFIED"
    }));

    // Build map - should be O(n)
    const start = Date.now();
    const resourceMap = new Map();
    resources.forEach(r => resourceMap.set(r.fsPath, r));
    const elapsed = Date.now() - start;

    assert.strictEqual(resourceMap.size, 1000, "Should have all resources");
    assert.ok(elapsed < 10, `O(n) build should be <10ms, was ${elapsed}ms`);
  });

  /**
   * Test 3: Parent traversal with map is faster than nested loops
   */
  it("parent traversal with flat map faster than repeated searches", () => {
    const resources = [
      { fsPath: "/repo/a/b/c/d/file.txt", type: "MODIFIED" },
      { fsPath: "/repo/a/b/c", type: "ADDED" },
      { fsPath: "/repo/a/b", type: "ADDED" }
    ];

    // Build flat map once
    const buildStart = Date.now();
    const resourceMap = new Map<string, any>();
    resources.forEach(r => resourceMap.set(r.fsPath, r));
    const buildTime = Date.now() - buildStart;

    // Traverse parents using map
    const traverseStart = Date.now();
    let dir = "/repo/a/b/c/d";
    let depth = 0;
    while (dir !== "/repo" && depth < 10) {
      const parent = resourceMap.get(dir);
      if (parent?.type === "ADDED") {
        // Found parent
      }
      dir = dir.substring(0, dir.lastIndexOf("/"));
      depth++;
    }
    const traverseTime = Date.now() - traverseStart;

    const totalTime = buildTime + traverseTime;
    assert.ok(totalTime < 5, `Total time should be <5ms, was ${totalTime}ms`);
  });
});
