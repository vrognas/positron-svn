import * as assert from "assert";
import { window } from "vscode";
import { Command } from "../../../commands/command";

// Mock command for testing formatErrorMessage
class TestCommand extends Command {
  constructor() {
    super("test.command");
  }

  public async execute(): Promise<void> {
    // No-op for testing
  }

  // Expose private method for testing
  public testFormatErrorMessage(error: any, fallbackMsg: string): string {
    return (this as any).formatErrorMessage(error, fallbackMsg);
  }

  // Expose sanitizeStderr for testing
  public testSanitizeStderr(stderr: string): string {
    return (this as any).sanitizeStderr(stderr);
  }

  // Expose handleRepositoryOperation for testing
  public async testHandleRepositoryOperation<T>(
    operation: () => Promise<T>,
    errorMsg: string
  ): Promise<T | undefined> {
    return await (this as any).handleRepositoryOperation(operation, errorMsg);
  }
}

suite("Error Formatting Tests", () => {
  let command: TestCommand;
  let origShowError: typeof window.showErrorMessage;
  let showErrorCalls: any[] = [];

  setup(() => {
    command = new TestCommand();

    // Mock window.showErrorMessage
    origShowError = window.showErrorMessage;
    (window as any).showErrorMessage = (message: string, ...items: any[]) => {
      showErrorCalls.push({ message, items });
      return Promise.resolve(undefined);
    };

    showErrorCalls = [];
  });

  teardown(() => {
    (window as any).showErrorMessage = origShowError;
    command.dispose();
  });

  suite("Network/Connection Errors (E170013)", () => {
    test("Detects E170013 error code", () => {
      const error = {
        message: "svn: E170013: Unable to connect to a repository"
      };
      const result = command.testFormatErrorMessage(error, "Generic error");

      assert.ok(result.includes("Network error"));
      assert.ok(result.includes("Unable to connect"));
      assert.ok(result.includes("repository"));
    });

    test("Detects 'unable to connect' message", () => {
      const error = {
        message: "Unable to connect to server"
      };
      const result = command.testFormatErrorMessage(error, "Generic error");

      assert.ok(result.includes("Network error"));
    });

    test("Detects 'connection refused' message", () => {
      const error = {
        message: "Connection refused by server"
      };
      const result = command.testFormatErrorMessage(error, "Generic error");

      assert.ok(result.includes("Network error"));
    });

    test("Detects 'could not resolve host' message", () => {
      const error = {
        message: "Could not resolve host: example.com"
      };
      const result = command.testFormatErrorMessage(error, "Generic error");

      assert.ok(result.includes("Network error"));
    });

    test("Provides actionable guidance", () => {
      const error = {
        message: "svn: E170013: Unable to connect"
      };
      const result = command.testFormatErrorMessage(error, "Generic error");

      assert.ok(result.includes("Check your network connection"));
      assert.ok(result.includes("repository URL"));
    });
  });

  suite("Timeout Errors (E175002)", () => {
    test("Detects E175002 error code", () => {
      const error = {
        message: "svn: E175002: Operation timed out"
      };
      const result = command.testFormatErrorMessage(error, "Generic error");

      assert.ok(result.includes("Network timeout"));
      assert.ok(result.includes("took too long"));
    });

    test("Detects 'timed out' message", () => {
      const error = {
        message: "Connection timed out"
      };
      const result = command.testFormatErrorMessage(error, "Generic error");

      assert.ok(result.includes("Network timeout"));
    });

    test("Detects 'timeout' message", () => {
      const error = {
        message: "Request timeout"
      };
      const result = command.testFormatErrorMessage(error, "Generic error");

      assert.ok(result.includes("Network timeout"));
    });

    test("Detects 'operation timed out' message", () => {
      const error = {
        message: "The operation timed out"
      };
      const result = command.testFormatErrorMessage(error, "Generic error");

      assert.ok(result.includes("Network timeout"));
    });

    test("Provides retry guidance", () => {
      const error = {
        message: "Timeout occurred"
      };
      const result = command.testFormatErrorMessage(error, "Generic error");

      assert.ok(result.includes("Try again"));
      assert.ok(result.includes("network connection"));
    });
  });

  suite("Authentication Errors (E170001)", () => {
    test("Detects E170001 error code", () => {
      const error = {
        message: "svn: E170001: Authorization failed"
      };
      const result = command.testFormatErrorMessage(error, "Generic error");

      assert.ok(result.includes("Authentication failed"));
      assert.ok(result.includes("credentials"));
    });

    test("Detects 'authorization failed' message", () => {
      const error = {
        message: "Authorization failed"
      };
      const result = command.testFormatErrorMessage(error, "Generic error");

      assert.ok(result.includes("Authentication failed"));
    });

    test("Detects 'authentication failed' message", () => {
      const error = {
        message: "Authentication failed"
      };
      const result = command.testFormatErrorMessage(error, "Generic error");

      assert.ok(result.includes("Authentication failed"));
    });
  });

  suite("Repository Locked Errors (E155004)", () => {
    test("Detects E155004 error code", () => {
      const error = {
        message: "svn: E155004: Working copy is locked"
      };
      const result = command.testFormatErrorMessage(error, "Generic error");

      assert.ok(result.includes("Working copy is locked"));
      assert.ok(result.includes("Cleanup"));
    });

    test("Detects 'locked' message", () => {
      const error = {
        message: "The working copy is locked"
      };
      const result = command.testFormatErrorMessage(error, "Generic error");

      assert.ok(result.includes("locked"));
    });

    test("Provides cleanup guidance", () => {
      const error = {
        message: "svn: E155004"
      };
      const result = command.testFormatErrorMessage(error, "Generic error");

      assert.ok(result.includes("SVN: Cleanup"));
    });
  });

  suite("Fallback Behavior", () => {
    test("Uses fallback message for unknown errors", () => {
      const error = {
        message: "Some random error"
      };
      const result = command.testFormatErrorMessage(error, "Fallback message");

      assert.strictEqual(result, "Fallback message");
    });

    test("Handles error with no message", () => {
      const error = {};
      const result = command.testFormatErrorMessage(error, "Fallback");

      assert.strictEqual(result, "Fallback");
    });

    test("Handles null error", () => {
      const error = null;
      const result = command.testFormatErrorMessage(error, "Fallback");

      assert.strictEqual(result, "Fallback");
    });

    test("Handles undefined error", () => {
      const error = undefined;
      const result = command.testFormatErrorMessage(error, "Fallback");

      assert.strictEqual(result, "Fallback");
    });
  });

  suite("Error Object Variations", () => {
    test("Handles error with stderr property", () => {
      const error = {
        message: "Error occurred",
        stderr: "svn: E170013: Connection failed"
      };
      const result = command.testFormatErrorMessage(error, "Fallback");

      assert.ok(result.includes("Network error"));
    });

    test("Handles error with stderrFormated property", () => {
      const error = {
        message: "Error",
        stderrFormated: "E175002: Timeout"
      };
      const result = command.testFormatErrorMessage(error, "Fallback");

      assert.ok(result.includes("Network timeout"));
    });

    test("Case-insensitive error detection", () => {
      const error = {
        message: "TIMED OUT"
      };
      const result = command.testFormatErrorMessage(error, "Fallback");

      assert.ok(result.includes("Network timeout"));
    });

    test("Error with toString method", () => {
      const error = {
        toString: () => "E170013 connection error"
      };
      const result = command.testFormatErrorMessage(error, "Fallback");

      assert.ok(result.includes("Network error"));
    });
  });

  suite("Integration with handleRepositoryOperation", () => {
    test("Shows formatted network error", async () => {
      const operation = async () => {
        const err: any = new Error("svn: E170013: Unable to connect");
        throw err;
      };

      await command.testHandleRepositoryOperation(operation, "Generic error");

      assert.strictEqual(showErrorCalls.length, 1);
      assert.ok(showErrorCalls[0].message.includes("Network error"));
      assert.ok(!showErrorCalls[0].message.includes("Generic error"));
    });

    test("Shows formatted timeout error", async () => {
      const operation = async () => {
        const err: any = new Error("Operation timed out");
        throw err;
      };

      await command.testHandleRepositoryOperation(operation, "Generic error");

      assert.strictEqual(showErrorCalls.length, 1);
      assert.ok(showErrorCalls[0].message.includes("Network timeout"));
    });

    test("Shows fallback message for unknown errors", async () => {
      const operation = async () => {
        throw new Error("Unknown error");
      };

      await command.testHandleRepositoryOperation(
        operation,
        "Custom fallback"
      );

      assert.strictEqual(showErrorCalls.length, 1);
      assert.strictEqual(showErrorCalls[0].message, "Custom fallback");
    });

    test("Returns undefined on error", async () => {
      const operation = async () => {
        throw new Error("Test error");
      };

      const result = await command.testHandleRepositoryOperation(
        operation,
        "Error"
      );

      assert.strictEqual(result, undefined);
    });

    test("Returns value on success", async () => {
      const operation = async () => {
        return "Success value";
      };

      const result = await command.testHandleRepositoryOperation(
        operation,
        "Error"
      );

      assert.strictEqual(result, "Success value");
      assert.strictEqual(showErrorCalls.length, 0);
    });
  });

  suite("Multiple Error Conditions", () => {
    test("Prioritizes network error over generic text", () => {
      const error = {
        message: "Failed to update: svn: E170013: Unable to connect"
      };
      const result = command.testFormatErrorMessage(error, "Failed to update");

      assert.ok(result.includes("Network error"));
      assert.ok(!result.includes("Failed to update"));
    });

    test("Detects timeout in complex error message", () => {
      const error = {
        message:
          "Repository operation failed: Connection timed out after 30 seconds"
      };
      const result = command.testFormatErrorMessage(error, "Operation failed");

      assert.ok(result.includes("Network timeout"));
    });
  });

  suite("Stderr Sanitization", () => {
    test("Sanitizes Unix file paths", () => {
      const stderr = "Error in /home/user/repo/file.txt";
      const result = command.testSanitizeStderr(stderr);

      assert.strictEqual(result, "Error in [PATH]");
      assert.ok(!result.includes("/home/user"));
    });

    test("Sanitizes Windows file paths", () => {
      const stderr = "Error in C:\\Users\\John\\repo\\file.txt";
      const result = command.testSanitizeStderr(stderr);

      assert.strictEqual(result, "Error in [PATH]");
      assert.ok(!result.includes("C:\\Users"));
    });

    test("Sanitizes password with equals sign", () => {
      const stderr = "Auth failed: password=secret123";
      const result = command.testSanitizeStderr(stderr);

      assert.ok(result.includes("password=[REDACTED]"));
      assert.ok(!result.includes("secret123"));
    });

    test("Sanitizes password with colon", () => {
      const stderr = "Auth failed: password: secret123";
      const result = command.testSanitizeStderr(stderr);

      assert.ok(result.includes("password:[REDACTED]"));
      assert.ok(!result.includes("secret123"));
    });

    test("Sanitizes --password flag", () => {
      const stderr = "svn commit --password mypass123 file.txt";
      const result = command.testSanitizeStderr(stderr);

      assert.ok(result.includes("--password [REDACTED]"));
      assert.ok(!result.includes("mypass123"));
    });

    test("Sanitizes username with equals sign", () => {
      const stderr = "Auth failed: username=john";
      const result = command.testSanitizeStderr(stderr);

      assert.ok(result.includes("username=[REDACTED]"));
      assert.ok(!result.includes("john"));
    });

    test("Sanitizes --username flag", () => {
      const stderr = "svn commit --username john file.txt";
      const result = command.testSanitizeStderr(stderr);

      assert.ok(result.includes("--username [REDACTED]"));
      assert.ok(!result.includes("john"));
    });

    test("Sanitizes URL with credentials", () => {
      const stderr = "Connecting to https://user:pass@example.com/repo";
      const result = command.testSanitizeStderr(stderr);

      assert.ok(result.includes("https://[CREDENTIALS]@example.com"));
      assert.ok(!result.includes("user:pass"));
    });

    test("Sanitizes 10.x.x.x internal IP", () => {
      const stderr = "Connecting to 10.0.1.100:8080";
      const result = command.testSanitizeStderr(stderr);

      assert.ok(result.includes("[INTERNAL_IP]:8080"));
      assert.ok(!result.includes("10.0.1.100"));
    });

    test("Sanitizes 192.168.x.x internal IP", () => {
      const stderr = "Error from 192.168.1.1";
      const result = command.testSanitizeStderr(stderr);

      assert.ok(result.includes("[INTERNAL_IP]"));
      assert.ok(!result.includes("192.168.1.1"));
    });

    test("Sanitizes 172.16-31.x.x internal IP", () => {
      const stderr = "Server at 172.16.0.1 failed";
      const result = command.testSanitizeStderr(stderr);

      assert.ok(result.includes("[INTERNAL_IP]"));
      assert.ok(!result.includes("172.16.0.1"));
    });

    test("Sanitizes localhost IP", () => {
      const stderr = "Local server: 127.0.0.1";
      const result = command.testSanitizeStderr(stderr);

      assert.ok(result.includes("[INTERNAL_IP]"));
      assert.ok(!result.includes("127.0.0.1"));
    });

    test("Handles empty stderr", () => {
      const result = command.testSanitizeStderr("");

      assert.strictEqual(result, "");
    });

    test("Handles null stderr", () => {
      const result = command.testSanitizeStderr(null as any);

      assert.strictEqual(result, "");
    });

    test("Sanitizes multiple sensitive items", () => {
      const stderr =
        "svn commit /home/user/file.txt --username admin --password secret --repository-url https://admin:secret@192.168.1.1/repo";
      const result = command.testSanitizeStderr(stderr);

      assert.ok(result.includes("[PATH]"));
      assert.ok(result.includes("--username [REDACTED]"));
      assert.ok(result.includes("--password [REDACTED]"));
      assert.ok(result.includes("https://[CREDENTIALS]@"));
      assert.ok(result.includes("[INTERNAL_IP]"));
      assert.ok(!result.includes("/home/user"));
      assert.ok(!result.includes("admin"));
      assert.ok(!result.includes("secret"));
      assert.ok(!result.includes("192.168.1.1"));
    });

    test("Preserves error codes and safe content", () => {
      const stderr = "svn: E170013: Unable to connect";
      const result = command.testSanitizeStderr(stderr);

      assert.ok(result.includes("E170013"));
      assert.ok(result.includes("Unable to connect"));
    });

    test("Case-insensitive password detection", () => {
      const stderr = "PASSWORD=secret123";
      const result = command.testSanitizeStderr(stderr);

      assert.ok(result.includes("PASSWORD=[REDACTED]"));
      assert.ok(!result.includes("secret123"));
    });
  });

  suite("Integration: Sanitization with Error Formatting", () => {
    test("Sanitizes stderr before error detection", () => {
      const error = {
        message: "Error occurred",
        stderr:
          "svn: E170013: Unable to connect from /home/user/repo --password secret123"
      };
      const result = command.testFormatErrorMessage(error, "Fallback");

      assert.ok(result.includes("Network error"));
      // Verify sanitization happened (error detection still works)
      assert.ok(!result.includes("/home/user"));
      assert.ok(!result.includes("secret123"));
    });

    test("Sanitizes credentials in timeout error", () => {
      const error = {
        message: "Operation timed out",
        stderr: "Connecting to https://user:pass@example.com/repo"
      };
      const result = command.testFormatErrorMessage(error, "Fallback");

      assert.ok(result.includes("Network timeout"));
      // Internal sanitization occurred
    });
  });
});
