import { describe, it, expect, beforeEach } from "vitest";
import {
  ConventionalCommitService,
  ConventionalCommit
} from "../../../src/services/conventionalCommitService";

describe("ConventionalCommitService", () => {
  let service: ConventionalCommitService;

  beforeEach(() => {
    service = new ConventionalCommitService();
  });

  describe("format", () => {
    it("formats basic commit without scope", () => {
      const commit: ConventionalCommit = {
        type: "feat",
        description: "add dark mode"
      };
      expect(service.format(commit)).toBe("feat: add dark mode");
    });

    it("formats commit with scope", () => {
      const commit: ConventionalCommit = {
        type: "fix",
        scope: "ui",
        description: "button alignment"
      };
      expect(service.format(commit)).toBe("fix(ui): button alignment");
    });

    it("truncates description to 50 chars", () => {
      const commit: ConventionalCommit = {
        type: "feat",
        description:
          "this is a very long description that exceeds the maximum allowed length"
      };
      const result = service.format(commit);
      expect(result.length).toBeLessThanOrEqual(50);
      expect(result).toMatch(/\.\.\.$/);
    });
  });

  describe("parse", () => {
    it("parses basic conventional commit", () => {
      const result = service.parse("feat: add feature");
      expect(result).toEqual({
        type: "feat",
        scope: undefined,
        description: "add feature"
      });
    });

    it("parses commit with scope", () => {
      const result = service.parse("fix(api): resolve timeout");
      expect(result).toEqual({
        type: "fix",
        scope: "api",
        description: "resolve timeout"
      });
    });

    it("returns null for non-conventional message", () => {
      const result = service.parse("random commit message");
      expect(result).toBeNull();
    });

    it("returns null for empty message", () => {
      expect(service.parse("")).toBeNull();
    });
  });

  describe("getCommitTypes", () => {
    it("returns all commit types with icons", () => {
      const types = service.getCommitTypes();
      expect(types.length).toBeGreaterThan(0);
      expect(types.find(t => t.type === "feat")).toBeDefined();
      expect(types.find(t => t.type === "fix")).toBeDefined();
    });

    it("each type has icon and description", () => {
      const types = service.getCommitTypes();
      types.forEach(t => {
        expect(t.icon).toBeDefined();
        expect(t.label).toBeDefined();
      });
    });
  });

  describe("validateDescription", () => {
    it("accepts valid description under 50 chars", () => {
      expect(service.validateDescription("short message")).toBeUndefined();
    });

    it("rejects description over 50 chars", () => {
      const longDesc = "a".repeat(51);
      expect(service.validateDescription(longDesc)).toContain("50");
    });

    it("rejects empty description", () => {
      expect(service.validateDescription("")).toContain("empty");
    });
  });
});
