import * as assert from "assert";
import { XmlParserAdapter } from "../../parser/xmlParserAdapter";

suite("XmlParserAdapter", () => {
  test("merges attributes into parent object", () => {
    const xml = `<?xml version="1.0"?>
<entry path="/file.txt" kind="file">
  <name>file.txt</name>
</entry>`;

    const result = XmlParserAdapter.parse(xml, { mergeAttrs: true });

    assert.strictEqual(result.entry.path, "/file.txt");
    assert.strictEqual(result.entry.kind, "file");
    assert.strictEqual(result.entry.name, "file.txt");
  });

  test("transforms tag names to camelCase", () => {
    const xml = `<?xml version="1.0"?>
<wc-status>
  <wc-locked>true</wc-locked>
  <relative-url>^/trunk</relative-url>
</wc-status>`;

    const result = XmlParserAdapter.parse(xml, { camelcase: true });

    assert.ok(result.wcStatus);
    assert.strictEqual(result.wcStatus.wcLocked, "true");
    assert.strictEqual(result.wcStatus.relativeUrl, "^/trunk");
  });

  test("transforms attribute names to camelCase", () => {
    const xml = `<?xml version="1.0"?>
<entry wc-locked="true" some-attr="value">
  <name>test</name>
</entry>`;

    const result = XmlParserAdapter.parse(xml, {
      mergeAttrs: true,
      camelcase: true
    });

    assert.strictEqual(result.entry.wcLocked, "true");
    assert.strictEqual(result.entry.someAttr, "value");
    assert.strictEqual(result.entry.name, "test");
  });

  test("handles hyphenated names (wc-status → wcStatus)", () => {
    const xml = `<?xml version="1.0"?>
<status>
  <wc-status item="modified" wc-locked="true"/>
</status>`;

    const result = XmlParserAdapter.parse(xml, {
      mergeAttrs: true,
      camelcase: true
    });

    assert.ok(result.status.wcStatus);
    assert.strictEqual(result.status.wcStatus.item, "modified");
    assert.strictEqual(result.status.wcStatus.wcLocked, "true");
  });

  test("single element not wrapped in array (explicitArray: false)", () => {
    const xml = `<?xml version="1.0"?>
<list>
  <entry kind="file">
    <name>file1.txt</name>
  </entry>
</list>`;

    const result = XmlParserAdapter.parse(xml, { explicitArray: false });

    // Single entry should be object, not array
    assert.ok(!Array.isArray(result.list.entry));
    assert.strictEqual(result.list.entry.kind, "file");
    assert.strictEqual(result.list.entry.name, "file1.txt");
  });

  test("multiple elements in array (explicitArray: false)", () => {
    const xml = `<?xml version="1.0"?>
<list>
  <entry kind="file">
    <name>file1.txt</name>
  </entry>
  <entry kind="file">
    <name>file2.txt</name>
  </entry>
</list>`;

    const result = XmlParserAdapter.parse(xml, { explicitArray: false });

    // Multiple entries should remain as array
    assert.ok(Array.isArray(result.list.entry));
    assert.strictEqual(result.list.entry.length, 2);
    assert.strictEqual(result.list.entry[0].name, "file1.txt");
    assert.strictEqual(result.list.entry[1].name, "file2.txt");
  });

  test("nested object transformation", () => {
    const xml = `<?xml version="1.0"?>
<info>
  <entry path="." revision="123">
    <repository>
      <root>https://svn.example.com/repo</root>
      <uuid>abc-123</uuid>
    </repository>
    <commit revision="100">
      <author>testuser</author>
    </commit>
  </entry>
</info>`;

    const result = XmlParserAdapter.parse(xml, {
      mergeAttrs: true,
      camelcase: true,
      explicitArray: false
    });

    assert.strictEqual(result.info.entry.path, ".");
    assert.strictEqual(result.info.entry.revision, "123");
    assert.strictEqual(
      result.info.entry.repository.root,
      "https://svn.example.com/repo"
    );
    assert.strictEqual(result.info.entry.repository.uuid, "abc-123");
    assert.strictEqual(result.info.entry.commit.revision, "100");
    assert.strictEqual(result.info.entry.commit.author, "testuser");
  });

  test("empty element handling", () => {
    const xml = `<?xml version="1.0"?>
<status>
  <target/>
</status>`;

    const result = XmlParserAdapter.parse(xml, { explicitArray: false });

    assert.ok(result.status);
    assert.strictEqual(result.status.target, "");
  });

  test("text content extraction", () => {
    const xml = `<?xml version="1.0"?>
<paths>
  <path kind="file">/trunk/file.txt</path>
</paths>`;

    const result = XmlParserAdapter.parse(xml, {
      mergeAttrs: true,
      camelcase: true,
      explicitArray: false
    });

    assert.strictEqual(result.paths.path.kind, "file");
    assert.strictEqual(result.paths.path["#text"], "/trunk/file.txt");
  });

  test("combined options (mergeAttrs + camelcase + explicitArray)", () => {
    const xml = `<?xml version="1.0"?>
<log>
  <logentry revision="123">
    <author>user1</author>
    <date>2025-11-10T10:00:00.000000Z</date>
    <msg>Test commit</msg>
    <paths>
      <path kind="file" action="M">/trunk/file.txt</path>
    </paths>
  </logentry>
</log>`;

    const result = XmlParserAdapter.parse(xml, {
      mergeAttrs: true,
      camelcase: true,
      explicitArray: false
    });

    assert.strictEqual(result.log.logentry.revision, "123");
    assert.strictEqual(result.log.logentry.author, "user1");
    assert.strictEqual(result.log.logentry.msg, "Test commit");
    assert.strictEqual(result.log.logentry.paths.path.kind, "file");
    assert.strictEqual(result.log.logentry.paths.path.action, "M");
    assert.strictEqual(result.log.logentry.paths.path["#text"], "/trunk/file.txt");
  });
});
