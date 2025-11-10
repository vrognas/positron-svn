import * as assert from "assert";
import { RemoteChangeService } from "../../../services/RemoteChangeService";

suite("RemoteChangeService Tests", () => {
  let onPollCalls: number;
  let service: RemoteChangeService;
  let timerHandle: NodeJS.Timeout | undefined;

  setup(() => {
    onPollCalls = 0;
  });

  teardown(() => {
    if (service) {
      service.dispose();
    }
    if (timerHandle) {
      clearTimeout(timerHandle);
    }
  });

  test("Polling lifecycle - starts and creates interval", (done) => {
    service = new RemoteChangeService(
      () => {
        onPollCalls++;
      },
      () => ({ checkFrequencySeconds: 0.1 }) // 100ms for fast test
    );

    service.start();
    assert.strictEqual(service.isRunning, true, "Service should be running after start");

    // Wait for first poll
    timerHandle = setTimeout(() => {
      assert.ok(onPollCalls >= 1, "Poll callback should be called at least once");
      service.stop();
      assert.strictEqual(service.isRunning, false, "Service should not be running after stop");
      done();
    }, 250); // Wait 250ms to allow 2 polls
  });

  test("Config handling - disabled when frequency is 0", (done) => {
    service = new RemoteChangeService(
      () => {
        onPollCalls++;
      },
      () => ({ checkFrequencySeconds: 0 }) // Disabled
    );

    service.start();
    assert.strictEqual(service.isRunning, false, "Service should not be running when frequency is 0");

    // Wait to confirm no polls happen
    timerHandle = setTimeout(() => {
      assert.strictEqual(onPollCalls, 0, "No polls should occur when disabled");
      done();
    }, 100);
  });

  test("Disposal safety - no timer leaks on dispose", () => {
    service = new RemoteChangeService(
      () => {
        onPollCalls++;
      },
      () => ({ checkFrequencySeconds: 0.1 })
    );

    service.start();
    assert.strictEqual(service.isRunning, true, "Service should be running");

    service.dispose();
    assert.strictEqual(service.isRunning, false, "Service should not be running after dispose");

    // Multiple dispose calls should be safe
    service.dispose();
    assert.strictEqual(service.isRunning, false, "Multiple dispose should be safe");

    // Cannot restart after dispose
    assert.throws(() => {
      service.start();
    }, "Should throw error when starting disposed service");
  });
});
