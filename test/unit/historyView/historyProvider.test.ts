// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import * as assert from "assert";
import {
  mapLogEntryToHistoryItem,
  createAuthorReference,
  calculateStatistics,
  computeParentIds
} from "../../../src/historyView/historyProvider";
import { ISvnLogEntry } from "../../../src/common/types";

suite("HistoryProvider", () => {
  suite("mapLogEntryToHistoryItem", () => {
    test("maps basic log entry fields", () => {
      const entry: ISvnLogEntry = {
        revision: "123",
        author: "alice",
        date: "2025-11-10T10:00:00.000000Z",
        msg: "Fix bug in parser\n\nDetailed description here",
        paths: []
      };

      const item = mapLogEntryToHistoryItem(entry, ["r122"]);

      assert.strictEqual(item.id, "r123");
      assert.strictEqual(item.displayId, "r123");
      assert.strictEqual(item.author, "alice");
      assert.strictEqual(item.subject, "Fix bug in parser");
      assert.strictEqual(
        item.message,
        "Fix bug in parser\n\nDetailed description here"
      );
      assert.deepStrictEqual(item.parentIds, ["r122"]);
    });

    test("handles empty message", () => {
      const entry: ISvnLogEntry = {
        revision: "1",
        author: "bob",
        date: "2025-01-01T00:00:00.000000Z",
        msg: "",
        paths: []
      };

      const item = mapLogEntryToHistoryItem(entry, []);

      assert.strictEqual(item.subject, "");
      assert.strictEqual(item.message, "");
    });

    test("extracts subject from first line of multiline message", () => {
      const entry: ISvnLogEntry = {
        revision: "50",
        author: "charlie",
        date: "2025-06-15T12:00:00.000000Z",
        msg: "feat: add new feature\r\n\r\nThis is a longer description\nwith multiple lines",
        paths: []
      };

      const item = mapLogEntryToHistoryItem(entry, ["r49"]);

      assert.strictEqual(item.subject, "feat: add new feature");
    });

    test("converts date to timestamp", () => {
      const entry: ISvnLogEntry = {
        revision: "10",
        author: "dave",
        date: "2025-11-10T10:00:00.000000Z",
        msg: "Test",
        paths: []
      };

      const item = mapLogEntryToHistoryItem(entry, ["r9"]);

      // Should be epoch milliseconds
      assert.strictEqual(typeof item.timestamp, "number");
      assert.strictEqual(
        item.timestamp,
        new Date("2025-11-10T10:00:00.000000Z").getTime()
      );
    });

    test("includes author reference badge", () => {
      const entry: ISvnLogEntry = {
        revision: "100",
        author: "eve",
        date: "2025-11-10T10:00:00.000000Z",
        msg: "Update",
        paths: []
      };

      const item = mapLogEntryToHistoryItem(entry, ["r99"]);

      assert.ok(item.references, "Should have references");
      assert.strictEqual(item.references!.length, 1);
      assert.strictEqual(item.references![0]!.name, "eve");
      assert.strictEqual(item.references![0]!.category, "authors");
    });
  });

  suite("createAuthorReference", () => {
    test("creates reference with author name", () => {
      const ref = createAuthorReference("alice");

      assert.strictEqual(ref.id, "author/alice");
      assert.strictEqual(ref.name, "alice");
      assert.strictEqual(ref.category, "authors");
    });

    test("handles empty author", () => {
      const ref = createAuthorReference("");

      assert.strictEqual(ref.id, "author/");
      assert.strictEqual(ref.name, "");
    });
  });

  suite("calculateStatistics", () => {
    test("counts files correctly", () => {
      const paths = [
        { _: "/trunk/a.txt", action: "A", kind: "file" },
        { _: "/trunk/b.txt", action: "M", kind: "file" },
        { _: "/trunk/c.txt", action: "D", kind: "file" }
      ];

      const stats = calculateStatistics(paths);

      assert.strictEqual(stats.files, 3);
    });

    test("returns zero for empty paths", () => {
      const stats = calculateStatistics([]);

      assert.strictEqual(stats.files, 0);
    });

    test("returns zero for undefined paths", () => {
      const stats = calculateStatistics(undefined);

      assert.strictEqual(stats.files, 0);
    });
  });

  suite("computeParentIds", () => {
    test("returns chronological parent only when tracking disabled", () => {
      const entry: ISvnLogEntry = {
        revision: "10",
        author: "alice",
        date: "2025-01-01T00:00:00Z",
        msg: "Test",
        paths: []
      };

      const parentIds = computeParentIds(entry, "r9", undefined);

      assert.deepStrictEqual(parentIds, ["r9"]);
    });

    test("adds author connection when tracking enabled", () => {
      const authorLastCommit = new Map<string, string>();
      authorLastCommit.set("alice", "r5");

      const entry: ISvnLogEntry = {
        revision: "10",
        author: "alice",
        date: "2025-01-01T00:00:00Z",
        msg: "Test",
        paths: []
      };

      const parentIds = computeParentIds(entry, "r9", authorLastCommit);

      // Should have both chronological parent and author's previous commit
      assert.deepStrictEqual(parentIds, ["r9", "r5"]);
      // Should update tracking
      assert.strictEqual(authorLastCommit.get("alice"), "r10");
    });

    test("skips duplicate when author parent equals chronological parent", () => {
      const authorLastCommit = new Map<string, string>();
      authorLastCommit.set("alice", "r9");

      const entry: ISvnLogEntry = {
        revision: "10",
        author: "alice",
        date: "2025-01-01T00:00:00Z",
        msg: "Test",
        paths: []
      };

      const parentIds = computeParentIds(entry, "r9", authorLastCommit);

      // Should not duplicate r9
      assert.deepStrictEqual(parentIds, ["r9"]);
    });
  });
});
