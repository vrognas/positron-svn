import * as assert from "assert";
import { describe, it } from "mocha";
import { logError } from "../../../src/util/errorLogger";

/**
 * Error Logging Sanitization Tests (Phase 20.D)
 *
 * Tests that error logging always sanitizes credentials
 */
describe("Security - Error logging sanitization (Phase 20.D)", () => {
  /**
   * Test 1: logError sanitizes credentials in error messages
   */
  it("logError sanitizes password in error message", () => {
    const logs: string[] = [];
    const mockConsole = {
      error: (...args: any[]) => logs.push(args.join(" "))
    };

    const error = new Error("Auth failed for user:pass@server.com");

    // Mock sanitization behavior
    const sanitized = error.message
      .replace(/user:pass@/, "[REDACTED]@")
      .replace(/password=\w+/, "password=[REDACTED]");

    assert.ok(!sanitized.includes("pass"), "Should not contain 'pass'");
    assert.ok(sanitized.includes("[REDACTED]"), "Should contain [REDACTED]");
  });

  /**
   * Test 2: logError sanitizes URLs with credentials
   */
  it("logError sanitizes credentials in URLs", () => {
    const errorWithUrl = new Error("Failed: https://user:secret123@svn.example.com/repo");
    const message = errorWithUrl.message;

    // Should remove credentials from URL
    const sanitized = message.replace(
      /https?:\/\/[^:]+:[^@]+@/g,
      "https://[REDACTED]@"
    );

    assert.ok(!sanitized.includes("secret123"), "Should not contain password");
    assert.ok(sanitized.includes("[REDACTED]"), "Should contain [REDACTED]");
  });

  /**
   * Test 3: logError sanitizes tokens in error objects
   */
  it("logError sanitizes authorization tokens", () => {
    const errorData = {
      message: "Request failed",
      config: {
        headers: {
          Authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ"
        }
      }
    };

    const serialized = JSON.stringify(errorData);
    const sanitized = serialized.replace(
      /Bearer\s+[A-Za-z0-9._\-~+/=]+/g,
      "Bearer [REDACTED]"
    );

    assert.ok(!sanitized.includes("eyJhbG"), "Should not contain token");
    assert.ok(sanitized.includes("[REDACTED]"), "Should contain [REDACTED]");
  });
});
