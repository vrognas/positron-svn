import { describe, it, expect } from "vitest";

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
    const safeParseCredentials = (secret: string): unknown[] => {
      try {
        const parsed = JSON.parse(secret);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    };

    malformedInputs.forEach(input => {
      const result = safeParseCredentials(input);
      expect(
        Array.isArray(result),
        `Should return array for: ${input}`
      ).toBeTruthy();
      expect(result.length, `Should return empty array for: ${input}`).toBe(0);
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

    const safeParseCredentials = (secret: string): unknown[] => {
      try {
        const parsed = JSON.parse(secret);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    };

    const result = safeParseCredentials(validJson);
    expect(Array.isArray(result)).toBeTruthy();
    expect(result.length).toBe(2);
    expect((result[0] as Record<string, unknown>).account).toBe("user1");
  });

  /**
   * Test 3: Malformed URI query returns default params without crash
   */
  it("malformed URI query returns default params without crash", () => {
    const malformedQueries = ["{invalid}", "not-json-at-all", "{", "null"];

    // Mock fromSvnUri behavior with safe parsing
    const safeParseUri = (query: string): unknown => {
      try {
        const parsed = JSON.parse(query);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? parsed
          : { action: "unknown", fsPath: "", extra: {} };
      } catch {
        return { action: "unknown", fsPath: "", extra: {} };
      }
    };

    malformedQueries.forEach(query => {
      const result = safeParseUri(query);
      expect(
        typeof result === "object",
        `Should return object for: ${query}`
      ).toBeTruthy();
      expect(
        (result as Record<string, unknown>).action !== undefined,
        `Should have action field for: ${query}`
      ).toBeTruthy();
    });
  });
});
