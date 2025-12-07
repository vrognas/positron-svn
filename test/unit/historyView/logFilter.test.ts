import { describe, it, expect } from "vitest";
import { ISvnLogEntry } from "../../../src/common/types";
import {
  filterLogEntries,
  ILogFilter,
  hasActiveFilter,
  getFilterSummary,
  ACTION_LABELS
} from "../../../src/historyView/logFilter";

/**
 * TDD Tests: Log Filter Feature
 * Tests filter by author, date range, and path
 */

// Sample log entries for testing
const sampleEntries: ISvnLogEntry[] = [
  {
    revision: "100",
    author: "alice",
    date: "2024-06-15T10:00:00.000000Z",
    msg: "Feature A",
    paths: [{ _: "/trunk/src/a.ts", action: "A", kind: "file" }]
  },
  {
    revision: "99",
    author: "bob",
    date: "2024-06-10T14:30:00.000000Z",
    msg: "Fix bug",
    paths: [{ _: "/trunk/src/b.ts", action: "M", kind: "file" }]
  },
  {
    revision: "98",
    author: "alice",
    date: "2024-05-20T09:00:00.000000Z",
    msg: "Initial setup",
    paths: [
      { _: "/trunk/src/a.ts", action: "A", kind: "file" },
      { _: "/trunk/docs/readme.md", action: "A", kind: "file" }
    ]
  },
  {
    revision: "97",
    author: "charlie",
    date: "2024-04-01T08:00:00.000000Z",
    msg: "Config change",
    paths: [{ _: "/trunk/config.json", action: "M", kind: "file" }]
  }
];

describe("Log Filter - Author", () => {
  it("filters entries by single author", () => {
    const filter: ILogFilter = { author: "alice" };
    const result = filterLogEntries(sampleEntries, filter);

    expect(result.length).toBe(2);
    expect(result[0]!.revision).toBe("100");
    expect(result[1]!.revision).toBe("98");
    expect(result.every(e => e.author === "alice")).toBe(true);
  });

  it("author filter is case-insensitive", () => {
    const filter: ILogFilter = { author: "ALICE" };
    const result = filterLogEntries(sampleEntries, filter);

    expect(result.length).toBe(2);
    expect(result.every(e => e.author === "alice")).toBe(true);
  });

  it("returns empty for non-existent author", () => {
    const filter: ILogFilter = { author: "nobody" };
    const result = filterLogEntries(sampleEntries, filter);

    expect(result.length).toBe(0);
  });
});

describe("Log Filter - Date Range", () => {
  it("filters entries within date range", () => {
    const filter: ILogFilter = {
      dateFrom: "2024-06-01",
      dateTo: "2024-06-30"
    };
    const result = filterLogEntries(sampleEntries, filter);

    expect(result.length).toBe(2);
    expect(result[0]!.revision).toBe("100");
    expect(result[1]!.revision).toBe("99");
  });

  it("filters entries after dateFrom only", () => {
    const filter: ILogFilter = { dateFrom: "2024-05-01" };
    const result = filterLogEntries(sampleEntries, filter);

    expect(result.length).toBe(3);
    expect(result.map(e => e.revision)).toEqual(["100", "99", "98"]);
  });

  it("filters entries before dateTo only", () => {
    const filter: ILogFilter = { dateTo: "2024-05-31" };
    const result = filterLogEntries(sampleEntries, filter);

    expect(result.length).toBe(2);
    expect(result.map(e => e.revision)).toEqual(["98", "97"]);
  });

  it("dateTo is inclusive (includes entries on that day)", () => {
    // Entry 98 is on 2024-05-20
    const filter: ILogFilter = { dateTo: "2024-05-20" };
    const result = filterLogEntries(sampleEntries, filter);

    expect(result.some(e => e.revision === "98")).toBe(true);
  });
});

describe("Log Filter - Path", () => {
  it("filters entries by path substring", () => {
    const filter: ILogFilter = { path: "/trunk/src" };
    const result = filterLogEntries(sampleEntries, filter);

    expect(result.length).toBe(3);
    expect(result.map(e => e.revision)).toEqual(["100", "99", "98"]);
  });

  it("filters entries by specific file", () => {
    const filter: ILogFilter = { path: "config.json" };
    const result = filterLogEntries(sampleEntries, filter);

    expect(result.length).toBe(1);
    expect(result[0]!.revision).toBe("97");
  });

  it("path filter is case-insensitive", () => {
    const filter: ILogFilter = { path: "README.MD" };
    const result = filterLogEntries(sampleEntries, filter);

    expect(result.length).toBe(1);
    expect(result[0]!.revision).toBe("98");
  });
});

describe("Log Filter - Combined Filters", () => {
  it("combines author and date range filters", () => {
    const filter: ILogFilter = {
      author: "alice",
      dateFrom: "2024-06-01"
    };
    const result = filterLogEntries(sampleEntries, filter);

    expect(result.length).toBe(1);
    expect(result[0]!.revision).toBe("100");
    expect(result[0]!.author).toBe("alice");
  });

  it("combines author and path filters", () => {
    const filter: ILogFilter = {
      author: "alice",
      path: "docs"
    };
    const result = filterLogEntries(sampleEntries, filter);

    expect(result.length).toBe(1);
    expect(result[0]!.revision).toBe("98");
  });

  it("returns empty when no entries match all filters", () => {
    const filter: ILogFilter = {
      author: "bob",
      path: "config"
    };
    const result = filterLogEntries(sampleEntries, filter);

    expect(result.length).toBe(0);
  });
});

