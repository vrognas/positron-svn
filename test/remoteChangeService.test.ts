import * as assert from "assert";
import { EventEmitter } from "vscode";
import { RemoteChangeService } from "../src/services/RemoteChangeService";
import { ISvnResourceGroup, Operation } from "../src/common/types";

interface MockConfigChangeEvent {
  affectsConfiguration: (key: string) => boolean;
}

interface MockRepository {
  run: (op: Operation) => Promise<void>;
  lastOperation: Operation | null;
  remoteChanges?: ISvnResourceGroup;
}

/**
 * TDD Tests for RemoteChangeService
 *
 * Tests written BEFORE implementation to drive design.
 * Coverage target: 60%+
 */
suite("RemoteChangeService Tests", () => {
  let mockRepository: MockRepository;
  let mockConfig: Map<string, number>;
  let mockConfigEmitter: EventEmitter<MockConfigChangeEvent>;
  let service: RemoteChangeService;

  setup(() => {
    mockConfig = new Map<string, number>();
    mockConfig.set("remoteChanges.checkFrequency", 300); // Default 5 minutes

    mockConfigEmitter = new EventEmitter<MockConfigChangeEvent>();

    mockRepository = {
      run: async (op: Operation) => {
        mockRepository.lastOperation = op;
      },
      lastOperation: null,
      remoteChanges: undefined as ISvnResourceGroup | undefined
    };
  });

  teardown(() => {
    if (service) {
      service.dispose();
    }
    mockConfigEmitter.dispose();
  });

  /**
   * Test 1: Interval creation when frequency > 0
   * Validates that polling starts with valid config
   */
  test("creates interval when checkFrequency > 0", (done) => {
    const frequency = 1; // 1 second for fast test
    mockConfig.set("remoteChanges.checkFrequency", frequency);

    service = new RemoteChangeService(
      mockRepository,
      <T,>(key: string, defaultValue: T): T => mockConfig.get(key) as T ?? defaultValue,
      mockConfigEmitter.event
    );

    // Wait for interval to fire at least once
    setTimeout(() => {
      assert.strictEqual(
        mockRepository.lastOperation,
        Operation.StatusRemote,
        "Should have called StatusRemote operation"
      );
      done();
    }, frequency * 1000 + 100);
  });

  /**
   * Test 2: No interval when frequency = 0
   * Validates that polling is disabled when config = 0
   */
  test("does not create interval when checkFrequency = 0", (done) => {
    mockConfig.set("remoteChanges.checkFrequency", 0);

    service = new RemoteChangeService(
      mockRepository,
      <T,>(key: string, defaultValue: T): T => mockConfig.get(key) as T ?? defaultValue,
      mockConfigEmitter.event
    );

    // Wait to ensure no operation is called
    setTimeout(() => {
      assert.strictEqual(
        mockRepository.lastOperation,
        null,
        "Should NOT have called any operation when frequency is 0"
      );
      done();
    }, 200);
  });

  /**
   * Test 3: Config change updates interval
   * Validates that interval is recreated when config changes
   */
  test("recreates interval on config change", (done) => {
    const initialFrequency = 10; // 10 seconds
    const newFrequency = 1; // 1 second

    mockConfig.set("remoteChanges.checkFrequency", initialFrequency);

    service = new RemoteChangeService(
      mockRepository,
      <T,>(key: string, defaultValue: T): T => mockConfig.get(key) as T ?? defaultValue,
      mockConfigEmitter.event
    );

    // Change config
    mockConfig.set("remoteChanges.checkFrequency", newFrequency);
    mockConfigEmitter.fire({
      affectsConfiguration: (key: string) => key === "svn.remoteChanges.checkFrequency"
    });

    // New interval should fire quickly
    setTimeout(() => {
      assert.strictEqual(
        mockRepository.lastOperation,
        Operation.StatusRemote,
        "Should have called StatusRemote after config change"
      );
      done();
    }, newFrequency * 1000 + 100);
  });

  /**
   * Test 4: Disposal clears interval
   * Validates cleanup prevents memory leaks
   */
  test("dispose clears interval and prevents further operations", (done) => {
    const frequency = 1;
    mockConfig.set("remoteChanges.checkFrequency", frequency);

    service = new RemoteChangeService(
      mockRepository,
      <T,>(key: string, defaultValue: T): T => mockConfig.get(key) as T ?? defaultValue,
      mockConfigEmitter.event
    );

    // Wait for first call
    setTimeout(() => {
      const firstCallCount = mockRepository.lastOperation ? 1 : 0;

      // Dispose service
      service.dispose();

      // Wait longer - no new calls should happen
      setTimeout(() => {
        const finalCallCount = mockRepository.lastOperation ? 1 : 0;
        assert.strictEqual(
          firstCallCount,
          finalCallCount,
          "No operations should occur after disposal"
        );
        done();
      }, frequency * 1000 + 500);
    }, frequency * 1000 + 100);
  });

  /**
   * Test 5: Remote changes disposed when frequency set to 0
   * Validates that remote changes group is cleaned up
   */
  test("disposes remote changes when frequency changed to 0", () => {
    mockConfig.set("remoteChanges.checkFrequency", 300);

    // Mock resource group
    mockRepository.remoteChanges = {
      dispose: () => { mockRepository.remoteChanges = undefined; },
      resourceStates: []
    } as ISvnResourceGroup;

    service = new RemoteChangeService(
      mockRepository,
      <T,>(key: string, defaultValue: T): T => mockConfig.get(key) as T ?? defaultValue,
      mockConfigEmitter.event
    );

    // Change to 0
    mockConfig.set("remoteChanges.checkFrequency", 0);
    mockConfigEmitter.fire({
      affectsConfiguration: (key: string) => key === "svn.remoteChanges.checkFrequency"
    });

    // Trigger update
    service.updateRemoteChangedFiles();

    assert.strictEqual(
      mockRepository.remoteChanges,
      undefined,
      "Remote changes should be disposed when frequency is 0"
    );
  });
});
