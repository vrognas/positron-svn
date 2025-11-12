import * as assert from "assert";
import { sanitizeError, sanitizeString } from "../../../security/errorSanitizer";

suite("Error Sanitizer - Security Tests", () => {
  suite("sanitizeString", () => {
    test("strips Windows paths", () => {
      const input = "Error in C:\\Users\\test\\file.txt";
      const output = sanitizeString(input);
      assert.ok(output.includes("[PATH]"));
      assert.ok(!output.includes("C:\\Users"));
    });

    test("strips Unix paths", () => {
      const input = "Failed to access /etc/passwd";
      const output = sanitizeString(input);
      assert.ok(output.includes("[PATH]"));
      assert.ok(!output.includes("/etc/passwd"));
    });

    test("strips URLs with credentials", () => {
      const input = "Connection to https://user:pass@svn.example.com/repo failed";
      const output = sanitizeString(input);
      assert.ok(output.includes("[DOMAIN]"));
      assert.ok(!output.includes("user:pass"));
      assert.ok(!output.includes("svn.example.com"));
    });

    test("strips IPv4 addresses", () => {
      const input = "Connection refused from 192.168.1.100";
      const output = sanitizeString(input);
      assert.ok(output.includes("[IP]"));
      assert.ok(!output.includes("192.168.1.100"));
    });

    test("strips IPv6 addresses", () => {
      const input = "Connecting to fe80::1";
      const output = sanitizeString(input);
      assert.ok(output.includes("[IP]"));
      assert.ok(!output.includes("fe80::1"));
    });

    test("redacts password in key=value format", () => {
      const input = "Auth failed with password=secret123";
      const output = sanitizeString(input);
      assert.ok(output.includes("[REDACTED]"));
      assert.ok(!output.includes("secret123"));
    });

    test("redacts API keys", () => {
      const input = "Request with api_key=abc123xyz";
      const output = sanitizeString(input);
      assert.ok(output.includes("[REDACTED]"));
      assert.ok(!output.includes("abc123xyz"));
    });

    test("redacts tokens", () => {
      const input = "Bearer token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
      const output = sanitizeString(input);
      assert.ok(output.includes("[REDACTED]"));
    });

    test("handles empty string", () => {
      const output = sanitizeString("");
      assert.strictEqual(output, "");
    });

    test("handles null or undefined", () => {
      const output1 = sanitizeString(null as any);
      const output2 = sanitizeString(undefined as any);
      // Should handle gracefully
      assert.ok(output1 === null || output1 === undefined || output1 === "");
      assert.ok(output2 === null || output2 === undefined || output2 === "");
    });

    test("preserves error codes", () => {
      const input = "svn: E170001: Authorization failed";
      const output = sanitizeString(input);
      assert.ok(output.includes("E170001"));
      assert.ok(output.includes("Authorization failed"));
    });
  });

  suite("sanitizeError", () => {
    test("sanitizes Error object", () => {
      const error = new Error("Failed to access /home/user/secret.txt");
      const output = sanitizeError(error);
      assert.ok(output.includes("[PATH]"));
      assert.ok(!output.includes("/home/user"));
    });

    test("sanitizes string input", () => {
      const input = "Connection to https://example.com failed";
      const output = sanitizeError(input);
      assert.ok(output.includes("[DOMAIN]"));
    });

    test("handles Error with no message", () => {
      const error = new Error();
      const output = sanitizeError(error);
      // Should not crash
      assert.ok(typeof output === "string");
    });
  });
});
