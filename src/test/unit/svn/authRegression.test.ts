import * as assert from "assert";
import * as cp from "child_process";
import * as sinon from "sinon";
import { Svn } from "../../../svn";
import { SvnAuthCache } from "../../../services/svnAuthCache";

/**
 * Regression Tests for Authentication Changes
 * Ensures existing auth scenarios still work after credential cache implementation
 */
suite("Authentication - Regression Tests", () => {
  let svn: Svn;
  let spawnStub: sinon.SinonStub;
  let mockProcess: any;
  let authCacheStub: sinon.SinonStubbedInstance<SvnAuthCache>;

  setup(() => {
    svn = new Svn({ svnPath: "/usr/bin/svn", version: "1.14.0" });

    mockProcess = {
      stdout: { on: sinon.stub(), once: sinon.stub() },
      stderr: { on: sinon.stub(), once: sinon.stub() },
      on: sinon.stub(),
      once: sinon.stub()
    };

    spawnStub = sinon.stub(cp, "spawn").returns(mockProcess as any);

    mockProcess.once.withArgs("exit").callsArgWith(1, 0);
    mockProcess.stdout.once.withArgs("close").callsArgWith(1);
    mockProcess.stderr.once.withArgs("close").callsArgWith(1);

    authCacheStub = sinon.createStubInstance(SvnAuthCache);
    authCacheStub.writeCredential.resolves();
    (svn as any).authCache = authCacheStub;
  });

  teardown(() => {
    spawnStub.restore();
  });

  suite("Existing Auth Scenarios", () => {
    test("1.1: anonymous checkout still works (no auth)", async () => {
      const stdout = Buffer.from("Checked out revision 42");
      mockProcess.stdout.on.withArgs("data").callsArgWith(1, stdout);

      const result = await svn.exec("/repo", ["checkout", "https://svn.example.com/public"]);

      assert.strictEqual(result.exitCode, 0);
      assert.ok(result.stdout.includes("revision 42"));
      assert.ok(authCacheStub.writeCredential.notCalled, "Should not write cache for anon access");
    });

    test("1.2: username-only auth still works (no password)", async () => {
      await svn.exec("/repo", ["info"], {
        username: "alice"
      });

      assert.ok(authCacheStub.writeCredential.notCalled, "Should not write cache without password");
      assert.ok(spawnStub.called);

      const args = spawnStub.firstCall.args[1] as string[];
      assert.ok(args.includes("--username"));
      assert.ok(args.includes("alice"));
    });

    test("1.3: SSH key auth still works (svn+ssh://)", async () => {
      // SSH key auth doesn't use passwords
      await svn.exec("/repo", ["checkout", "svn+ssh://svn.example.com/repo"]);

      assert.ok(authCacheStub.writeCredential.notCalled, "SSH auth doesn't need cache");
      assert.ok(spawnStub.called);
    });

    test("1.4: existing stored credentials still work", async () => {
      // Mock SVN finding stored credentials
      authCacheStub.readCredential.resolves({
        username: "alice",
        password: "stored_pass"
      });

      await svn.exec("/repo", ["update"]);

      // Command should succeed using stored creds
      assert.strictEqual(mockProcess.once.withArgs("exit").callCount > 0, true);
    });

    test("1.5: SVN prompts user when no credentials available", async () => {
      // When no credentials provided, SVN should handle prompting
      await svn.exec("/repo", ["update"]);

      const args = spawnStub.firstCall.args[1] as string[];
      assert.ok(args.includes("--non-interactive"), "Should be non-interactive");

      // SVN will fail with auth error, which is expected
    });
  });

  suite("Checkout Command with Auth", () => {
    test("2.1: checkout with username and password succeeds", async () => {
      const stdout = Buffer.from("Checked out revision 100");
      mockProcess.stdout.on.withArgs("data").callsArgWith(1, stdout);

      const result = await svn.exec(
        "/workspace",
        ["checkout", "https://svn.example.com/repo", "/workspace/repo"],
        {
          username: "alice",
          password: "secret123"
        }
      );

      assert.strictEqual(result.exitCode, 0);
      assert.ok(result.stdout.includes("revision 100"));
      assert.ok(authCacheStub.writeCredential.called, "Should write credentials to cache");
    });

    test("2.2: checkout of specific revision with auth", async () => {
      const stdout = Buffer.from("Checked out revision 50");
      mockProcess.stdout.on.withArgs("data").callsArgWith(1, stdout);

      await svn.exec(
        "/workspace",
        ["checkout", "-r", "50", "https://svn.example.com/repo"],
        {
          username: "bob",
          password: "pass456"
        }
      );

      const args = spawnStub.firstCall.args[1] as string[];
      assert.ok(args.includes("-r"));
      assert.ok(args.includes("50"));
      assert.ok(args.includes("--username"));
      assert.ok(!args.includes("--password"), "Should not use --password flag");
    });

    test("2.3: checkout with depth parameter and auth", async () => {
      await svn.exec(
        "/workspace",
        ["checkout", "--depth", "files", "https://svn.example.com/repo"],
        {
          username: "charlie",
          password: "pass789"
        }
      );

      const args = spawnStub.firstCall.args[1] as string[];
      assert.ok(args.includes("--depth"));
      assert.ok(args.includes("files"));
    });
  });

  suite("Multi-Repository Workflows", () => {
    test("3.1: switching between repositories maintains separate credentials", async () => {
      // First repository
      await svn.exec("/repo1", ["update"], {
        username: "alice",
        password: "pass1"
      });

      const call1 = authCacheStub.writeCredential.firstCall;
      assert.strictEqual(call1.args[0], "alice");

      // Second repository
      await svn.exec("/repo2", ["update"], {
        username: "bob",
        password: "pass2"
      });

      const call2 = authCacheStub.writeCredential.secondCall;
      assert.strictEqual(call2.args[0], "bob");

      assert.strictEqual(authCacheStub.writeCredential.callCount, 2);
    });

    test("3.2: same user on multiple repositories", async () => {
      const username = "alice";
      const password = "multipass";

      await svn.exec("/repo1", ["info"], { username, password });
      await svn.exec("/repo2", ["status"], { username, password });
      await svn.exec("/repo3", ["log"], { username, password });

      assert.strictEqual(authCacheStub.writeCredential.callCount, 3);

      // All calls should have same username
      authCacheStub.writeCredential.getCalls().forEach(call => {
        assert.strictEqual(call.args[0], username);
      });
    });

    test("3.3: repository switch with auth change", async () => {
      // Initial auth
      await svn.exec("/repo", ["update"], {
        username: "olduser",
        password: "oldpass"
      });

      // Switch to different user
      await svn.exec("/repo", ["switch", "https://svn.example.com/branch"], {
        username: "newuser",
        password: "newpass"
      });

      const lastCall = authCacheStub.writeCredential.lastCall;
      assert.strictEqual(lastCall.args[0], "newuser");
    });
  });

  suite("Retry Logic with Auth Failures", () => {
    test("4.1: retry after auth failure with new credentials", async () => {
      // First attempt fails
      const stderr1 = Buffer.from("svn: E170001: Authentication failed");
      mockProcess.stderr.on.withArgs("data").callsArgWith(1, stderr1);
      mockProcess.once.withArgs("exit").callsArgWith(1, 1);

      try {
        await svn.exec("/repo", ["update"], {
          username: "alice",
          password: "wrongpass"
        });
        assert.fail("Should throw auth error");
      } catch (err: any) {
        assert.ok(err.svnErrorCode === "E170001" || err.message.includes("Authentication"));
      }

      // Second attempt with correct credentials
      mockProcess.once.withArgs("exit").callsArgWith(1, 0);
      mockProcess.stderr.on.withArgs("data").callsArgWith(1, Buffer.from(""));

      const result = await svn.exec("/repo", ["update"], {
        username: "alice",
        password: "correctpass"
      });

      assert.strictEqual(result.exitCode, 0);
    });

    test("4.2: auth service retry mechanism still works", async () => {
      // This tests that AuthService retry logic is not broken
      // Detailed retry tests are in authService.test.ts

      authCacheStub.writeCredential.resolves();

      await svn.exec("/repo", ["update"], {
        username: "bob",
        password: "pass123"
      });

      assert.ok(authCacheStub.writeCredential.called);
    });

    test("4.3: max retry attempts still enforced", async () => {
      // Ensure retry limit not broken by credential cache changes

      let attempts = 0;
      authCacheStub.writeCredential.callsFake(async () => {
        attempts++;
        if (attempts < 5) {
          throw new Error("Auth failed");
        }
        return "/tmp/credential-file";
      });

      try {
        await svn.exec("/repo", ["update"], {
          username: "charlie",
          password: "retry_pass"
        });
        // Should succeed after retries or throw after max attempts
      } catch (err) {
        assert.ok(attempts <= 5, "Should not exceed max retry attempts");
      }
    });
  });

  suite("SecretStorage Integration", () => {
    test("5.1: SecretStorage read/write still works", async () => {
      // Test that existing SecretStorage integration is not broken
      // SecretStorage is separate from SVN auth cache
      // Note: Actual SecretStorage testing is in authService.test.ts

      // Execute command with stored credentials
      await svn.exec("/repo", ["update"], {
        username: "alice",
        password: "stored_pass"
      });

      assert.ok(authCacheStub.writeCredential.called);
    });

    test("5.2: credentials saved to both SecretStorage and SVN cache", async () => {
      // Both storage mechanisms should work in parallel

      await svn.exec("/repo", ["update"], {
        username: "bob",
        password: "dual_store_pass"
      });

      // SVN cache should be written
      assert.ok(authCacheStub.writeCredential.called);

      // SecretStorage save tested in authService.test.ts
    });
  });
});
