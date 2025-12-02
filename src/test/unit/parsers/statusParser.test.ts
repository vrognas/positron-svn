import * as assert from "assert";
import { parseStatusXml } from "../../../parser/statusParser";
import { LockStatus } from "../../../common/types";

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
    assert.strictEqual(result[0]!.path, "file.txt");
    assert.strictEqual(result[0]!.status, "modified");
    assert.strictEqual(result[0]!.props, "none");
    assert.strictEqual(result[0]!.commit?.revision, "123");
    assert.strictEqual(result[0]!.commit?.author, "user");
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
    assert.strictEqual(result[0]!.changelist, "my-changelist");
    assert.strictEqual(result[0]!.path, "file1.txt");
    assert.strictEqual(result[0]!.status, "modified");
    assert.strictEqual(result[1]!.changelist, "my-changelist");
    assert.strictEqual(result[1]!.path, "file2.txt");
    assert.strictEqual(result[1]!.status, "added");
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
    assert.strictEqual(result[0]!.status, "external");
    assert.strictEqual(result[1]!.wcStatus.locked, true);
  });

  test("lockStatus K when wcLocked=true and no server check", async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<status>
  <target path=".">
    <entry path="myfile.txt">
      <wc-status props="none" item="normal" wc-locked="true">
        <commit revision="50"/>
      </wc-status>
    </entry>
  </target>
</status>`;

    const result = await parseStatusXml(xml);

    assert.strictEqual(result[0]!.wcStatus.hasLockToken, true);
    assert.strictEqual(result[0]!.wcStatus.lockStatus, LockStatus.K);
    assert.strictEqual(result[0]!.wcStatus.serverChecked, false);
  });

  test("lockStatus O when server has lock by another user", async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<status>
  <target path=".">
    <entry path="otherfile.txt">
      <wc-status props="none" item="normal">
        <commit revision="60"/>
      </wc-status>
      <repos-status props="none" item="none">
        <lock>
          <owner>otheruser</owner>
          <token>opaquelocktoken:12345</token>
          <created>2025-11-01T10:00:00.000000Z</created>
        </lock>
      </repos-status>
    </entry>
  </target>
</status>`;

    const result = await parseStatusXml(xml);

    assert.strictEqual(result[0]!.wcStatus.hasLockToken, false);
    assert.strictEqual(result[0]!.wcStatus.lockStatus, LockStatus.O);
    assert.strictEqual(result[0]!.wcStatus.lockOwner, "otheruser");
    assert.strictEqual(result[0]!.wcStatus.serverChecked, true);
  });

  test("lockStatus B when wcLocked=true but server has no lock (broken)", async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<status>
  <target path=".">
    <entry path="broken.txt">
      <wc-status props="none" item="normal" wc-locked="true">
        <commit revision="70"/>
      </wc-status>
      <repos-status props="none" item="none"/>
    </entry>
  </target>
</status>`;

    const result = await parseStatusXml(xml);

    assert.strictEqual(result[0]!.wcStatus.hasLockToken, true);
    assert.strictEqual(result[0]!.wcStatus.lockStatus, LockStatus.B);
    assert.strictEqual(result[0]!.wcStatus.serverChecked, true);
    assert.strictEqual(result[0]!.wcStatus.lockOwner, undefined);
  });
});
