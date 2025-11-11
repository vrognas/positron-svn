import * as assert from "assert";
import { parseStatusXml } from "../../../parser/statusParser";

suite("StatusParser", () => {
  test("parses basic modified file", async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<status>
  <target path=".">
    <entry path="file.txt">
      <wc-status props="none" item="modified">
        <commit revision="123">
          <author>user</author>
          <date>2025-11-10T10:00:00.000000Z</date>
        </commit>
      </wc-status>
    </entry>
  </target>
</status>`;

    const result = await parseStatusXml(xml);

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].path, "file.txt");
    assert.strictEqual(result[0].status, "modified");
    assert.strictEqual(result[0].props, "none");
    assert.strictEqual(result[0].commit?.revision, "123");
    assert.strictEqual(result[0].commit?.author, "user");
  });

  test("parses changelist entries", async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<status>
  <changelist name="my-changelist">
    <entry path="file1.txt">
      <wc-status props="none" item="modified">
        <commit revision="100"/>
      </wc-status>
    </entry>
    <entry path="file2.txt">
      <wc-status props="none" item="added"/>
    </entry>
  </changelist>
</status>`;

    const result = await parseStatusXml(xml);

    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].changelist, "my-changelist");
    assert.strictEqual(result[0].path, "file1.txt");
    assert.strictEqual(result[0].status, "modified");
    assert.strictEqual(result[1].changelist, "my-changelist");
    assert.strictEqual(result[1].path, "file2.txt");
    assert.strictEqual(result[1].status, "added");
  });

  test("parses external repository", async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<status>
  <target path=".">
    <entry path="external">
      <wc-status props="none" item="external"/>
    </entry>
    <entry path="locked.txt">
      <wc-status props="none" item="normal" wc-locked="true">
        <commit revision="200"/>
      </wc-status>
    </entry>
  </target>
</status>`;

    const result = await parseStatusXml(xml);

    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].status, "external");
    assert.strictEqual(result[1].wcStatus.locked, true);
  });
});
