import * as assert from "assert";
import { parseSvnLog } from "../../../parser/logParser";

suite("LogParser", () => {
  test("parses single log entry", async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<log>
  <logentry revision="123">
    <author>testuser</author>
    <date>2025-11-10T10:00:00.000000Z</date>
    <msg>Initial commit</msg>
    <paths>
      <path kind="file" action="A">/trunk/file.txt</path>
    </paths>
  </logentry>
</log>`;

    const result = await parseSvnLog(xml);

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].revision, "123");
    assert.strictEqual(result[0].author, "testuser");
    assert.strictEqual(result[0].msg, "Initial commit");
    assert.strictEqual(result[0].paths.length, 1);
    assert.strictEqual(result[0].paths[0].action, "A");
  });

  test("parses multiple log entries", async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<log>
  <logentry revision="124">
    <author>user1</author>
    <date>2025-11-10T11:00:00.000000Z</date>
    <msg>Second commit</msg>
    <paths>
      <path kind="file" action="M">/trunk/file.txt</path>
      <path kind="file" action="A">/trunk/file2.txt</path>
    </paths>
  </logentry>
  <logentry revision="123">
    <author>user2</author>
    <date>2025-11-10T10:00:00.000000Z</date>
    <msg>First commit</msg>
    <paths>
      <path kind="file" action="A">/trunk/file.txt</path>
    </paths>
  </logentry>
</log>`;

    const result = await parseSvnLog(xml);

    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].revision, "124");
    assert.strictEqual(result[0].paths.length, 2);
    assert.strictEqual(result[1].revision, "123");
    assert.strictEqual(result[1].paths.length, 1);
  });

  test("parses entry without paths", async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<log>
  <logentry revision="125">
    <author>user3</author>
    <date>2025-11-10T12:00:00.000000Z</date>
    <msg>Empty commit</msg>
  </logentry>
</log>`;

    const result = await parseSvnLog(xml);

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].revision, "125");
    assert.strictEqual(result[0].msg, "Empty commit");
    assert.strictEqual(Array.isArray(result[0].paths), true);
    assert.strictEqual(result[0].paths.length, 0);
  });

  test("parses path content (_) correctly", async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<log>
  <logentry revision="126">
    <author>testuser</author>
    <date>2025-11-15T10:00:00.000000Z</date>
    <msg>Test path content</msg>
    <paths>
      <path kind="file" action="M">/trunk/src/file.txt</path>
      <path kind="dir" action="A">/trunk/newdir</path>
    </paths>
  </logentry>
</log>`;

    const result = await parseSvnLog(xml);

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].paths.length, 2);
    assert.strictEqual(result[0].paths[0]._, "/trunk/src/file.txt");
    assert.strictEqual(result[0].paths[0].action, "M");
    assert.strictEqual(result[0].paths[0].kind, "file");
    assert.strictEqual(result[0].paths[1]._, "/trunk/newdir");
    assert.strictEqual(result[0].paths[1].action, "A");
    assert.strictEqual(result[0].paths[1].kind, "dir");
  });
});
