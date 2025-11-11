import * as assert from "assert";
import { parseInfoXml } from "../../../parser/infoParser";

suite("InfoParser", () => {
  test("parses repository info", async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<info>
  <entry kind="dir" path="." revision="123">
    <url>https://svn.example.com/repo/trunk</url>
    <relative-url>^/trunk</relative-url>
    <repository>
      <root>https://svn.example.com/repo</root>
      <uuid>abc-123-def-456</uuid>
    </repository>
    <wc-info>
      <wcroot-abspath>/home/user/repo</wcroot-abspath>
      <schedule>normal</schedule>
      <depth>infinity</depth>
    </wc-info>
    <commit revision="123">
      <author>testuser</author>
      <date>2025-11-10T10:00:00.000000Z</date>
    </commit>
  </entry>
</info>`;

    const result = await parseInfoXml(xml);

    assert.strictEqual(result.kind, "dir");
    assert.strictEqual(result.path, ".");
    assert.strictEqual(result.revision, "123");
    assert.strictEqual(result.url, "https://svn.example.com/repo/trunk");
    assert.strictEqual(result.repository.root, "https://svn.example.com/repo");
    assert.strictEqual(result.repository.uuid, "abc-123-def-456");
  });

  test("parses file info", async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<info>
  <entry kind="file" path="test.txt" revision="100">
    <url>https://svn.example.com/repo/trunk/test.txt</url>
    <relative-url>^/trunk/test.txt</relative-url>
    <repository>
      <root>https://svn.example.com/repo</root>
      <uuid>xyz-789</uuid>
    </repository>
    <commit revision="100">
      <author>author1</author>
      <date>2025-11-09T15:30:00.000000Z</date>
    </commit>
  </entry>
</info>`;

    const result = await parseInfoXml(xml);

    assert.strictEqual(result.kind, "file");
    assert.strictEqual(result.path, "test.txt");
    assert.strictEqual(result.url, "https://svn.example.com/repo/trunk/test.txt");
    assert.strictEqual(result.commit.revision, "100");
    assert.strictEqual(result.commit.author, "author1");
  });

  test("parses switched working copy", async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<info>
  <entry kind="dir" path="." revision="150">
    <url>https://svn.example.com/repo/branches/feature</url>
    <relative-url>^/branches/feature</relative-url>
    <repository>
      <root>https://svn.example.com/repo</root>
      <uuid>branch-uuid</uuid>
    </repository>
    <wc-info>
      <wcroot-abspath>/home/user/repo</wcroot-abspath>
      <schedule>normal</schedule>
      <depth>infinity</depth>
    </wc-info>
    <commit revision="150">
      <author>branch-author</author>
      <date>2025-11-10T08:00:00.000000Z</date>
    </commit>
  </entry>
</info>`;

    const result = await parseInfoXml(xml);

    assert.strictEqual(result.url, "https://svn.example.com/repo/branches/feature");
    assert.strictEqual(result.relativeUrl, "^/branches/feature");
    // CRITICAL: Verify wcInfo.wcrootAbspath exists (needed for repo detection)
    assert.ok(result.wcInfo);
    assert.strictEqual(result.wcInfo.wcrootAbspath, "/home/user/repo");
  });
});