describe("Log Filter - Edge Cases", () => {
  it("returns all entries when no filters applied", () => {
    const filter: ILogFilter = {};
    const result = filterLogEntries(sampleEntries, filter);

    expect(result.length).toBe(sampleEntries.length);
  });

  it("handles empty entries array", () => {
    const filter: ILogFilter = { author: "alice" };
    const result = filterLogEntries([], filter);

    expect(result.length).toBe(0);
  });

  it("handles entries with no paths", () => {
    const entriesWithNoPath: ISvnLogEntry[] = [
      {
        revision: "50",
        author: "alice",
        date: "2024-01-01T00:00:00.000000Z",
        msg: "No paths",
        paths: []
      }
    ];

    // Path filter excludes entries with no matching paths
    const pathFilter: ILogFilter = { path: "anything" };
    expect(filterLogEntries(entriesWithNoPath, pathFilter).length).toBe(0);

    // Author filter still works
    const authorFilter: ILogFilter = { author: "alice" };
    expect(filterLogEntries(entriesWithNoPath, authorFilter).length).toBe(1);
  });
});

describe("Log Filter - Helper Functions", () => {
  it("hasActiveFilter returns false for empty filter", () => {
    expect(hasActiveFilter({})).toBe(false);
    expect(hasActiveFilter(undefined)).toBe(false);
  });

  it("hasActiveFilter returns true when any filter is set", () => {
    expect(hasActiveFilter({ author: "alice" })).toBe(true);
    expect(hasActiveFilter({ dateFrom: "2024-01-01" })).toBe(true);
    expect(hasActiveFilter({ dateTo: "2024-12-31" })).toBe(true);
    expect(hasActiveFilter({ path: "/trunk" })).toBe(true);
  });

  it("getFilterSummary returns empty string for no filters", () => {
    expect(getFilterSummary({})).toBe("");
    expect(getFilterSummary(undefined)).toBe("");
  });

  it("getFilterSummary formats author filter", () => {
    expect(getFilterSummary({ author: "alice" })).toBe("author:alice");
  });

  it("getFilterSummary formats date range", () => {
    expect(
      getFilterSummary({ dateFrom: "2024-01-01", dateTo: "2024-12-31" })
    ).toBe("2024-01-01 to 2024-12-31");
  });

  it("getFilterSummary formats single date", () => {
    expect(getFilterSummary({ dateFrom: "2024-01-01" })).toBe(
      "from 2024-01-01"
    );
    expect(getFilterSummary({ dateTo: "2024-12-31" })).toBe("until 2024-12-31");
  });

  it("getFilterSummary formats path filter", () => {
    expect(getFilterSummary({ path: "/trunk/src" })).toBe("path:/trunk/src");
  });

  it("getFilterSummary combines multiple filters", () => {
    const summary = getFilterSummary({
      author: "alice",
      dateFrom: "2024-01-01",
      dateTo: "2024-12-31",
      path: "/trunk"
    });
    expect(summary).toBe(
      "author:alice | 2024-01-01 to 2024-12-31 | path:/trunk"
    );
  });
});

describe("Log Filter - Action Types", () => {
  it("filters by single action type", () => {
    const filter: ILogFilter = { actions: ["A"] };
    const result = filterLogEntries(sampleEntries, filter);

    // Only entries with at least one Added file
    expect(result.length).toBe(2);
    expect(result.map(e => e.revision)).toEqual(["100", "98"]);
  });

  it("filters by multiple action types", () => {
    const filter: ILogFilter = { actions: ["M"] };
    const result = filterLogEntries(sampleEntries, filter);

    // Entries with Modified files: 99, 97
    expect(result.length).toBe(2);
    expect(result.map(e => e.revision)).toEqual(["99", "97"]);
  });

  it("filters by A or M actions", () => {
    const filter: ILogFilter = { actions: ["A", "M"] };
    const result = filterLogEntries(sampleEntries, filter);

    // All entries have either A or M
    expect(result.length).toBe(4);
  });

  it("returns empty for non-matching action", () => {
    const filter: ILogFilter = { actions: ["D"] };
    const result = filterLogEntries(sampleEntries, filter);

    // No entries have deleted files in our sample
    expect(result.length).toBe(0);
  });

  it("empty actions array returns all entries", () => {
    const filter: ILogFilter = { actions: [] };
    const result = filterLogEntries(sampleEntries, filter);

    expect(result.length).toBe(sampleEntries.length);
  });

  it("combines action filter with author filter", () => {
    const filter: ILogFilter = { author: "alice", actions: ["A"] };
    const result = filterLogEntries(sampleEntries, filter);

    // Alice with Added files: 100, 98
    expect(result.length).toBe(2);
    expect(result.every(e => e.author === "alice")).toBe(true);
  });

  it("hasActiveFilter returns true for actions", () => {
    expect(hasActiveFilter({ actions: ["A"] })).toBe(true);
    expect(hasActiveFilter({ actions: ["A", "M"] })).toBe(true);
    expect(hasActiveFilter({ actions: [] })).toBe(false);
  });

  it("getFilterSummary formats action filter", () => {
    expect(getFilterSummary({ actions: ["A"] })).toBe("Added");
    expect(getFilterSummary({ actions: ["M", "D"] })).toBe("Modified+Deleted");
    expect(getFilterSummary({ actions: ["A", "M", "D", "R"] })).toBe(
      "Added+Modified+Deleted+Replaced"
    );
  });

  it("ACTION_LABELS contains all standard actions", () => {
    expect(ACTION_LABELS["A"]).toBe("Added");
    expect(ACTION_LABELS["M"]).toBe("Modified");
    expect(ACTION_LABELS["D"]).toBe("Deleted");
    expect(ACTION_LABELS["R"]).toBe("Replaced");
  });
});
