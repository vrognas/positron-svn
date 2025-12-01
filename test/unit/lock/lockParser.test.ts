import { describe, it, expect } from "vitest";
import {
  parseBatchLockInfo,
  parseLockInfo
} from "../../../src/parser/lockParser";

describe("Lock Parser", () => {
  describe("Basic Parsing", () => {
    it("parses file lock info from svn info --xml", () => {
      const xml = `<?xml version="1.0"?>
<info>
  <entry kind="file" path="data.csv" revision="150">
    <url>svn://example.com/repo/data.csv</url>
    <relative-url>^/data.csv</relative-url>
    <repository>
      <root>svn://example.com/repo</root>
      <uuid>abc-123</uuid>
    </repository>
    <wc-info>
      <wcroot-abspath>/home/user/project</wcroot-abspath>
      <schedule>normal</schedule>
      <depth>infinity</depth>
    </wc-info>
    <lock>
      <token>opaquelocktoken:12345-67890</token>
      <owner>alice</owner>
      <comment>Editing large dataset</comment>
      <created>2025-11-28T10:00:00.000000Z</created>
    </lock>
    <commit revision="150">
      <author>bob</author>
      <date>2025-11-20T08:00:00.000000Z</date>
    </commit>
  </entry>
</info>`;

      const result = parseLockInfo(xml);

      expect(result).toBeTruthy();
      expect(result?.owner).toBe("alice");
      expect(result?.comment).toBe("Editing large dataset");
      expect(result?.token).toBe("opaquelocktoken:12345-67890");
      expect(result?.created).toBe("2025-11-28T10:00:00.000000Z");
    });

    it("returns null for unlocked file", () => {
      const xml = `<?xml version="1.0"?>
<info>
  <entry kind="file" path="readme.txt" revision="100">
    <url>svn://example.com/repo/readme.txt</url>
    <relative-url>^/readme.txt</relative-url>
    <repository>
      <root>svn://example.com/repo</root>
      <uuid>abc-123</uuid>
    </repository>
    <commit revision="100">
      <author>bob</author>
      <date>2025-11-15T08:00:00.000000Z</date>
    </commit>
  </entry>
</info>`;

      const result = parseLockInfo(xml);

      expect(result).toBeNull();
    });

    it("parses lock without comment", () => {
      const xml = `<?xml version="1.0"?>
<info>
  <entry kind="file" path="model.rds" revision="200">
    <url>svn://example.com/repo/model.rds</url>
    <relative-url>^/model.rds</relative-url>
    <repository>
      <root>svn://example.com/repo</root>
      <uuid>abc-123</uuid>
    </repository>
    <lock>
      <token>opaquelocktoken:99999</token>
      <owner>charlie</owner>
      <created>2025-11-28T14:30:00.000000Z</created>
    </lock>
    <commit revision="200">
      <author>charlie</author>
      <date>2025-11-25T12:00:00.000000Z</date>
    </commit>
  </entry>
</info>`;

      const result = parseLockInfo(xml);

      expect(result).toBeTruthy();
      expect(result?.owner).toBe("charlie");
      expect(result?.comment).toBeUndefined();
    });
  });

  describe("Directory Locking", () => {
    it("parses directory lock info", () => {
      const xml = `<?xml version="1.0"?>
<info>
  <entry kind="dir" path="data" revision="175">
    <url>svn://example.com/repo/data</url>
    <relative-url>^/data</relative-url>
    <repository>
      <root>svn://example.com/repo</root>
      <uuid>abc-123</uuid>
    </repository>
    <wc-info>
      <wcroot-abspath>/home/user/project</wcroot-abspath>
      <schedule>normal</schedule>
      <depth>infinity</depth>
    </wc-info>
    <lock>
      <token>opaquelocktoken:dir-lock-001</token>
      <owner>dave</owner>
      <comment>Batch update in progress</comment>
      <created>2025-11-28T16:00:00.000000Z</created>
    </lock>
    <commit revision="175">
      <author>alice</author>
      <date>2025-11-22T09:00:00.000000Z</date>
    </commit>
  </entry>
</info>`;

      const result = parseLockInfo(xml);

      expect(result).toBeTruthy();
      expect(result?.owner).toBe("dave");
      expect(result?.comment).toBe("Batch update in progress");
    });
  });

  describe("Error Handling", () => {
    it("handles malformed XML gracefully", () => {
      const xml = `<info><unclosed>`;

      expect(() => parseLockInfo(xml)).toThrow();
    });

    it("handles empty XML", () => {
      const xml = "";

      expect(() => parseLockInfo(xml)).toThrow();
    });
  });

  describe("Batch Lock Parsing", () => {
    it("parses multiple entries with locks", () => {
      const xml = `<?xml version="1.0"?>
<info>
  <entry kind="file" path="file1.csv" revision="100">
    <url>svn://example.com/repo/file1.csv</url>
    <lock>
      <token>opaquelocktoken:111</token>
      <owner>alice</owner>
      <comment>Editing file1</comment>
      <created>2025-11-28T10:00:00.000000Z</created>
    </lock>
    <commit revision="100"><author>bob</author><date>2025-11-20T08:00:00Z</date></commit>
  </entry>
  <entry kind="file" path="file2.csv" revision="101">
    <url>svn://example.com/repo/file2.csv</url>
    <lock>
      <token>opaquelocktoken:222</token>
      <owner>charlie</owner>
      <created>2025-11-28T11:00:00.000000Z</created>
    </lock>
    <commit revision="101"><author>bob</author><date>2025-11-20T09:00:00Z</date></commit>
  </entry>
</info>`;

      const result = parseBatchLockInfo(xml);

      expect(result.size).toBe(2);
      expect(result.get("svn://example.com/repo/file1.csv")?.owner).toBe(
        "alice"
      );
      expect(result.get("svn://example.com/repo/file2.csv")?.owner).toBe(
        "charlie"
      );
    });

    it("returns null for unlocked entries", () => {
      const xml = `<?xml version="1.0"?>
<info>
  <entry kind="file" path="unlocked.txt" revision="100">
    <url>svn://example.com/repo/unlocked.txt</url>
    <commit revision="100"><author>bob</author><date>2025-11-20T08:00:00Z</date></commit>
  </entry>
</info>`;

      const result = parseBatchLockInfo(xml);

      expect(result.size).toBe(1);
      expect(result.get("svn://example.com/repo/unlocked.txt")).toBeNull();
    });

    it("handles empty content", () => {
      const result = parseBatchLockInfo("");
      expect(result.size).toBe(0);
    });

    it("uses URL as map key (not path)", () => {
      const xml = `<?xml version="1.0"?>
<info>
  <entry kind="file" path="data.csv" revision="100">
    <url>svn://example.com/repo/subdir/data.csv</url>
    <lock>
      <token>opaquelocktoken:333</token>
      <owner>dave</owner>
      <created>2025-11-28T12:00:00.000000Z</created>
    </lock>
    <commit revision="100"><author>bob</author><date>2025-11-20T08:00:00Z</date></commit>
  </entry>
</info>`;

      const result = parseBatchLockInfo(xml);

      // Should be keyed by URL, not path
      expect(result.has("data.csv")).toBe(false);
      expect(result.has("svn://example.com/repo/subdir/data.csv")).toBe(true);
      expect(result.get("svn://example.com/repo/subdir/data.csv")?.owner).toBe(
        "dave"
      );
    });
  });
});
