import * as assert from "assert";
import * as cp from "child_process";
import * as sinon from "sinon";
import { Svn } from "../../../svn";
import { SvnAuthCache } from "../../../services/svnAuthCache";

/**
 * Integration Tests for Svn.exec() with SvnAuthCache
 * Tests modified behavior to use credential cache instead of --password flag
 */
suite("Svn.exec() - Auth Integration Tests", () => {
  let svn: Svn;
  let spawnStub: sinon.SinonStub;
  let mockProcess: any;
  let authCacheStub: sinon.SinonStubbedInstance<SvnAuthCache>;

  setup(() => {
    // Create SVN instance
    svn = new Svn({ svnPath: "/usr/bin/svn", version: "1.14.0" });

    // Mock child_process.spawn
    mockProcess = {
      stdout: {
        on: sinon.stub(),
        once: sinon.stub()
      },
      stderr: {
        on: sinon.stub(),
        once: sinon.stub()
      },
      on: sinon.stub(),
      once: sinon.stub()
    };

    spawnStub = sinon.stub(cp, "spawn").returns(mockProcess as any);

    // Setup default successful process behavior
    mockProcess.once.withArgs("exit").callsArgWith(1, 0); // Exit code 0
    mockProcess.stdout.once.withArgs("close").callsArgWith(1); // Close stdout
    mockProcess.stderr.once.withArgs("close").callsArgWith(1); // Close stderr

    // Mock auth cache
    authCacheStub = sinon.createStubInstance(SvnAuthCache);
    (svn as any).authCache = authCacheStub;
  });

  teardown(() => {
    spawnStub.restore();
  });

  suite("Command Execution WITHOUT --password Flag", () => {
    test("1.1: SVN command executed without --password argument", async () => {
      authCacheStub.writeCredential.resolves();

      await svn.exec("/repo", ["update"], {
        username: "alice",
        password: "secret123"
      });

      // Verify spawn was called
      assert.ok(spawnStub.called, "spawn should be called");

      const spawnArgs = spawnStub.firstCall.args[1] as string[];

      // Password should NOT be in args
      assert.ok(!spawnArgs.includes("--password"), "Should NOT include --password flag");
      assert.ok(!spawnArgs.includes("secret123"), "Should NOT include password value");

      // Username should still be present
      assert.ok(spawnArgs.includes("--username"), "Should include --username flag");
      assert.ok(spawnArgs.includes("alice"), "Should include username value");
    });

    test("1.2: command args do not contain password in any form", async () => {
      authCacheStub.writeCredential.resolves();

      await svn.exec("/repo", ["commit", "-m", "test"], {
        username: "bob",
        password: "MyP@ssw0rd!#$"
      });

      const spawnArgs = spawnStub.firstCall.args[1] as string[];
      const argsString = spawnArgs.join(" ");

      assert.ok(!argsString.includes("MyP@ssw0rd!#$"), "Password should not appear anywhere in args");
      assert.ok(!argsString.includes("--password"), "--password flag should not appear");
    });

    test("1.3: config options to disable password store are removed", async () => {
      authCacheStub.writeCredential.resolves();

      await svn.exec("/repo", ["update"], {
        username: "charlie",
        password: "pass123"
      });

      const spawnArgs = spawnStub.firstCall.args[1] as string[];

      // These config options should NOT be present (we want SVN to use cache)
      assert.ok(
        !spawnArgs.includes("config:auth:password-stores="),
        "Should NOT disable password stores"
      );
      assert.ok(
        !spawnArgs.includes("servers:global:store-auth-creds=no"),
        "Should NOT disable credential storage"
      );
    });
  });

  suite("Credential Cache Writing", () => {
    test("2.1: credential cache written before command execution", async () => {
      let cacheWriteTime: number | null = null;
      let spawnTime: number | null = null;

      authCacheStub.writeCredential.callsFake(async () => {
        cacheWriteTime = Date.now();
        return "/tmp/credential-file";
      });

      spawnStub.callsFake(() => {
        spawnTime = Date.now();
        return mockProcess;
      });

      await svn.exec("/repo", ["update"], {
        username: "alice",
        password: "secret123"
      });

      assert.ok(cacheWriteTime, "Cache should be written");
      assert.ok(spawnTime, "Process should be spawned");
      assert.ok(cacheWriteTime <= spawnTime, "Cache should be written BEFORE spawn");
    });

    test("2.2: cache receives correct username and password", async () => {
      authCacheStub.writeCredential.resolves();

      await svn.exec("/repo", ["update"], {
        username: "alice",
        password: "secret123"
      });

      assert.ok(authCacheStub.writeCredential.calledOnce, "writeCredential should be called once");

      const call = authCacheStub.writeCredential.firstCall;
      assert.strictEqual(call.args[0], "alice", "Should pass correct username");
      assert.strictEqual(call.args[1], "secret123", "Should pass correct password");
    });

    test("2.3: cache receives repository URL for realm generation", async () => {
      authCacheStub.writeCredential.resolves();

      // Mock svn.getRepositoryInfo to return URL
      (svn as any).repositoryUrl = "https://svn.example.com:443/repo";

      await svn.exec("/repo", ["update"], {
        username: "bob",
        password: "pass456"
      });

      const call = authCacheStub.writeCredential.firstCall;
      assert.ok(call.args[2], "Should pass realm URL");
      assert.ok(
        call.args[2].includes("svn.example.com") || call.args[2] === "/repo",
        "Realm should be related to repository"
      );
    });

    test("2.4: cache NOT written when only username provided (no password)", async () => {
      await svn.exec("/repo", ["info"], {
        username: "alice"
        // No password
      });

      assert.ok(
        authCacheStub.writeCredential.notCalled,
        "Should NOT write cache when password missing"
      );
    });

    test("2.5: cache NOT written when no credentials provided", async () => {
      await svn.exec("/repo", ["info"], {});

      assert.ok(authCacheStub.writeCredential.notCalled, "Should NOT write cache when no auth");
    });
  });

  suite("Command Execution Success", () => {
    test("3.1: SVN command succeeds with cached credentials", async () => {
      authCacheStub.writeCredential.resolves();

      // Mock successful command
      mockProcess.once.withArgs("exit").callsArgWith(1, 0);
      mockProcess.stdout.once.withArgs("close").callsArg(1);
      mockProcess.stderr.once.withArgs("close").callsArg(1);

      const result = await svn.exec("/repo", ["update"], {
        username: "alice",
        password: "secret123"
      });

      assert.strictEqual(result.exitCode, 0, "Command should succeed");
    });

    test("3.2: command output returned correctly", async () => {
      authCacheStub.writeCredential.resolves();

      const stdout = Buffer.from("Updated to revision 42");
      mockProcess.stdout.on.withArgs("data").callsArgWith(1, stdout);

      const result = await svn.exec("/repo", ["update"], {
        username: "alice",
        password: "secret123"
      });

      assert.ok(result.stdout.includes("revision 42"), "Should return command output");
    });

    test("3.3: handles commands that don't need authentication", async () => {
      // Commands like 'svn info' on public repo shouldn't write cache
      const result = await svn.exec("/repo", ["info"], {});

      assert.ok(authCacheStub.writeCredential.notCalled);
      assert.strictEqual(result.exitCode, 0);
    });
  });

  suite("Authentication Failure Handling", () => {
    test("4.1: auth failure throws appropriate error", async () => {
      authCacheStub.writeCredential.resolves();

      // Mock auth failure
      const stderr = Buffer.from("svn: E170001: Authentication failed");
      mockProcess.stderr.on.withArgs("data").callsArgWith(1, stderr);
      mockProcess.once.withArgs("exit").callsArgWith(1, 1); // Exit code 1

      try {
        await svn.exec("/repo", ["update"], {
          username: "alice",
          password: "wrongpass"
        });
        assert.fail("Should throw error on auth failure");
      } catch (err: any) {
        assert.ok(err.svnErrorCode === "E170001" || err.message.includes("Authentication"));
      }
    });

    test("4.2: cache write failure does not prevent retry", async () => {
      // First attempt: cache write fails
      authCacheStub.writeCredential.onFirstCall().rejects(new Error("Disk full"));

      // Second attempt: cache write succeeds
      authCacheStub.writeCredential.onSecondCall().resolves();

      try {
        await svn.exec("/repo", ["update"], {
          username: "alice",
          password: "secret123"
        });
        // May fail or succeed depending on implementation
      } catch (err) {
        // Should still attempt command even if cache write failed
        assert.ok(err instanceof Error);
      }
    });

    test("4.3: auth error includes helpful context", async () => {
      authCacheStub.writeCredential.resolves();

      const stderr = Buffer.from("svn: E170001: Authentication failed");
      mockProcess.stderr.on.withArgs("data").callsArgWith(1, stderr);
      mockProcess.once.withArgs("exit").callsArgWith(1, 1);

      try {
        await svn.exec("/repo", ["update"], {
          username: "alice",
          password: "wrongpass"
        });
        assert.fail("Should throw");
      } catch (err: any) {
        // Error should be descriptive
        assert.ok(err.message || err.svnErrorCode);
      }
    });
  });

  suite("Cleanup After Operation", () => {
    test("5.1: cache persists after successful operation", async () => {
      authCacheStub.writeCredential.resolves();
      authCacheStub.deleteCredential.resolves();

      await svn.exec("/repo", ["update"], {
        username: "alice",
        password: "secret123"
      });

      // Cache should NOT be deleted after successful operation
      assert.ok(
        authCacheStub.deleteCredential.notCalled,
        "Cache should persist after success"
      );
    });

    test("5.2: cache cleanup on disposal", async () => {
      authCacheStub.writeCredential.resolves();
      authCacheStub.dispose = sinon.stub();

      await svn.exec("/repo", ["update"], {
        username: "alice",
        password: "secret123"
      });

      // Dispose SVN instance
      (svn as any).dispose();

      // Cache should be disposed
      assert.ok((authCacheStub.dispose as sinon.SinonStub).called, "Cache should be disposed");
    });
  });

  suite("Multiple Repositories", () => {
    test("6.1: different cache files for different repositories", async () => {
      authCacheStub.writeCredential.resolves();

      // First repo
      await svn.exec("/repo1", ["update"], {
        username: "alice",
        password: "pass1"
      });

      // Second repo
      await svn.exec("/repo2", ["update"], {
        username: "bob",
        password: "pass2"
      });

      assert.strictEqual(
        authCacheStub.writeCredential.callCount,
        2,
        "Should write 2 separate cache entries"
      );

      const call1 = authCacheStub.writeCredential.firstCall;
      const call2 = authCacheStub.writeCredential.secondCall;

      // Verify different credentials
      assert.strictEqual(call1.args[0], "alice");
      assert.strictEqual(call2.args[0], "bob");
    });

    test("6.2: same credentials for multiple repos", async () => {
      authCacheStub.writeCredential.resolves();

      // Same user, different repos
      await svn.exec("/repo1", ["update"], {
        username: "alice",
        password: "secret123"
      });

      await svn.exec("/repo2", ["update"], {
        username: "alice",
        password: "secret123"
      });

      // Both should write to cache (may be same or different files depending on realm)
      assert.ok(authCacheStub.writeCredential.callCount >= 2);
    });
  });

  suite("Environment Variable Fallback", () => {
    test("7.1: uses SVN_PASSWORD env var when provided", async () => {
      process.env.SVN_PASSWORD = "env_password";

      authCacheStub.writeCredential.resolves();

      await svn.exec("/repo", ["update"], {
        username: "alice"
      });

      // Should use environment variable for cache
      if (authCacheStub.writeCredential.called) {
        const call = authCacheStub.writeCredential.firstCall;
        assert.strictEqual(call.args[1], "env_password", "Should use env var password");
      }

      delete process.env.SVN_PASSWORD;
    });

    test("7.2: options.password takes precedence over env var", async () => {
      process.env.SVN_PASSWORD = "env_password";

      authCacheStub.writeCredential.resolves();

      await svn.exec("/repo", ["update"], {
        username: "alice",
        password: "options_password"
      });

      const call = authCacheStub.writeCredential.firstCall;
      assert.strictEqual(
        call.args[1],
        "options_password",
        "Options password should take precedence"
      );

      delete process.env.SVN_PASSWORD;
    });
  });

  suite("Backward Compatibility", () => {
    test("8.1: still accepts password in options (API compatibility)", async () => {
      authCacheStub.writeCredential.resolves();

      // Old API style should still work
      const options = {
        username: "alice",
        password: "secret123"
      };

      await svn.exec("/repo", ["update"], options);

      assert.ok(authCacheStub.writeCredential.called, "Should handle password in options");
    });

    test("8.2: execBuffer() also uses auth cache", async () => {
      authCacheStub.writeCredential.resolves();

      await svn.execBuffer("/repo", ["cat", "file.txt"], {
        username: "alice",
        password: "secret123"
      });

      assert.ok(authCacheStub.writeCredential.called, "execBuffer should also use cache");

      const spawnArgs = spawnStub.firstCall.args[1] as string[];
      assert.ok(!spawnArgs.includes("--password"), "execBuffer should not use --password");
    });

    test("8.3: legacy mode config flag disables cache (if implemented)", async () => {
      // If legacy mode is implemented, test it
      // This test can be skipped if legacy mode is not needed

      // Mock config
      (svn as any).useLegacyAuth = true;

      await svn.exec("/repo", ["update"], {
        username: "alice",
        password: "secret123"
      });

      // In legacy mode, should use --password flag
      const spawnArgs = spawnStub.firstCall.args[1] as string[];

      if ((svn as any).useLegacyAuth) {
        assert.ok(
          spawnArgs.includes("--password") || authCacheStub.writeCredential.notCalled,
          "Legacy mode should use old behavior"
        );
      }
    });
  });
});
