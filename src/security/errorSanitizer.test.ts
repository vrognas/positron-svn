import {
  sanitizeError,
  sanitizeString,
  sanitizeObject,
  createSanitizedErrorLog
} from "./errorSanitizer";

describe("errorSanitizer", () => {
  // Test 1: Windows and Unix paths
  describe("path sanitization", () => {
    test("sanitizes Windows paths", () => {
      const input = "Error at C:\\Users\\vikto\\projects\\test\\file.ts line 42";
      const output = sanitizeString(input);
      expect(output).toContain("[PATH]");
      expect(output).not.toContain("C:\\");
      expect(output).not.toContain("vikto");
    });

    test("sanitizes Unix paths", () => {
      const input = "Error in /home/user/projects/test/file.ts";
      const output = sanitizeString(input);
      expect(output).toContain("[PATH]");
      expect(output).not.toContain("/home");
    });

    test("preserves relative path markers", () => {
      const input = "See ../README.md for details";
      const output = sanitizeString(input);
      expect(output).toBeDefined();
    });
  });

  // Test 2: URLs, IPs, and credentials
  describe("URL and IP sanitization", () => {
    test("sanitizes HTTPS URLs", () => {
      const input = "Failed to connect to https://api.github.com/repos/test";
      const output = sanitizeString(input);
      expect(output).toContain("[DOMAIN]");
      expect(output).not.toContain("github.com");
    });

    test("sanitizes HTTP URLs", () => {
      const input = "Server response from http://internal.local:8080/api";
      const output = sanitizeString(input);
      expect(output).toContain("[DOMAIN]");
      expect(output).not.toContain("internal.local");
    });

    test("sanitizes IPv4 addresses", () => {
      const input = "Connection refused at 192.168.1.100:8080";
      const output = sanitizeString(input);
      expect(output).toContain("[IP]");
      expect(output).not.toContain("192.168");
    });

    test("sanitizes IPv6 addresses", () => {
      const input = "Connected to fe80::1 on port 443";
      const output = sanitizeString(input);
      expect(output).toContain("[IP]");
      expect(output).not.toContain("fe80");
    });
  });

  // Test 3: Credentials and tokens
  describe("credential sanitization", () => {
    test("sanitizes password in key=value format", () => {
      const input = "Auth failed: password=MyP@ssw0rd123 retry";
      const output = sanitizeString(input);
      expect(output).toContain("[REDACTED]");
      expect(output).not.toContain("MyP@ssw0rd");
    });

    test("sanitizes API keys", () => {
      const input = "Using api_key=sk_live_51234567890abcdef";
      const output = sanitizeString(input);
      expect(output).toContain("[REDACTED]");
      expect(output).not.toContain("sk_live");
    });

    test("sanitizes tokens in query strings", () => {
      const input = "URL: /api/endpoint?token=eyJhbGciOiJIUzI1NiI&password=secret";
      const output = sanitizeString(input);
      expect(output).toContain("token=[REDACTED]");
      expect(output).toContain("password=[REDACTED]");
      expect(output).not.toContain("eyJhbGciOiJIUzI1NiI");
    });

    test("sanitizes Bearer tokens", () => {
      const input = "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
      const output = sanitizeString(input);
      expect(output).toContain("Bearer [REDACTED]");
      expect(output).not.toContain("eyJhbGciOiJIUzI1NiI");
    });

    test("sanitizes Basic auth", () => {
      const input = "Auth header: Basic dXNlcjpwYXNzd29yZA==";
      const output = sanitizeString(input);
      expect(output).toContain("Basic [REDACTED]");
      expect(output).not.toContain("dXNlcjpwYXNzd29yZA==");
    });

    test("sanitizes AWS keys", () => {
      const input = "Found credentials: AKIA1234567890ABCDEF";
      const output = sanitizeString(input);
      expect(output).toContain("[AWS_KEY]");
      expect(output).not.toContain("AKIA");
    });
  });

  // Test 4: Email and UUID sanitization
  describe("identifier sanitization", () => {
    test("sanitizes email addresses", () => {
      const input = "Error reported by user@example.com";
      const output = sanitizeString(input);
      expect(output).toContain("[EMAIL]");
      expect(output).not.toContain("user@");
    });

    test("sanitizes UUIDs", () => {
      const input = "Request ID: 550e8400-e29b-41d4-a716-446655440000";
      const output = sanitizeString(input);
      expect(output).toContain("[UUID]");
      expect(output).not.toContain("550e8400");
    });

    test("preserves non-secret hashes", () => {
      const input = "Commit hash: abc123def456";
      const output = sanitizeString(input);
      expect(output).toContain("abc123def456");
    });
  });

  // Test 5: Integration with Error objects
  describe("Error object sanitization", () => {
    test("sanitizes Error with message", () => {
      const error = new Error(
        "SVN error at C:\\repo\\file.ts with password=secret123"
      );
      const output = sanitizeError(error);
      expect(output).toContain("[PATH]");
      expect(output).toContain("[REDACTED]");
    });

    test("sanitizes object with nested sensitive data", () => {
      const obj = {
        message: "Failed at /app/server with token=abc123",
        code: 403,
        details: {
          url: "https://api.example.com/auth",
          ip: "10.0.0.1"
        }
      };
      const sanitized = sanitizeObject(obj);
      expect(JSON.stringify(sanitized)).toContain("[PATH]");
      expect(JSON.stringify(sanitized)).toContain("[DOMAIN]");
      expect(JSON.stringify(sanitized)).toContain("[IP]");
    });

    test("preserves non-string fields", () => {
      const obj = {
        message: "Error from /home/user",
        exitCode: 1,
        retry: true,
        timeout: null
      };
      const sanitized = sanitizeObject(obj);
      expect(sanitized.exitCode).toBe(1);
      expect(sanitized.retry).toBe(true);
      expect(sanitized.timeout).toBe(null);
    });
  });

  // Test 6: SvnError integration
  describe("SvnError sanitization", () => {
    test("creates sanitized error log", () => {
      const mockSvnError = {
        message: "SVN error at C:\\repo",
        svnCommand: "svn update C:\\projects\\test",
        stdout: "Status from 192.168.1.1",
        stderr: "Auth error with password=pwd123",
        exitCode: 1,
        svnErrorCode: "E200009"
      };
      const log = createSanitizedErrorLog(mockSvnError);
      expect(log.message).toContain("[PATH]");
      expect(log.svnCommand).toContain("[PATH]");
      expect(log.stdout).toContain("[IP]");
      expect(log.stderr).toContain("[REDACTED]");
      expect(log.exitCode).toBe(1);
    });

    test("sanitizes stack traces", () => {
      const error = new Error(
        "Auth error at /app/auth/login.ts with token=abc123"
      );
      const log = createSanitizedErrorLog(error);
      if (log.stack) {
        expect(log.stack).toContain("[PATH]");
        expect(log.stack).toContain("[REDACTED]");
      }
    });
  });

  // Test 7: Edge cases
  describe("edge cases", () => {
    test("handles empty strings", () => {
      expect(sanitizeString("")).toBe("");
      expect(sanitizeError("")).toBe("");
    });

    test("handles null/undefined gracefully", () => {
      expect(sanitizeObject(null as any)).toBe(null);
      expect(sanitizeObject(undefined as any)).toBe(undefined);
    });

    test("preserves readable error structure", () => {
      const input =
        "Error: Connection failed. Stack trace:\n" +
        "  at /home/user/app.ts:42\n" +
        "  at processRequest\n" +
        "Details: 192.168.1.1:8080 auth=failed";
      const output = sanitizeString(input);
      expect(output).toContain("Error:");
      expect(output).toContain("Connection failed");
      expect(output).toContain("Stack trace");
      expect(output).toContain("[PATH]");
      expect(output).toContain("[IP]");
      expect(output).not.toContain("/home/user");
      expect(output).not.toContain("192.168");
    });

    test("handles multiple sensitive patterns in single line", () => {
      const input =
        "Failed to authenticate user@example.com from 10.20.30.40 " +
        "with token=xyz789 at C:\\app\\auth.ts";
      const output = sanitizeString(input);
      expect(output).toContain("[EMAIL]");
      expect(output).toContain("[IP]");
      expect(output).toContain("[REDACTED]");
      expect(output).toContain("[PATH]");
    });

    test("handles repeated sensitive data", () => {
      const input =
        "Retrying with password=secret at 192.168.1.1 " +
        "then again with password=secret at 192.168.1.2";
      const output = sanitizeString(input);
      const redactedCount = (output.match(/\[REDACTED\]/g) || []).length;
      const ipCount = (output.match(/\[IP\]/g) || []).length;
      expect(redactedCount).toBeGreaterThanOrEqual(2);
      expect(ipCount).toBeGreaterThanOrEqual(2);
    });
  });
});
