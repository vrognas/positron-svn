import { describe, it, expect } from "vitest";
import { parseStatusXml } from "../../../src/parser/statusParser";

describe("Lock Status in Status Parser", () => {
  describe("Remote Lock Detection", () => {
    it("detects remote lock with owner info", async () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<status>
  <target path=".">
    <entry path="data.csv">
      <wc-status props="none" item="normal">
        <commit revision="100">
          <author>bob</author>
          <date>2025-11-20T10:00:00.000000Z</date>
        </commit>
      </wc-status>
      <repos-status props="none" item="normal">
        <lock>
          <token>opaquelocktoken:12345</token>
          <owner>alice</owner>
          <comment>Editing dataset</comment>
          <created>2025-11-28T14:00:00.000000Z</created>
        </lock>
      </repos-status>
    </entry>
  </target>
</status>`;

      const result = await parseStatusXml(xml);

      expect(result).toHaveLength(1);
      expect(result[0].wcStatus.locked).toBe(true);
      expect(result[0].reposStatus?.lock).toBeTruthy();
    });

    it("detects working copy lock (wc-locked)", async () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<status>
  <target path=".">
    <entry path="model.rds">
      <wc-status props="none" item="normal" wc-locked="true">
        <commit revision="150">
          <author>charlie</author>
          <date>2025-11-22T08:00:00.000000Z</date>
        </commit>
      </wc-status>
    </entry>
  </target>
</status>`;

      const result = await parseStatusXml(xml);

      expect(result).toHaveLength(1);
      expect(result[0].wcStatus.locked).toBe(true);
    });

    it("reports unlocked file correctly", async () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<status>
  <target path=".">
    <entry path="readme.txt">
      <wc-status props="none" item="modified">
        <commit revision="50">
          <author>user</author>
          <date>2025-11-10T10:00:00.000000Z</date>
        </commit>
      </wc-status>
    </entry>
  </target>
</status>`;

      const result = await parseStatusXml(xml);

      expect(result).toHaveLength(1);
      expect(result[0].wcStatus.locked).toBe(false);
    });
  });

  describe("Lock Info Extraction", () => {
    it("extracts lock owner from repos-status", async () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<status>
  <target path=".">
    <entry path="important.csv">
      <wc-status props="none" item="normal">
        <commit revision="200"/>
      </wc-status>
      <repos-status props="none" item="normal">
        <lock>
          <token>opaquelocktoken:99999</token>
          <owner>dave</owner>
          <comment>Critical update</comment>
          <created>2025-11-28T16:30:00.000000Z</created>
        </lock>
      </repos-status>
    </entry>
  </target>
</status>`;

      const result = await parseStatusXml(xml);

      expect(result).toHaveLength(1);
      const lockInfo = result[0].reposStatus?.lock;
      expect(lockInfo).toBeTruthy();
    });
  });
});
