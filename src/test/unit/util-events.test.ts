import * as assert from "assert";
import { EventEmitter } from "vscode";
import { anyEvent, filterEvent, throttleEvent, onceEvent } from "../../util";

suite("Util - Event Tests", () => {
  suite("anyEvent", () => {
    test("fires when any source event fires", () => {
      const emitter1 = new EventEmitter<number>();
      const emitter2 = new EventEmitter<number>();

      const combined = anyEvent(emitter1.event, emitter2.event);
      let fired = 0;
      let lastValue: number | undefined;

      combined((value) => {
        fired++;
        lastValue = value;
      });

      emitter1.fire(1);
      assert.strictEqual(fired, 1);
      assert.strictEqual(lastValue, 1);

      emitter2.fire(2);
      assert.strictEqual(fired, 2);
      assert.strictEqual(lastValue, 2);
    });

    test("disposes all source event subscriptions", () => {
      const emitter1 = new EventEmitter<number>();
      const emitter2 = new EventEmitter<number>();

      const combined = anyEvent(emitter1.event, emitter2.event);
      let fired = 0;

      const disposable = combined(() => fired++);

      emitter1.fire(1);
      assert.strictEqual(fired, 1);

      disposable.dispose();

      emitter1.fire(2);
      emitter2.fire(3);
      assert.strictEqual(fired, 1, "Should not fire after dispose");
    });
  });

  suite("filterEvent", () => {
    test("filters events based on predicate", () => {
      const emitter = new EventEmitter<number>();
      const filtered = filterEvent(emitter.event, (n) => n % 2 === 0);

      const values: number[] = [];
      filtered((value) => values.push(value));

      emitter.fire(1);
      emitter.fire(2);
      emitter.fire(3);
      emitter.fire(4);

      assert.deepStrictEqual(values, [2, 4]);
    });

    test("passes through all events when predicate always true", () => {
      const emitter = new EventEmitter<string>();
      const filtered = filterEvent(emitter.event, () => true);

      const values: string[] = [];
      filtered((value) => values.push(value));

      emitter.fire("a");
      emitter.fire("b");

      assert.deepStrictEqual(values, ["a", "b"]);
    });
  });

  suite("throttleEvent", () => {
    test("throttles rapid events and fires latest", async () => {
      const emitter = new EventEmitter<number>();
      const throttled = throttleEvent(emitter.event, 50);

      const values: number[] = [];
      throttled((value) => values.push(value));

      // Fire rapid events
      emitter.fire(1);
      emitter.fire(2);
      emitter.fire(3);

      // Should not have fired yet
      assert.strictEqual(values.length, 0);

      // Wait for throttle delay
      await new Promise(resolve => setTimeout(resolve, 60));

      // Should have fired once with latest value
      assert.deepStrictEqual(values, [3]);
    });

    test("fires subsequent events after delay", async () => {
      const emitter = new EventEmitter<number>();
      const throttled = throttleEvent(emitter.event, 50);

      const values: number[] = [];
      throttled((value) => values.push(value));

      emitter.fire(1);
      await new Promise(resolve => setTimeout(resolve, 60));

      emitter.fire(2);
      await new Promise(resolve => setTimeout(resolve, 60));

      assert.deepStrictEqual(values, [1, 2]);
    });

    test("cleans up timer on dispose", async () => {
      const emitter = new EventEmitter<number>();
      const throttled = throttleEvent(emitter.event, 50);

      const values: number[] = [];
      const disposable = throttled((value) => values.push(value));

      emitter.fire(1);
      disposable.dispose();

      await new Promise(resolve => setTimeout(resolve, 60));

      // Should not fire after dispose
      assert.strictEqual(values.length, 0);
    });
  });

  suite("onceEvent", () => {
    test("fires only once", () => {
      const emitter = new EventEmitter<number>();
      const once = onceEvent(emitter.event);

      let fired = 0;
      let value: number | undefined;

      once((v) => {
        fired++;
        value = v;
      });

      emitter.fire(1);
      emitter.fire(2);
      emitter.fire(3);

      assert.strictEqual(fired, 1);
      assert.strictEqual(value, 1);
    });

    test("auto-disposes after first fire", () => {
      const emitter = new EventEmitter<number>();
      const once = onceEvent(emitter.event);

      let fired = 0;
      once(() => fired++);

      emitter.fire(1);
      assert.strictEqual(fired, 1);

      // Try to fire again
      emitter.fire(2);
      assert.strictEqual(fired, 1, "Should not fire second time");
    });
  });
});
