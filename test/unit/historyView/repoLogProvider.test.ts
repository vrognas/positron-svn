import * as assert from "assert";
import * as path from "path";
import { parseSvnLog } from "../../../src/parser/logParser";

/**
 * E2E Tests: Revision Expansion (v2.17.137 bug fix)
 * Tests full flow: XML → parser → path content accessible
 */
suite("RepoLogProvider - Revision Expansion E2E", () => {
  test("expands revision showing multiple changed files", async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<log>
  <logentry revision="126">
    <author>testuser</author>
    <date>2025-11-15T10:00:00.000000Z</date>
    <msg>Multiple changes</msg>
    <paths>
      <path kind="file" action="M">/trunk/src/file.txt</path>
      <path kind="dir" action="A">/trunk/newdir</path>
      <path kind="file" action="D">/trunk/old.txt</path>
    </paths>
  </logentry>
</log>`;

    const logEntries = await parseSvnLog(xml);
    assert.strictEqual(logEntries.length, 1);

    const commit = logEntries[0];
    assert.strictEqual(commit.paths.length, 3);

    // E2E: Verify path content (_) accessible for tree item creation
    // This is the property accessed in repoLogProvider.ts:351,353,356
    const pathElem = commit.paths[0];
    assert.strictEqual(pathElem._, "/trunk/src/file.txt");

    // E2E: Verify path.basename() works (was the crash point)
    const basename = path.basename(pathElem._);
    assert.strictEqual(basename, "file.txt");

    // E2E: Verify path.dirname() works
    const dirname = path.dirname(pathElem._);
    assert.strictEqual(dirname, "/trunk/src");

    // E2E: Verify all paths and actions
    assert.strictEqual(commit.paths[1]._, "/trunk/newdir");
    assert.strictEqual(commit.paths[1].action, "A");
    assert.strictEqual(commit.paths[2]._, "/trunk/old.txt");
    assert.strictEqual(commit.paths[2].action, "D");
  });

  test("handles revision with no paths", async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<log>
  <logentry revision="125">
    <author>user</author>
    <date>2025-11-15T10:00:00.000000Z</date>
    <msg>Empty commit</msg>
  </logentry>
</log>`;

    const logEntries = await parseSvnLog(xml);
    assert.strictEqual(logEntries.length, 1);
    assert.strictEqual(Array.isArray(logEntries[0].paths), true);
    assert.strictEqual(logEntries[0].paths.length, 0);
  });

  test("parses paths with special characters", async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<log>
  <logentry revision="127">
    <author>user</author>
    <date>2025-11-15T10:00:00.000000Z</date>
    <msg>Special chars</msg>
    <paths>
      <path kind="file" action="M">/trunk/my file (copy).txt</path>
    </paths>
  </logentry>
</log>`;

    const logEntries = await parseSvnLog(xml);
    const pathElem = logEntries[0].paths[0];

    // E2E: Special characters in path content
    assert.strictEqual(pathElem._, "/trunk/my file (copy).txt");
    const basename = path.basename(pathElem._);
    assert.strictEqual(basename, "my file (copy).txt");
  });
});
