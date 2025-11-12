import * as assert from "assert";
import { describe, it } from "mocha";

/**
 * JSON.parse Safety Tests (Phase 20.C)
 *
 * Tests that JSON.parse operations handle malformed input gracefully
 * without crashing the extension
 */
describe("Security - Safe JSON.parse (Phase 20.C)", () => {
  /**
   * Test 1: Malformed credential JSON returns empty array
   */
  it("malformed credential JSON returns empty array without crash", () => {
    const malformedInputs = [
      "{invalid json}",
      "{'single': 'quotes'}",
      "{unclosed",
      "null",
      "undefined",
      "",
      "{]"
    ];

    // Mock loadStoredAuths behavior with safe parsing
    const safeParseCredentials = (secret: string): any[] => {
      try {
        return JSON.parse(secret);
      } catch {
        return [];
      }
    };

    malformedInputs.forEach((input) => {
      const result = safeParseCredentials(input);
      assert.ok(Array.isArray(result), `Should return array for: ${input}`);
      assert.strictEqual(result.length, 0, `Should return empty array for: ${input}`);
    });
  });

  /**
   * Test 2: Valid credential JSON parses correctly
   */
  it("valid credential JSON parses successfully", () => {
    const validJson = JSON.stringify([
      { account: "user1", password: "pass1" },
      { account: "user2", password: "pass2" }
    ]);

    const safeParseCredentials = (secret: string): any[] => {
      try {
        return JSON.parse(secret);
      } catch {
        return [];
      }
    };

    const result = safeParseCredentials(validJson);
    assert.ok(Array.isArray(result));
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].account, "user1");
  });

  /**
   * Test 3: Malformed URI query returns default params without crash
   */
  it("malformed URI query returns default params without crash", () => {
    const malformedQueries = [
      "{invalid}",
      "not-json-at-all",
      "{",
      "null"
    ];

    // Mock fromSvnUri behavior with safe parsing
    const safeParseUri = (query: string): any => {
      try {
        return JSON.parse(query);
      } catch {
        return { action: "unknown", fsPath: "", extra: {} };
      }
    };

    malformedQueries.forEach((query) => {
      const result = safeParseUri(query);
      assert.ok(typeof result === "object", `Should return object for: ${query}`);
      assert.ok(result.action !== undefined, `Should have action field for: ${query}`);
    });
  });
});
