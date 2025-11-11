import * as assert from "assert";
import { ConstructorPolicy, ICpOptions, ISvnOptions } from "../common/types";
import { Svn } from "../svn";
import { Repository } from "../svnRepository";

suite("Svn Repository Tests", () => {
  let svn: Svn | null;
  const options = {
    svnPath: "svn",
    version: "1.9"
  } as ISvnOptions;

  suiteSetup(async () => {
    // svn = new Svn(options);
  });

  suiteTeardown(() => {
    svn = null;
  });

  test("Test getStatus", async () => {
    svn = new Svn(options);
    const repository = await new Repository(
      svn,
      "/tmp",
      "/tpm",
      ConstructorPolicy.LateInit
    );
    repository.exec = async (_args: string[], _options?: ICpOptions) => {
      return {
        exitCode: 1,
        stderr: "",
        stdout: `<?xml version="1.0" encoding="UTF-8"?> <status> <target path="."> <entry path="test.php"> <wc-status item="modified" revision="19" props="none"> <commit revision="19"> <author>chris</author> <date>2018-09-06T17:26:59.815389Z</date> </commit> </wc-status> </entry> <entry path="newfiletester.php"> <wc-status item="modified" revision="19" props="none"> <commit revision="19"> <author>chris</author> <date>2018-09-06T17:26:59.815389Z</date> </commit> </wc-status> </entry> <entry path="added.php"> <wc-status item="unversioned" props="none"> </wc-status> </entry> <against revision="19"/> </target> </status>`
      };
    };

    const status = await repository.getStatus({});

    assert.equal(status[0].path, "test.php");
    assert.equal(status[1].path, "newfiletester.php");
    assert.equal(status[2].path, "added.php");
  });

  test("Test rename", async () => {
    svn = new Svn(options);
    const repository = await new Repository(
      svn,
      "/tmp",
      "/tpm",
      ConstructorPolicy.LateInit
    );
    repository.exec = async (args: string[], _options?: ICpOptions) => {
      assert.equal(args[0].includes("rename"), true);
      assert.equal(args[1].includes("test.php"), true);
      assert.equal(args[2].includes("tester.php"), true);

      return {
        exitCode: 1,
        stderr: "",
        stdout: `
        A         test.php
        D         tester.php
        `
      };
    };

    await repository.rename("test.php", "tester.php");
  });

  test("Test addChangelist validation - invalid name", async () => {
    svn = new Svn(options);
    const repository = await new Repository(
      svn,
      "/tmp",
      "/tpm",
      ConstructorPolicy.LateInit
    );

    try {
      await repository.addChangelist(["test.php"], "invalid@name");
      assert.fail("Should throw on invalid changelist name");
    } catch (e: unknown) {
      assert.match((e as Error).message, /Invalid changelist name/);
    }
  });

  test("Test addChangelist validation - valid name", async () => {
    svn = new Svn(options);
    const repository = await new Repository(
      svn,
      "/tmp",
      "/tpm",
      ConstructorPolicy.LateInit
    );
    repository.exec = async (args: string[]) => {
      assert.equal(args[0], "changelist");
      assert.equal(args[1], "valid_name-123");
      return { exitCode: 0, stderr: "", stdout: "" };
    };

    await repository.addChangelist(["test.php"], "valid_name-123");
  });

  test("Test merge validation - invalid accept action", async () => {
    svn = new Svn(options);
    const repository = await new Repository(
      svn,
      "/tmp",
      "/tpm",
      ConstructorPolicy.LateInit
    );

    try {
      await repository.merge("trunk", false, "invalid_action");
      assert.fail("Should throw on invalid accept action");
    } catch (e: unknown) {
      assert.match((e as Error).message, /Invalid accept action/);
    }
  });

  test("Test merge validation - valid accept action", async () => {
    svn = new Svn(options);
    const repository = await new Repository(
      svn,
      "/tmp",
      "/tpm",
      ConstructorPolicy.LateInit
    );
    repository.getRepoUrl = async () => "http://repo/svn";
    repository.exec = async (args: string[]) => {
      assert.equal(args[0], "merge");
      assert.equal(args[1], "--accept");
      assert.equal(args[2], "postpone");
      return { exitCode: 0, stderr: "", stdout: "" };
    };

    await repository.merge("trunk", false, "postpone");
  });

  test("Test plainLogByText validation - invalid pattern", async () => {
    svn = new Svn(options);
    const repository = await new Repository(
      svn,
      "/tmp",
      "/tpm",
      ConstructorPolicy.LateInit
    );

    try {
      await repository.plainLogByText("pattern;rm -rf /");
      assert.fail("Should throw on invalid search pattern");
    } catch (e: unknown) {
      assert.match((e as Error).message, /Invalid search pattern/);
    }
  });

  test("Test plainLogByText validation - valid pattern", async () => {
    svn = new Svn(options);
    const repository = await new Repository(
      svn,
      "/tmp",
      "/tpm",
      ConstructorPolicy.LateInit
    );
    repository.exec = async (args: string[]) => {
      assert.equal(args[0], "log");
      assert.equal(args[1], "--search");
      assert.equal(args[2], "bugfix");
      return { exitCode: 0, stderr: "", stdout: "" };
    };

    await repository.plainLogByText("bugfix");
  });

  test("Test getStatus with externals (parallel fetch)", async () => {
    svn = new Svn(options);
    const repository = await new Repository(
      svn,
      "/tmp",
      "/tpm",
      ConstructorPolicy.LateInit
    );

    let getInfoCallCount = 0;
    const callTimes: number[] = [];

    repository.exec = async (args: string[], _options?: ICpOptions) => {
      if (args[0] === "info") {
        getInfoCallCount++;
        const callTime = Date.now();
        callTimes.push(callTime);
        await new Promise(r => setTimeout(r, 50));
        return {
          exitCode: 0,
          stderr: "",
          stdout: `<?xml version="1.0"?><info><repository><uuid>uuid-${getInfoCallCount}</uuid></repository></info>`
        };
      }
      return {
        exitCode: 0,
        stderr: "",
        stdout: `<?xml version="1.0"?><status><target path="."><entry path="ext1"><wc-status item="external"/></entry><entry path="ext2"><wc-status item="external"/></entry><entry path="ext3"><wc-status item="external"/></entry></target></status>`
      };
    };

    const startTime = Date.now();
    const status = await repository.getStatus({});
    const elapsed = Date.now() - startTime;

    // Verify all 3 externals processed
    const externals = status.filter((s: any) => s.status === 8);
    assert.equal(externals.length, 3);

    // Verify getInfo called 3 times
    assert.equal(getInfoCallCount, 3);

    // Verify UUIDs assigned
    const withUuid = status.filter((s: any) => s.repositoryUuid);
    assert.equal(withUuid.length, 3);

    // Verify parallel execution (< 150ms for 3x50ms ops)
    assert.ok(elapsed < 150, `Should run in parallel: got ${elapsed}ms`);
  });
});
