import { describe, it, expect, beforeEach } from "vitest";
import { RevisionCache } from "../../../src/historyView/revisionCache";
import { ISvnLogEntry } from "../../../src/common/types";

describe("RevisionCache", () => {
  let cache: RevisionCache;
  const repoUrl = "https://svn.example.com/repo";

  beforeEach(() => {
    cache = new RevisionCache();
  });

  describe("storing and retrieving entries", () => {
    it("stores and retrieves entries by repo and revision", () => {
      const entry = createEntry("100", "john", "fix bug");
      cache.addEntries(repoUrl, [entry]);

      expect(cache.hasRevision(repoUrl, "100")).toBe(true);
      expect(cache.getEntry(repoUrl, "100")).toEqual(entry);
    });

    it("stores multiple entries and retrieves all for repo", () => {
      const entries = [
        createEntry("100", "john", "fix bug"),
        createEntry("99", "jane", "add feature"),
        createEntry("98", "john", "refactor")
      ];
      cache.addEntries(repoUrl, entries);

      const all = cache.getAllEntries(repoUrl);
      expect(all).toHaveLength(3);
      expect(all.map(e => e.revision)).toEqual(["100", "99", "98"]);
    });

    it("returns empty array for unknown repo", () => {
      expect(cache.getAllEntries("unknown")).toEqual([]);
    });

    it("does not duplicate entries on re-add", () => {
      const entry = createEntry("100", "john", "fix bug");
      cache.addEntries(repoUrl, [entry]);
      cache.addEntries(repoUrl, [entry]);

      expect(cache.getAllEntries(repoUrl)).toHaveLength(1);
    });
  });

  describe("author extraction", () => {
    it("extracts unique authors from cached entries", () => {
      const entries = [
        createEntry("100", "john", "msg1"),
        createEntry("99", "jane", "msg2"),
        createEntry("98", "john", "msg3"),
        createEntry("97", "bob", "msg4")
      ];
      cache.addEntries(repoUrl, entries);

      const authors = cache.getAuthors(repoUrl);
      expect(authors.sort()).toEqual(["bob", "jane", "john"]);
    });

    it("returns empty array for unknown repo", () => {
      expect(cache.getAuthors("unknown")).toEqual([]);
    });
  });

  describe("revision range queries", () => {
    it("gets entries in revision range", () => {
      const entries = [
        createEntry("100", "john", "msg1"),
        createEntry("95", "jane", "msg2"),
        createEntry("90", "bob", "msg3"),
        createEntry("85", "john", "msg4")
      ];
      cache.addEntries(repoUrl, entries);

      const range = cache.getEntriesInRange(repoUrl, 95, 85);
      expect(range.map(e => e.revision)).toEqual(["95", "90", "85"]);
    });

    it("gets highest and lowest cached revisions", () => {
      const entries = [
        createEntry("100", "john", "msg1"),
        createEntry("50", "jane", "msg2")
      ];
      cache.addEntries(repoUrl, entries);

      expect(cache.getHighestRevision(repoUrl)).toBe(100);
      expect(cache.getLowestRevision(repoUrl)).toBe(50);
    });
  });
});

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
