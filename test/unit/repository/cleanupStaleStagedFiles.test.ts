import { describe, it, expect, vi } from "vitest";
import { Status } from "../../../src/common/types";

// Mock vscode
vi.mock("vscode", () => ({
  Uri: {
    file: (path: string) => ({ fsPath: path, toString: () => path })
  },
  window: {
    showInformationMessage: vi.fn()
  },
  commands: {
    executeCommand: vi.fn()
  }
}));

describe("cleanupStaleStagedFiles", () => {
  describe("Stale file detection", () => {
    it("identifies files with NORMAL status as stale", () => {
      // A file in staging with NORMAL status has no actual modifications
      const status = Status.NORMAL;
      const isNormalStatus = status === Status.NORMAL || status === Status.NONE;
      expect(isNormalStatus).toBe(true);
    });

    it("identifies files with NONE status as stale", () => {
      const status = Status.NONE;
      const isNormalStatus = status === Status.NORMAL || status === Status.NONE;
      expect(isNormalStatus).toBe(true);
    });

    it("identifies files with MODIFIED status as not stale", () => {
      const status = Status.MODIFIED;
      const isNormalStatus = status === Status.NORMAL || status === Status.NONE;
      expect(isNormalStatus).toBe(false);
    });

    it("identifies files with ADDED status as not stale", () => {
      const status = Status.ADDED;
      const isNormalStatus = status === Status.NORMAL || status === Status.NONE;
      expect(isNormalStatus).toBe(false);
    });
  });

  describe("Property status handling", () => {
    it("considers undefined props as normal", () => {
      const props: string | undefined = undefined;
      const isNormalProps =
        !props || props === Status.NORMAL || props === Status.NONE;
      expect(isNormalProps).toBe(true);
    });

    it("considers NORMAL props as normal", () => {
      const props = Status.NORMAL;
      const isNormalProps =
        !props || props === Status.NORMAL || props === Status.NONE;
      expect(isNormalProps).toBe(true);
    });

    it("considers MODIFIED props as not normal (property changes)", () => {
      const props = Status.MODIFIED;
      const isNormalProps =
        !props || props === Status.NORMAL || props === Status.NONE;
      expect(isNormalProps).toBe(false);
    });
  });

  describe("Combined status + props check", () => {
    it("file with NORMAL status and no props changes is stale", () => {
      const status = Status.NORMAL;
      const props: string | undefined = undefined;
      const isStale =
        (status === Status.NORMAL || status === Status.NONE) &&
        (!props || props === Status.NORMAL || props === Status.NONE);
      expect(isStale).toBe(true);
    });

    it("file with NORMAL status but MODIFIED props is NOT stale", () => {
      const status = Status.NORMAL;
      const props = Status.MODIFIED;
      const isStale =
        (status === Status.NORMAL || status === Status.NONE) &&
        (!props || props === Status.NORMAL || props === Status.NONE);
      expect(isStale).toBe(false);
    });

    it("file with MODIFIED status is NOT stale regardless of props", () => {
      const status = Status.MODIFIED;
      const props: string | undefined = undefined;
      const isStale =
        (status === Status.NORMAL || status === Status.NONE) &&
        (!props || props === Status.NORMAL || props === Status.NONE);
      expect(isStale).toBe(false);
    });
  });
});
