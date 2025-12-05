import { describe, it, expect } from "vitest";
import { parseStatusXml } from "../../../src/parser/statusParser";
import { LockStatus } from "../../../src/common/types";

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

    it("detects user lock via wc-status lock element", async () => {
      // User locks appear as <lock> child element inside <wc-status>
      // wc-locked="true" is for WC admin locks from 'svn cleanup', not user locks
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<status>
  <target path=".">
    <entry path="model.rds">
      <wc-status props="none" item="normal">
        <commit revision="150">
          <author>charlie</author>
          <date>2025-11-22T08:00:00.000000Z</date>
        </commit>
        <lock>
          <token>opaquelocktoken:12345</token>
          <owner>charlie</owner>
          <created>2025-11-22T08:00:00.000000Z</created>
        </lock>
      </wc-status>
    </entry>
  </target>
</status>`;

      const result = await parseStatusXml(xml);

      expect(result).toHaveLength(1);
      expect(result[0].wcStatus.locked).toBe(true);
      expect(result[0].wcStatus.hasLockToken).toBe(true);
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

  describe("Lock Status Badge Detection", () => {
    it("returns K when we have local token but no server check", async () => {
      // Local lock token is <lock> element inside <wc-status>
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<status>
  <target path=".">
    <entry path="myfile.csv">
      <wc-status props="none" item="normal">
        <commit revision="100"/>
        <lock>
          <token>opaquelocktoken:12345</token>
          <owner>myuser</owner>
          <created>2025-11-01T10:00:00.000000Z</created>
        </lock>
      </wc-status>
    </entry>
  </target>
</status>`;

      const result = await parseStatusXml(xml);

      expect(result[0].wcStatus.lockStatus).toBe(LockStatus.K);
      expect(result[0].wcStatus.hasLockToken).toBe(true);
      expect(result[0].wcStatus.serverChecked).toBe(false);
    });

    it("returns K when we have local token and server confirms our lock", async () => {
      // Parser returns K; T detection happens in StatusService when lockOwner !== username
      // Local lock token is <lock> element inside <wc-status>
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<status>
  <target path=".">
    <entry path="myfile.csv">
      <wc-status props="none" item="normal">
        <commit revision="100"/>
        <lock>
          <token>opaquelocktoken:12345</token>
          <owner>myuser</owner>
          <created>2025-11-01T10:00:00.000000Z</created>
        </lock>
      </wc-status>
      <repos-status props="none" item="none">
        <lock>
          <owner>myuser</owner>
          <token>opaquelocktoken:12345</token>
          <created>2025-11-01T10:00:00.000000Z</created>
        </lock>
      </repos-status>
    </entry>
  </target>
</status>`;

      const result = await parseStatusXml(xml);

      // Parser returns K; StatusService upgrades to T if lockOwner !== repository.username
      expect(result[0].wcStatus.lockStatus).toBe(LockStatus.K);
      expect(result[0].wcStatus.hasLockToken).toBe(true);
      expect(result[0].wcStatus.lockOwner).toBe("myuser");
      expect(result[0].wcStatus.serverChecked).toBe(true);
    });

    it("returns O when server has lock by another user (no local token)", async () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<status>
  <target path=".">
    <entry path="otherfile.csv">
      <wc-status props="none" item="normal">
        <commit revision="100"/>
      </wc-status>
      <repos-status props="none" item="none">
        <lock>
          <owner>otheruser</owner>
          <token>opaquelocktoken:99999</token>
          <created>2025-11-01T10:00:00.000000Z</created>
        </lock>
      </repos-status>
    </entry>
  </target>
</status>`;

      const result = await parseStatusXml(xml);

      expect(result[0].wcStatus.lockStatus).toBe(LockStatus.O);
      expect(result[0].wcStatus.hasLockToken).toBe(false);
      expect(result[0].wcStatus.lockOwner).toBe("otheruser");
    });

    it("returns B when we have local token but server shows no lock (broken)", async () => {
      // Local lock token is <lock> element inside <wc-status>
      // Server shows no lock - our token is stale/broken
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<status>
  <target path=".">
    <entry path="broken.csv">
      <wc-status props="none" item="normal">
        <commit revision="100"/>
        <lock>
          <token>opaquelocktoken:stale</token>
          <owner>myuser</owner>
          <created>2025-01-01T10:00:00.000000Z</created>
        </lock>
      </wc-status>
      <repos-status props="none" item="none"/>
    </entry>
  </target>
</status>`;

      const result = await parseStatusXml(xml);

      expect(result[0].wcStatus.lockStatus).toBe(LockStatus.B);
      expect(result[0].wcStatus.hasLockToken).toBe(true);
      // Lock owner comes from local token when server has no lock
      expect(result[0].wcStatus.lockOwner).toBe("myuser");
      expect(result[0].wcStatus.serverChecked).toBe(true);
    });
  });
});
