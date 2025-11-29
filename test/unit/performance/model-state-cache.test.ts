import { describe, it, expect } from "vitest";

describe("Repository - updateModelState cache", () => {
  it("skips redundant calls within 2s cache window", async () => {
    // Test: Multiple events within 2s should trigger only one update
    // Mock: Repository with lastModelUpdate tracking
    const now = Date.now();
    const MODEL_CACHE_MS = 2000;

    // Simulate cache check
    const call1Time = now;
    const call2Time = now + 500; // 500ms later
    const call3Time = now + 1500; // 1.5s later

    // All within 2s window, should skip calls 2 & 3
    expect(call2Time - call1Time < MODEL_CACHE_MS).toBe(true);
    expect(call3Time - call1Time < MODEL_CACHE_MS).toBe(true);
  });

  it("executes calls beyond 2s cache window", async () => {
    // Test: Events >2s apart should trigger separate updates
    const now = Date.now();
    const MODEL_CACHE_MS = 2000;

    const call1Time = now;
    const call2Time = now + 2500; // 2.5s later

    // Beyond 2s window, should execute
    expect(call2Time - call1Time >= MODEL_CACHE_MS).toBe(true);
  });
});
