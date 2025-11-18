import * as assert from "assert";
import { parseSvnBlame } from "../../../src/parser/blameParser";

suite("Blame Parser", () => {
  suite("Basic Parsing", () => {
    test("parses single line with all fields", async () => {
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

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].lineNumber, 1);
      assert.strictEqual(result[0].revision, "123");
      assert.strictEqual(result[0].author, "john");
      assert.strictEqual(result[0].date, "2025-11-18T10:00:00.000000Z");
    });

    test("parses multiple lines with different revisions", async () => {
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

      assert.strictEqual(result.length, 3);
      assert.strictEqual(result[0].revision, "100");
      assert.strictEqual(result[0].author, "alice");
      assert.strictEqual(result[1].revision, "150");
      assert.strictEqual(result[1].author, "bob");
      assert.strictEqual(result[2].revision, "200");
      assert.strictEqual(result[2].author, "charlie");
    });
  });

  suite("Edge Cases", () => {
    test("handles empty file (no entries)", async () => {
      const xml = `<?xml version="1.0"?>
<blame>
  <target path="empty.txt"/>
</blame>`;

      const result = await parseSvnBlame(xml);

      assert.strictEqual(result.length, 0);
    });

    test("handles uncommitted line (no commit element)", async () => {
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

      assert.strictEqual(result.length, 2);
      assert.strictEqual(result[0].revision, "100");
      assert.strictEqual(result[1].lineNumber, 2);
      assert.strictEqual(result[1].revision, undefined);
      assert.strictEqual(result[1].author, undefined);
      assert.strictEqual(result[1].date, undefined);
    });

    test("handles merged line with merge info", async () => {
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

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].revision, "200");
      assert.strictEqual(result[0].author, "merger");
      assert.ok(result[0].merged);
      assert.strictEqual(result[0].merged?.path, "/branches/feature");
      assert.strictEqual(result[0].merged?.revision, "150");
      assert.strictEqual(result[0].merged?.author, "original");
    });

    test("handles missing author field", async () => {
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

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].revision, "123");
      assert.strictEqual(result[0].author, undefined);
      assert.strictEqual(result[0].date, "2025-11-18T00:00:00.000000Z");
    });

    test("rejects malformed XML", async () => {
      const xml = `<blame><unclosed>`;

      try {
        await parseSvnBlame(xml);
        assert.fail("Should reject malformed XML");
      } catch (err) {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes("Failed to parse"));
      }
    });

    test("rejects empty XML", async () => {
      const xml = "";

      try {
        await parseSvnBlame(xml);
        assert.fail("Should reject empty XML");
      } catch (err) {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes("empty"));
      }
    });

    test("handles missing target element", async () => {
      const xml = `<?xml version="1.0"?>
<blame>
</blame>`;

      try {
        await parseSvnBlame(xml);
        assert.fail("Should reject XML without target");
      } catch (err) {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes("target"));
      }
    });
  });

  suite("Performance", () => {
    test("parses large file (1000 lines) quickly", async () => {
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

      assert.strictEqual(result.length, 1000);
      assert.ok(elapsed < 100, `Parsing took ${elapsed}ms, expected <100ms`);
    });
  });
});
