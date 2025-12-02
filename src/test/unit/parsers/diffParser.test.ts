import * as assert from "assert";
import { parseDiffXml } from "../../../parser/diffParser";

suite("DiffParser", () => {
  test("parses single path", async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<paths>
  <path props="none" kind="file" item="modified">/trunk/file.txt</path>
</paths>`;

    const result = await parseDiffXml(xml);

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0]!._, "/trunk/file.txt");
    assert.strictEqual(result[0]!.props, "none");
    assert.strictEqual(result[0]!.kind, "file");
    assert.strictEqual(result[0]!.item, "modified");
  });

  test("parses multiple paths", async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<paths>
  <path props="none" kind="file" item="added">/trunk/new.txt</path>
  <path props="modified" kind="file" item="modified">/trunk/changed.txt</path>
  <path props="none" kind="dir" item="deleted">/trunk/old_dir</path>
</paths>`;

    const result = await parseDiffXml(xml);

    assert.strictEqual(result.length, 3);
    assert.strictEqual(result[0]!._, "/trunk/new.txt");
    assert.strictEqual(result[0]!.item, "added");
    assert.strictEqual(result[1]!._, "/trunk/changed.txt");
    assert.strictEqual(result[1]!.props, "modified");
    assert.strictEqual(result[2]!.kind, "dir");
    assert.strictEqual(result[2]!.item, "deleted");
  });

  test("rejects empty paths", async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<paths>
</paths>`;

    await assert.rejects(
      async () => await parseDiffXml(xml),
      "Should reject empty paths"
    );
  });
});
