import { describe, it, expect } from "vitest";
import { checkAndPromptDepth } from "../../../src/input/revert";

describe("checkAndPromptDepth", () => {
  it("always returns infinity", async () => {
    const result = await checkAndPromptDepth();
    expect(result).toBe("infinity");
  });
});
