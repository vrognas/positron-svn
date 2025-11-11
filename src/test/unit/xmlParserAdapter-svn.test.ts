import * as assert from "assert";
import { XmlParserAdapter } from "../../parser/xmlParserAdapter";

suite("XmlParserAdapter - SVN XML Compatibility", () => {
  test("parses real SVN status XML with hyphenated attributes", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<status>
  <target path=".">
    <entry path="test.txt">
      <wc-status props="none" item="modified" wc-locked="true" revision="123">
        <commit revision="100">
          <author>testuser</author>
          <date>2025-11-10T10:00:00.000000Z</date>
        </commit>
      </wc-status>
    </entry>
  </target>
</status>`;

    const result = XmlParserAdapter.parse(xml, {
      mergeAttrs: true,
      explicitArray: false,
      camelcase: true
    });

    // Verify root structure
    assert.ok(result.status);
    assert.ok(result.status.target);
    assert.strictEqual(result.status.target.path, ".");

    // Verify entry
    assert.ok(result.status.target.entry);
    assert.strictEqual(result.status.target.entry.path, "test.txt");

    // CRITICAL: Verify hyphenated attributes are camelCased and merged
    assert.ok(result.status.target.entry.wcStatus);
    assert.strictEqual(result.status.target.entry.wcStatus.props, "none");
    assert.strictEqual(result.status.target.entry.wcStatus.item, "modified");
    assert.strictEqual(result.status.target.entry.wcStatus.wcLocked, "true");
    assert.strictEqual(result.status.target.entry.wcStatus.revision, "123");

    // Verify nested commit
    assert.ok(result.status.target.entry.wcStatus.commit);
    assert.strictEqual(result.status.target.entry.wcStatus.commit.revision, "100");
    assert.strictEqual(result.status.target.entry.wcStatus.commit.author, "testuser");
  });

  test("parses SVN info XML with relative-url and wc-info", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<info>
  <entry kind="dir" path="." revision="150">
    <url>https://svn.example.com/repo/trunk</url>
    <relative-url>^/trunk</relative-url>
    <repository>
      <root>https://svn.example.com/repo</root>
      <uuid>abc-123</uuid>
    </repository>
    <wc-info>
      <wcroot-abspath>/home/user/repo</wcroot-abspath>
      <schedule>normal</schedule>
    </wc-info>
    <commit revision="150">
      <author>testuser</author>
      <date>2025-11-10T10:00:00.000000Z</date>
    </commit>
  </entry>
</info>`;

    const result = XmlParserAdapter.parse(xml, {
      mergeAttrs: true,
      explicitArray: false,
      camelcase: true
    });

    // Verify entry attributes merged
    assert.ok(result.info.entry);
    assert.strictEqual(result.info.entry.kind, "dir");
    assert.strictEqual(result.info.entry.path, ".");
    assert.strictEqual(result.info.entry.revision, "150");

    // CRITICAL: Verify hyphenated tag names
    assert.strictEqual(result.info.entry.relativeUrl, "^/trunk");
    assert.ok(result.info.entry.wcInfo);
    assert.strictEqual(result.info.entry.wcInfo.wcrootAbspath, "/home/user/repo");
    assert.strictEqual(result.info.entry.wcInfo.schedule, "normal");
  });

  test("parses SVN log XML with paths", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<log>
  <logentry revision="123">
    <author>testuser</author>
    <date>2025-11-10T10:00:00.000000Z</date>
    <msg>Test commit message</msg>
    <paths>
      <path kind="file" action="M">/trunk/file.txt</path>
      <path kind="file" action="A">/trunk/newfile.txt</path>
    </paths>
  </logentry>
</log>`;

    const result = XmlParserAdapter.parse(xml, {
      mergeAttrs: true,
      explicitArray: false,
      camelcase: true
    });

    // Verify logentry attributes merged
    assert.ok(result.log.logentry);
    assert.strictEqual(result.log.logentry.revision, "123");
    assert.strictEqual(result.log.logentry.author, "testuser");
    assert.strictEqual(result.log.logentry.msg, "Test commit message");

    // Verify paths array
    assert.ok(result.log.logentry.paths.path);
    assert.ok(Array.isArray(result.log.logentry.paths.path));
    assert.strictEqual(result.log.logentry.paths.path.length, 2);
    assert.strictEqual(result.log.logentry.paths.path[0].kind, "file");
    assert.strictEqual(result.log.logentry.paths.path[0].action, "M");
  });

  test("parses SVN status with multiple entries and changelist", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<status>
  <target path=".">
    <entry path="file1.txt">
      <wc-status props="none" item="modified"/>
    </entry>
    <entry path="file2.txt">
      <wc-status props="none" item="added"/>
    </entry>
  </target>
  <changelist name="my-changelist">
    <entry path="file3.txt">
      <wc-status props="none" item="modified"/>
    </entry>
  </changelist>
</status>`;

    const result = XmlParserAdapter.parse(xml, {
      mergeAttrs: true,
      explicitArray: false,
      camelcase: true
    });

    // Verify multiple entries become array
    assert.ok(Array.isArray(result.status.target.entry));
    assert.strictEqual(result.status.target.entry.length, 2);
    assert.strictEqual(result.status.target.entry[0].path, "file1.txt");
    assert.strictEqual(result.status.target.entry[1].path, "file2.txt");

    // Verify changelist
    assert.ok(result.status.changelist);
    assert.strictEqual(result.status.changelist.name, "my-changelist");
    assert.strictEqual(result.status.changelist.entry.path, "file3.txt");
  });

  test("handles empty XML elements", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<log>
  <logentry revision="125">
    <author>user</author>
    <date>2025-11-10T10:00:00.000000Z</date>
    <msg>Empty commit</msg>
  </logentry>
</log>`;

    const result = XmlParserAdapter.parse(xml, {
      mergeAttrs: true,
      explicitArray: false,
      camelcase: true
    });

    assert.ok(result.log.logentry);
    assert.strictEqual(result.log.logentry.revision, "125");
    // paths should be handled by parser normalization
  });

  test("parses text content with attributes (path elements)", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<paths>
  <path props="none" kind="file" item="modified">/trunk/test.txt</path>
</paths>`;

    const result = XmlParserAdapter.parse(xml, {
      mergeAttrs: true,
      explicitArray: false,
      camelcase: true
    });

    assert.ok(result.paths.path);
    assert.strictEqual(result.paths.path.props, "none");
    assert.strictEqual(result.paths.path.kind, "file");
    assert.strictEqual(result.paths.path.item, "modified");
    // Text content stored in #text
    assert.strictEqual(result.paths.path["#text"], "/trunk/test.txt");
  });

  test("handles boolean-like string attributes", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<entry path="test.txt">
  <wc-status wc-locked="true" switched="false"/>
</entry>`;

    const result = XmlParserAdapter.parse(xml, {
      mergeAttrs: true,
      explicitArray: false,
      camelcase: true
    });

    // Verify string values preserved (not converted to boolean)
    assert.strictEqual(result.entry.wcStatus.wcLocked, "true");
    assert.strictEqual(result.entry.wcStatus.switched, "false");
    assert.strictEqual(typeof result.entry.wcStatus.wcLocked, "string");
    assert.strictEqual(typeof result.entry.wcStatus.switched, "string");
  });
});
