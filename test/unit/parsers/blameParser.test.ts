import { describe, it, expect } from "vitest";
import { parseSvnBlame } from "../../../src/parser/blameParser";

describe("Blame Parser", () => {
  describe("Basic Parsing", () => {
    it("parses single line with all fields", async () => {
      const xml = `<?xml version="1.0"?>
<blame>
  <target path="file.ts">
    <entry line-number="1">
      <commit revision="123">
        <author>john</author>
        <date>2025-11-18T10:00:00.000000Z</date>
      </commit>
    </entry>
  </target>
</blame>`;

      const result = await parseSvnBlame(xml);

      expect(result).toHaveLength(1);
      expect(result[0].lineNumber).toBe(1);
      expect(result[0].revision).toBe("123");
      expect(result[0].author).toBe("john");
      expect(result[0].date).toBe("2025-11-18T10:00:00.000000Z");
    });

    it("parses multiple lines with different revisions", async () => {
      const xml = `<?xml version="1.0"?>
<blame>
  <target path="file.ts">
    <entry line-number="1">
      <commit revision="100">
        <author>alice</author>
        <date>2025-01-01T00:00:00.000000Z</date>
      </commit>
    </entry>
    <entry line-number="2">
      <commit revision="150">
        <author>bob</author>
        <date>2025-02-15T00:00:00.000000Z</date>
      </commit>
    </entry>
    <entry line-number="3">
      <commit revision="200">
        <author>charlie</author>
        <date>2025-03-01T00:00:00.000000Z</date>
      </commit>
    </entry>
  </target>
</blame>`;

      const result = await parseSvnBlame(xml);

      expect(result).toHaveLength(3);
      expect(result[0].revision).toBe("100");
      expect(result[0].author).toBe("alice");
      expect(result[1].revision).toBe("150");
      expect(result[1].author).toBe("bob");
      expect(result[2].revision).toBe("200");
      expect(result[2].author).toBe("charlie");
    });
  });

  describe("Edge Cases", () => {
    it("handles empty file (no entries)", async () => {
      const xml = `<?xml version="1.0"?>
<blame>
  <target path="empty.txt"/>
</blame>`;

      const result = await parseSvnBlame(xml);

      expect(result).toHaveLength(0);
    });

    it("handles uncommitted line (no commit element)", async () => {
      const xml = `<?xml version="1.0"?>
<blame>
  <target path="file.ts">
    <entry line-number="1">
      <commit revision="100">
        <author>alice</author>
        <date>2025-01-01T00:00:00.000000Z</date>
      </commit>
    </entry>
    <entry line-number="2">
    </entry>
  </target>
</blame>`;

      const result = await parseSvnBlame(xml);

      expect(result).toHaveLength(2);
      expect(result[0].revision).toBe("100");
      expect(result[1].lineNumber).toBe(2);
      expect(result[1].revision).toBeUndefined();
      expect(result[1].author).toBeUndefined();
      expect(result[1].date).toBeUndefined();
    });

    it("handles merged line with merge info", async () => {
      const xml = `<?xml version="1.0"?>
<blame>
  <target path="file.ts">
    <entry line-number="1">
      <commit revision="200">
        <author>merger</author>
        <date>2025-03-01T00:00:00.000000Z</date>
      </commit>
      <merged path="/branches/feature">
        <commit revision="150">
          <author>original</author>
          <date>2025-02-15T00:00:00.000000Z</date>
        </commit>
      </merged>
    </entry>
  </target>
</blame>`;

      const result = await parseSvnBlame(xml);

      expect(result).toHaveLength(1);
      expect(result[0].revision).toBe("200");
      expect(result[0].author).toBe("merger");
      expect(result[0].merged).toBeTruthy();
      expect(result[0].merged?.path).toBe("/branches/feature");
      expect(result[0].merged?.revision).toBe("150");
      expect(result[0].merged?.author).toBe("original");
    });

    it("handles missing author field", async () => {
      const xml = `<?xml version="1.0"?>
<blame>
  <target path="file.ts">
    <entry line-number="1">
      <commit revision="123">
        <date>2025-11-18T00:00:00.000000Z</date>
      </commit>
    </entry>
  </target>
</blame>`;

      const result = await parseSvnBlame(xml);

      expect(result).toHaveLength(1);
      expect(result[0].revision).toBe("123");
      expect(result[0].author).toBeUndefined();
      expect(result[0].date).toBe("2025-11-18T00:00:00.000000Z");
    });

    it("rejects malformed XML", async () => {
      const xml = `<blame><unclosed>`;

      await expect(parseSvnBlame(xml)).rejects.toThrow(/target/);
    });

    it("rejects empty XML", async () => {
      const xml = "";

      await expect(parseSvnBlame(xml)).rejects.toThrow(/empty/);
    });

    it("handles missing target element", async () => {
      const xml = `<?xml version="1.0"?>
<blame>
</blame>`;

      await expect(parseSvnBlame(xml)).rejects.toThrow(/target/);
    });
  });

  describe("Performance", () => {
    it("parses large file (1000 lines) quickly", async () => {
      // Generate XML for 1000 lines
      let xml = `<?xml version="1.0"?>\n<blame>\n<target path="large.ts">\n`;
      for (let i = 1; i <= 1000; i++) {
        xml += `  <entry line-number="${i}">
    <commit revision="${Math.floor(i / 10)}">
      <author>dev${i % 10}</author>
      <date>2025-01-01T00:00:00.000000Z</date>
    </commit>
  </entry>\n`;
      }
      xml += `</target>\n</blame>`;

      const start = Date.now();
      const result = await parseSvnBlame(xml);
      const elapsed = Date.now() - start;

      expect(result).toHaveLength(1000);
      // CI environments (especially Windows) have variable performance
      expect(elapsed).toBeLessThan(500);
    });
  });
});
