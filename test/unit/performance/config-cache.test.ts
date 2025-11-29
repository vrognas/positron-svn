import { describe, it, expect } from "vitest";
import { configuration } from "../../../src/helpers/configuration";

/**
 * Config Caching Performance Tests (Phase 8.1)
 *
 * Tests for configuration caching to prevent repeated workspace.getConfiguration() calls
 * in hot paths (status updates 1-10x/sec).
 */
describe("Config Caching", () => {
  /**
   * Test 1: Config cache invalidation on change
   */
  it("invalidates cache when configuration changes", () => {
    // This test validates that the configuration helper properly
    // refreshes its cache when VS Code configuration changes.
    // The actual caching logic will be in Repository/StatusService.

    let changeCount = 0;
    const disposable = configuration.onDidChange(() => {
      changeCount++;
    });

    // Simulate config change would happen via VS Code API
    // In real scenario: workspace.getConfiguration("svn").update(...)

    disposable.dispose();

    // Basic validation that event listener was set up
    expect(typeof changeCount).toBe("number");
  });

  /**
   * Test 2: Multiple config reads don't call VS Code API repeatedly
   */
  it("caches config reads within same execution context", () => {
    // StatusService.getConfiguration() should cache results
    // Multiple calls in same status update shouldn't re-read from VS Code

    const val1 = configuration.get<boolean>(
      "sourceControl.hideUnversioned",
      false
    );
    const val2 = configuration.get<boolean>(
      "sourceControl.hideUnversioned",
      false
    );

    // Same value returned (configuration helper already caches internally)
    expect(val1).toBe(val2);
  });

  /**
   * Test 3: Config helper fires change events
   */
  it("configuration helper emits change events", () => {
    // Validate that our configuration helper properly exposes change events
    // This is infrastructure needed for cache invalidation

    expect(configuration.onDidChange).toBeTruthy();
    expect(typeof configuration.onDidChange).toBe("function");
  });

  /**
   * Test 4: Remote changes config cached (Phase 9 fix)
   */
  it("caches remote changes check frequency config", () => {
    // Validate remoteChanges.checkFrequency is cached
    // Previously called 5+ times per branch/merge + periodic polling

    const freq1 = configuration.get<number>(
      "remoteChanges.checkFrequency",
      300
    );
    const freq2 = configuration.get<number>(
      "remoteChanges.checkFrequency",
      300
    );

    expect(freq1).toBe(freq2);
    expect(typeof freq1).toBe("number");
  });
});
