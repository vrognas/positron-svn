import * as assert from "assert";
import { parseSvnList } from "../../../parser/listParser";

suite("ListParser", () => {
  test("parses single entry", async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<list>
  <entry kind="file">
    <name>test.txt</name>
    <size>1024</size>
    <commit revision="100">
      <author>testuser</author>
      <date>2025-11-10T10:00:00.000000Z</date>
    </commit>
  </entry>
</list>`;

    const result = await parseSvnList(xml);

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].kind, "file");
    assert.strictEqual(result[0].name, "test.txt");
    assert.strictEqual(result[0].size, "1024");
    assert.strictEqual(result[0].commit.revision, "100");
    assert.strictEqual(result[0].commit.author, "testuser");
  });

  test("parses multiple entries", async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<list>
  <entry kind="dir">
    <name>subdir</name>
    <commit revision="50">
      <author>user1</author>
      <date>2025-11-09T15:00:00.000000Z</date>
    </commit>
  </entry>
  <entry kind="file">
    <name>file1.txt</name>
    <size>512</size>
    <commit revision="75">
      <author>user2</author>
      <date>2025-11-10T08:30:00.000000Z</date>
    </commit>
  </entry>
  <entry kind="file">
    <name>file2.txt</name>
    <size>2048</size>
    <commit revision="80">
      <author>user3</author>
      <date>2025-11-10T09:00:00.000000Z</date>
    </commit>
  </entry>
</list>`;

    const result = await parseSvnList(xml);

    assert.strictEqual(result.length, 3);
    assert.strictEqual(result[0].kind, "dir");
    assert.strictEqual(result[0].name, "subdir");
    assert.strictEqual(result[1].kind, "file");
    assert.strictEqual(result[1].name, "file1.txt");
    assert.strictEqual(result[1].size, "512");
    assert.strictEqual(result[2].name, "file2.txt");
    assert.strictEqual(result[2].commit.revision, "80");
  });

  test("returns empty array for empty list", async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<list>
</list>`;

    const result = await parseSvnList(xml);

    assert.strictEqual(Array.isArray(result), true);
    assert.strictEqual(result.length, 0);
  });
});
