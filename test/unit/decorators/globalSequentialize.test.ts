import * as assert from "assert";
import { describe, it } from "mocha";
import { globalSequentialize } from "../../../src/decorators";

/**
 * Global Sequentialize Per-Repo Tests (Phase 20.B)
 *
 * Tests that globalSequentialize uses per-repo keys to prevent
 * multi-repo data corruption and performance degradation
 */
describe("Decorators - globalSequentialize per-repo (Phase 20.B)", () => {
  /**
   * Test 1: Different repo instances should have independent queues
   */
  it("different repo instances have independent operation queues", async () => {
    class MockRepo {
      public executionOrder: number[] = [];
      public root: string;

      constructor(root: string) {
        this.root = root;
      }

      @globalSequentialize("testOp")
      async operation(id: number, delay: number): Promise<void> {
        await new Promise((resolve) => setTimeout(resolve, delay));
        this.executionOrder.push(id);
      }
    }

    const repo1 = new MockRepo("/repo1");
    const repo2 = new MockRepo("/repo2");

    // Start ops on both repos - they should run in parallel
    const start = Date.now();
    await Promise.all([
      repo1.operation(1, 50),
      repo2.operation(2, 50)
    ]);
    const elapsed = Date.now() - start;

    // Should take ~50ms (parallel), not ~100ms (serialized)
    assert.ok(elapsed < 80, `Parallel execution should be <80ms, was ${elapsed}ms`);
    assert.deepStrictEqual(repo1.executionOrder, [1]);
    assert.deepStrictEqual(repo2.executionOrder, [2]);
  });

  /**
   * Test 2: Same repo instance should serialize operations
   */
  it("same repo instance serializes operations", async () => {
    class MockRepo {
      public executionOrder: number[] = [];
      public root: string;

      constructor(root: string) {
        this.root = root;
      }

      @globalSequentialize("testOp")
      async operation(id: number, delay: number): Promise<void> {
        await new Promise((resolve) => setTimeout(resolve, delay));
        this.executionOrder.push(id);
      }
    }

    const repo = new MockRepo("/repo1");

    // Start multiple ops on same repo - they should serialize
    const start = Date.now();
    await Promise.all([
      repo.operation(1, 30),
      repo.operation(2, 30)
    ]);
    const elapsed = Date.now() - start;

    // Should take ~60ms (serialized), not ~30ms (parallel)
    assert.ok(elapsed >= 50, `Serialized execution should be >=50ms, was ${elapsed}ms`);
    assert.deepStrictEqual(repo.executionOrder, [1, 2]);
  });

  /**
   * Test 3: Interleaved operations on multiple repos execute independently
   */
  it("interleaved multi-repo operations execute independently", async () => {
    class MockRepo {
      public callCount: number = 0;
      public root: string;

      constructor(root: string) {
        this.root = root;
      }

      @globalSequentialize("testOp")
      async operation(delay: number): Promise<void> {
        await new Promise((resolve) => setTimeout(resolve, delay));
        this.callCount++;
      }
    }

    const repo1 = new MockRepo("/repo1");
    const repo2 = new MockRepo("/repo2");
    const repo3 = new MockRepo("/repo3");

    // All repos run concurrently - should not block each other
    const start = Date.now();
    await Promise.all([
      repo1.operation(40),
      repo2.operation(40),
      repo3.operation(40)
    ]);
    const elapsed = Date.now() - start;

    // Should take ~40ms (parallel), not ~120ms (fully serialized)
    assert.ok(elapsed < 80, `Concurrent execution should be <80ms, was ${elapsed}ms`);
    assert.strictEqual(repo1.callCount, 1);
    assert.strictEqual(repo2.callCount, 1);
    assert.strictEqual(repo3.callCount, 1);
  });
});
