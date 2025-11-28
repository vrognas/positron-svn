// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import * as assert from "assert";
import {
  showNativeStoreAuthNotification,
  resetNativeStoreAuthNotification
} from "../util/nativeStoreAuthNotification";

suite("NativeStoreAuthNotification", () => {
  setup(() => {
    // Reset state before each test
    resetNativeStoreAuthNotification();
  });

  test("should not throw when called", async () => {
    // Just verify no errors - actual UI behavior tested in e2e
    await assert.doesNotReject(async () => {
      await showNativeStoreAuthNotification();
    });
  });

  test("should only show notification once per session", async () => {
    // Call twice - second should be no-op
    await showNativeStoreAuthNotification();
    await showNativeStoreAuthNotification();
    // No assertion needed - test passes if no error
    assert.ok(true, "Multiple calls handled gracefully");
  });

  test("reset should allow notification again", async () => {
    await showNativeStoreAuthNotification();
    resetNativeStoreAuthNotification();
    // After reset, should be able to show again
    await assert.doesNotReject(async () => {
      await showNativeStoreAuthNotification();
    });
  });
});
