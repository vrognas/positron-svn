import { describe, it, expect } from "vitest";
import { parseUpdateOutput } from "../../../src/parser/updateParser";

/**
 * Repository Update Tests
 *
 * Tests for parseUpdateOutput behavior.
 * Tests all conflict types: text, tree, and property conflicts.
 */
describe("Repository Update", () => {
  describe("parseUpdateOutput()", () => {
    it("parses update with conflicts", () => {
      const output = `Updating '.':
U    src/file1.ts
C    src/conflicted.ts
Updated to revision 456.`;

      const result = parseUpdateOutput(output);
      expect(result.revision).toBe(456);
      expect(result.conflicts).toEqual(["src/conflicted.ts"]);
      expect(result.message).toBe("Updated to revision 456.");
    });

    it("detects tree conflicts (indented C)", () => {
      // Tree conflicts have spaces before C
      const output = `Updating '.':
U    src/file.ts
   C src/tree-conflict.ts
Updated to revision 100.`;

      const result = parseUpdateOutput(output);
      expect(result.conflicts).toContain("src/tree-conflict.ts");
    });

    it("handles already up-to-date", () => {
      const output = `Updating '.':
At revision 100.`;

      const result = parseUpdateOutput(output);
      expect(result.revision).toBe(100);
      expect(result.conflicts).toEqual([]);
    });

    it("handles empty/null input gracefully", () => {
      expect(parseUpdateOutput("")).toEqual({
        revision: null,
        conflicts: [],
        message: ""
      });
      expect(parseUpdateOutput(null as unknown as string)).toEqual({
        revision: null,
        conflicts: [],
        message: ""
      });
    });
  });
});
