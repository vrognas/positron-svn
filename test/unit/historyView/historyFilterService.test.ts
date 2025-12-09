import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  HistoryFilterService,
  IHistoryFilter,
  buildSvnLogArgs,
  filterEntriesByAction
} from "../../../src/historyView/historyFilter";
import { ISvnLogEntry, ISvnLogEntryPath } from "../../../src/common/types";

describe("HistoryFilterService", () => {
  let service: HistoryFilterService;

  beforeEach(() => {
    service = new HistoryFilterService();
  });

  describe("filter state management", () => {
    it("starts with no active filter", () => {
      expect(service.hasActiveFilter()).toBe(false);
      expect(service.getFilter()).toBeUndefined();
    });

    it("sets filter and emits change event", () => {
      const listener = vi.fn();
      service.onDidChangeFilter(listener);

      const filter: IHistoryFilter = { message: "bugfix" };
      service.setFilter(filter);

      expect(service.hasActiveFilter()).toBe(true);
      expect(service.getFilter()).toEqual(filter);
      expect(listener).toHaveBeenCalledWith(filter);
    });

    it("clears filter and emits change event", () => {
      const listener = vi.fn();
      service.setFilter({ message: "test" });

      service.onDidChangeFilter(listener);
      service.clearFilter();

      expect(service.hasActiveFilter()).toBe(false);
      expect(service.getFilter()).toBeUndefined();
      expect(listener).toHaveBeenCalledWith(undefined);
    });

    it("updates partial filter fields", () => {
      service.setFilter({ message: "test", author: "john" });
      service.updateFilter({ author: "jane" });

      expect(service.getFilter()).toEqual({ message: "test", author: "jane" });
    });
  });

  describe("filter cache", () => {
    it("returns cached results for same filter", () => {
      const entries: ISvnLogEntry[] = [
        createEntry("1", "john", "fix bug"),
        createEntry("2", "jane", "add feature")
      ];

      // First call - should cache
      const result1 = service.filterEntries(entries, { author: "john" });
      // Second call - should return cached
      const result2 = service.filterEntries(entries, { author: "john" });

      expect(result1).toEqual(result2);
      expect(result1).toHaveLength(1);
    });

    it("invalidates cache when filter changes", () => {
      const entries: ISvnLogEntry[] = [
        createEntry("1", "john", "fix bug"),
        createEntry("2", "jane", "add feature")
      ];

      service.filterEntries(entries, { author: "john" });
      service.clearFilter();

      // Cache should be cleared after filter change
      expect(service.getCacheSize()).toBe(0);
    });

    it("evicts oldest entries when cache is full", () => {
      const entries: ISvnLogEntry[] = [createEntry("1", "test", "msg")];

      // Fill cache beyond max size
      for (let i = 0; i < 60; i++) {
        service.filterEntries(entries, { message: `filter${i}` });
      }

      // Cache should be capped at max size (50)
      expect(service.getCacheSize()).toBeLessThanOrEqual(50);
    });
  });

  describe("filter description", () => {
    it("returns empty string for no filter", () => {
      expect(service.getFilterDescription()).toBe("");
    });

    it("describes single filter", () => {
      service.setFilter({ message: "bugfix" });
      expect(service.getFilterDescription()).toContain("message");
    });

    it("describes multiple filters", () => {
      service.setFilter({ message: "bugfix", author: "john" });
      const desc = service.getFilterDescription();
      expect(desc).toContain("message");
      expect(desc).toContain("author");
    });
  });
});

describe("buildSvnLogArgs", () => {
  it("returns empty array for no filter", () => {
    expect(buildSvnLogArgs({})).toEqual([]);
  });

  it("builds --search arg for message filter", () => {
    const args = buildSvnLogArgs({ message: "bugfix" });
    expect(args).toContain("--search");
    expect(args).toContain("bugfix");
  });

  it("builds --search arg for author filter", () => {
    const args = buildSvnLogArgs({ author: "john" });
    expect(args).toContain("--search");
    expect(args).toContain("john");
  });

  it("builds --search arg for path filter", () => {
    const args = buildSvnLogArgs({ path: "src/utils" });
    expect(args).toContain("--search");
    expect(args).toContain("src/utils");
  });

  it("builds -r arg for revision range", () => {
    const args = buildSvnLogArgs({ revisionFrom: 100, revisionTo: 200 });
    expect(args).toContain("-r");
    expect(args).toContain("200:100");
  });

  it("builds -r arg for date range", () => {
    const dateFrom = new Date("2024-01-01");
    const dateTo = new Date("2024-12-31");
    const args = buildSvnLogArgs({ dateFrom, dateTo });
    expect(args).toContain("-r");
    expect(args[args.indexOf("-r") + 1]).toMatch(/\{.*\}:\{.*\}/);
  });

  it("combines multiple --search args", () => {
    const args = buildSvnLogArgs({ message: "fix", author: "john" });
    const searchCount = args.filter(a => a === "--search").length;
    expect(searchCount).toBe(2);
  });

  it("does not include action filter in args (client-side only)", () => {
    const args = buildSvnLogArgs({ actions: ["A", "M"] });
    expect(args).toEqual([]);
  });
});

describe("filterEntriesByAction", () => {
  const entries: ISvnLogEntry[] = [
    createEntryWithPaths("1", "john", "add files", [
      { _: "/trunk/new.txt", action: "A", kind: "file" }
    ]),
    createEntryWithPaths("2", "jane", "modify files", [
      { _: "/trunk/old.txt", action: "M", kind: "file" }
    ]),
    createEntryWithPaths("3", "john", "delete files", [
      { _: "/trunk/obsolete.txt", action: "D", kind: "file" }
    ]),
    createEntryWithPaths("4", "jane", "mixed changes", [
      { _: "/trunk/a.txt", action: "A", kind: "file" },
      { _: "/trunk/b.txt", action: "M", kind: "file" }
    ])
  ];

  it("returns all entries when no action filter", () => {
    const result = filterEntriesByAction(entries, undefined);
    expect(result).toHaveLength(4);
  });

  it("filters by single action type", () => {
    const result = filterEntriesByAction(entries, ["A"]);
    expect(result).toHaveLength(2); // entries 1 and 4 have "A" actions
    expect(result.map(e => e.revision)).toEqual(["1", "4"]);
  });

  it("filters by multiple action types", () => {
    const result = filterEntriesByAction(entries, ["A", "D"]);
    expect(result).toHaveLength(3); // entries 1, 3, and 4
  });

  it("returns empty array when no matches", () => {
    const result = filterEntriesByAction(entries, ["R"]);
    expect(result).toHaveLength(0);
  });
});

// Helper functions
function createEntry(
  revision: string,
  author: string,
  msg: string
): ISvnLogEntry {
  return {
    revision,
    author,
    msg,
    date: new Date().toISOString(),
    paths: []
  };
}

function createEntryWithPaths(
  revision: string,
  author: string,
  msg: string,
  paths: ISvnLogEntryPath[]
): ISvnLogEntry {
  return {
    revision,
    author,
    msg,
    date: new Date().toISOString(),
    paths
  };
}
