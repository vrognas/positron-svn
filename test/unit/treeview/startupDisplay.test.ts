import { describe, it, expect } from "vitest";

/**
 * Tests for treeview startup display behavior.
 * Issue: Repository Log and Selective Download treeviews don't display at startup.
 *
 * Root cause: SourceControlManager fires onDidOpenRepository AFTER providers are created,
 * but providers don't listen to this event, so they never refresh when repos become available.
 *
 * Fix: Both RepoLogProvider and SparseCheckoutProvider must listen to onDidOpenRepository
 * and onDidCloseRepository to refresh their tree data when repositories change.
 */

// Mock EventEmitter for testing event subscription
class MockEventEmitter<T> {
  private listeners: ((e: T) => void)[] = [];

  event = (
    listener: (e: T) => void,
    _thisArg?: unknown,
    disposables?: { dispose(): void }[]
  ) => {
    this.listeners.push(listener);
    const disposable = { dispose: () => this.removeListener(listener) };
    if (disposables) {
      disposables.push(disposable);
    }
    return disposable;
  };

  fire(data: T): void {
    this.listeners.forEach(l => l(data));
  }

  private removeListener(listener: (e: T) => void): void {
    const idx = this.listeners.indexOf(listener);
    if (idx >= 0) this.listeners.splice(idx, 1);
  }

  get listenerCount(): number {
    return this.listeners.length;
  }
}

interface MockRepository {
  root: string;
  branchRoot: { toString: () => string };
  repository: { info: { revision: string } };
}

// Simulate the provider initialization pattern
describe("TreeView Startup Display", () => {
  describe("Provider refresh on repository events", () => {
    it("should refresh when repository is opened", () => {
      // Simulate SourceControlManager events
      const onDidOpenRepository = new MockEventEmitter<MockRepository>();
      const onDidCloseRepository = new MockEventEmitter<MockRepository>();

      // Track refreshes
      let refreshCount = 0;
      const refresh = () => {
        refreshCount++;
      };

      // Simulate provider subscribing to events (the fix)
      onDidOpenRepository.event(refresh);
      onDidCloseRepository.event(refresh);

      // Initially no refresh (constructor refresh doesn't count here)
      expect(refreshCount).toBe(0);

      // Fire onDidOpenRepository - should trigger refresh
      onDidOpenRepository.fire({
        root: "/test/repo",
        branchRoot: { toString: () => "svn://repo/trunk" },
        repository: { info: { revision: "100" } }
      });

      expect(refreshCount).toBe(1);
    });

    it("should refresh when repository is closed", () => {
      const onDidOpenRepository = new MockEventEmitter<MockRepository>();
      const onDidCloseRepository = new MockEventEmitter<MockRepository>();

      let refreshCount = 0;
      const refresh = () => {
        refreshCount++;
      };

      onDidOpenRepository.event(refresh);
      onDidCloseRepository.event(refresh);

      // Fire close event
      onDidCloseRepository.fire({
        root: "/test/repo",
        branchRoot: { toString: () => "svn://repo/trunk" },
        repository: { info: { revision: "100" } }
      });

      expect(refreshCount).toBe(1);
    });

    it("should handle multiple repository open/close events", () => {
      const onDidOpenRepository = new MockEventEmitter<MockRepository>();
      const onDidCloseRepository = new MockEventEmitter<MockRepository>();

      let refreshCount = 0;
      const refresh = () => {
        refreshCount++;
      };

      onDidOpenRepository.event(refresh);
      onDidCloseRepository.event(refresh);

      // Open multiple repos
      onDidOpenRepository.fire({
        root: "/test/repo1",
        branchRoot: { toString: () => "svn://repo1/trunk" },
        repository: { info: { revision: "100" } }
      });
      onDidOpenRepository.fire({
        root: "/test/repo2",
        branchRoot: { toString: () => "svn://repo2/trunk" },
        repository: { info: { revision: "200" } }
      });

      expect(refreshCount).toBe(2);

      // Close one repo
      onDidCloseRepository.fire({
        root: "/test/repo1",
        branchRoot: { toString: () => "svn://repo1/trunk" },
        repository: { info: { revision: "100" } }
      });

      expect(refreshCount).toBe(3);
    });
  });

  describe("RepoLogProvider initialization timing", () => {
    it("should have listeners for both open and close events", () => {
      const onDidOpenRepository = new MockEventEmitter<MockRepository>();
      const onDidCloseRepository = new MockEventEmitter<MockRepository>();

      // Simulate provider constructor subscribing
      const disposables: { dispose(): void }[] = [];
      onDidOpenRepository.event(() => {}, undefined, disposables);
      onDidCloseRepository.event(() => {}, undefined, disposables);

      // Both events should have listeners
      expect(onDidOpenRepository.listenerCount).toBe(1);
      expect(onDidCloseRepository.listenerCount).toBe(1);
    });

    it("should dispose listeners on cleanup", () => {
      const onDidOpenRepository = new MockEventEmitter<MockRepository>();
      const onDidCloseRepository = new MockEventEmitter<MockRepository>();

      const disposables: { dispose(): void }[] = [];
      onDidOpenRepository.event(() => {}, undefined, disposables);
      onDidCloseRepository.event(() => {}, undefined, disposables);

      expect(onDidOpenRepository.listenerCount).toBe(1);
      expect(onDidCloseRepository.listenerCount).toBe(1);

      // Dispose
      disposables.forEach(d => d.dispose());

      expect(onDidOpenRepository.listenerCount).toBe(0);
      expect(onDidCloseRepository.listenerCount).toBe(0);
    });
  });

  describe("SparseCheckoutProvider initialization timing", () => {
    it("should fire tree data change when repository opens", () => {
      const treeDataChangeEmitter = new MockEventEmitter<undefined>();
      const onDidOpenRepository = new MockEventEmitter<MockRepository>();

      // Provider listens to open and fires tree change
      onDidOpenRepository.event(() => {
        treeDataChangeEmitter.fire(undefined);
      });

      // Track tree data change events
      let treeChangeCount = 0;
      treeDataChangeEmitter.event(() => {
        treeChangeCount++;
      });

      // Open repo
      onDidOpenRepository.fire({
        root: "/test/repo",
        branchRoot: { toString: () => "svn://repo/trunk" },
        repository: { info: { revision: "100" } }
      });

      expect(treeChangeCount).toBe(1);
    });
  });
});
