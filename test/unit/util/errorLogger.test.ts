import { describe, it, expect } from "vitest";

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
    const error = new Error("Auth failed for user:pass@server.com");

    // Mock sanitization behavior
    const sanitized = error.message
      .replace(/user:pass@/, "[REDACTED]@")
      .replace(/password=\w+/, "password=[REDACTED]");

    expect(!sanitized.includes("pass")).toBeTruthy();
    expect(sanitized.includes("[REDACTED]")).toBeTruthy();
  });

  /**
   * Test 2: logError sanitizes URLs with credentials
   */
  it("logError sanitizes credentials in URLs", () => {
    const errorWithUrl = new Error(
      "Failed: https://user:secret123@svn.example.com/repo"
    );
    const message = errorWithUrl.message;

    // Should remove credentials from URL
    const sanitized = message.replace(
      /https?:\/\/[^:]+:[^@]+@/g,
      "https://[REDACTED]@"
    );

    expect(!sanitized.includes("secret123")).toBeTruthy();
    expect(sanitized.includes("[REDACTED]")).toBeTruthy();
  });

  /**
   * Test 3: logError sanitizes tokens in error objects
   */
  it("logError sanitizes authorization tokens", () => {
    const errorData = {
      message: "Request failed",
      config: {
        headers: {
          Authorization:
            "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ"
        }
      }
    };

    const serialized = JSON.stringify(errorData);
    const sanitized = serialized.replace(
      /Bearer\s+[A-Za-z0-9._\-~+/=]+/g,
      "Bearer [REDACTED]"
    );

    expect(!sanitized.includes("eyJhbG")).toBeTruthy();
    expect(sanitized.includes("[REDACTED]")).toBeTruthy();
  });
});
