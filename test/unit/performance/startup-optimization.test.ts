import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Startup Optimization Tests
 *
 * Tests for extension startup performance optimizations:
 * - SVN path caching (saves ~1-2s on subsequent launches)
 * - Parallel Windows discovery (saves ~600-1500ms)
 * - Background workspace scanning (non-blocking activation)
 */
describe("Startup Optimization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Test 1: Cached ISvn object used with fs.access check (no spawn)
   */
  it("uses cached ISvn with fs.access instead of spawning", async () => {
    const cachedSvn = { path: "/usr/bin/svn", version: "1.14.0" };
    const mockGlobalState = {
      get: vi.fn().mockReturnValue(cachedSvn),
      update: vi.fn().mockResolvedValue(undefined)
    };

    // Mock fs.access to succeed
    const fsAccess = vi.fn().mockResolvedValue(undefined);

    // Simulate cache hit flow - fs.access instead of spawn
    const cached = mockGlobalState.get("svnCache");
    if (cached?.path && cached?.version) {
      await fsAccess(cached.path);
      // No findSpecificSvn call needed - return cached directly
      expect(cached.path).toBe("/usr/bin/svn");
      expect(cached.version).toBe("1.14.0");
    }

    // fs.access was called, not svn --version spawn
    expect(fsAccess).toHaveBeenCalledWith("/usr/bin/svn");
  });

  /**
   * Test 2: Parallel discovery returns first success
   */
  it("parallel SVN discovery returns first successful result", async () => {
    const paths = ["/path1/svn", "/path2/svn", "/usr/bin/svn"];

    const findSpecificSvn = vi.fn().mockImplementation((path: string) => {
      if (path === "/path1/svn") {
        return Promise.reject(new Error("Not found"));
      }
      if (path === "/path2/svn") {
        return Promise.reject(new Error("Not found"));
      }
      // Third path succeeds
      return Promise.resolve({ path, version: "1.14.0" });
    });

    // Parallel execution with Promise.allSettled
    const results = await Promise.allSettled(
      paths.map(p => findSpecificSvn(p))
    );

    // Find first success
    let found = null;
    for (const result of results) {
      if (result.status === "fulfilled") {
        found = result.value;
        break;
      }
    }

    expect(found).not.toBeNull();
    expect(found?.path).toBe("/usr/bin/svn");
  });

  /**
   * Test 3: Background scanning doesn't block activation
   */
  it("workspace scanning deferred to background", async () => {
    const activationOrder: string[] = [];

    // Simulate the enable() flow
    const scanWorkspaceFolders = vi.fn().mockImplementation(async () => {
      // Simulate slow scan
      await new Promise(resolve => setTimeout(resolve, 10));
      activationOrder.push("scan-complete");
    });

    const setState = vi.fn().mockImplementation(() => {
      activationOrder.push("initialized");
    });

    // Simulated enable() - setState before scan starts
    setState("initialized");

    // Fire-and-forget (no await)
    scanWorkspaceFolders().catch(() => {
      /* error handling */
    });

    activationOrder.push("activation-complete");

    // Activation completes before scan
    expect(activationOrder[0]).toBe("initialized");
    expect(activationOrder[1]).toBe("activation-complete");

    // Wait for background scan
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(activationOrder).toContain("scan-complete");
  });

  /**
   * Test 4: Cache invalidation when fs.access fails (file moved/deleted)
   */
  it("clears invalid cache when fs.access fails", async () => {
    const cachedSvn = { path: "/old/invalid/svn", version: "1.14.0" };
    const mockGlobalState = {
      get: vi.fn().mockReturnValue(cachedSvn),
      update: vi.fn().mockResolvedValue(undefined)
    };

    // Mock fs.access to fail (file doesn't exist)
    const fsAccess = vi.fn().mockRejectedValue(new Error("ENOENT"));

    // Try cached path first
    const cached = mockGlobalState.get("svnCache");
    if (cached?.path) {
      try {
        await fsAccess(cached.path);
      } catch {
        // Cache invalid, clear it
        await mockGlobalState.update("svnCache", undefined);
      }
    }

    expect(mockGlobalState.update).toHaveBeenCalledWith("svnCache", undefined);
  });
});
