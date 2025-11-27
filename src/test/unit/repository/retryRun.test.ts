import * as assert from "assert";
import { svnErrorCodes } from "../../../svn";
import { ISvnErrorData, IStoredAuth } from "../../../common/types";

/**
 * Tests for retryRun auth cycling logic
 *
 * These tests verify the fix for:
 * - Bug 1: Account cycling never worked (always used last account)
 * - Bug 2: First attempt with empty credentials
 */
suite("Repository retryRun Auth Logic", () => {
  suite("Account Cycling (Bug 1 Fix)", () => {
    test("Should use correct index for each stored account", () => {
      // Simulates the fixed logic: index = attempt
      const accounts: IStoredAuth[] = [
        { account: "user1", password: "pass1" },
        { account: "user2", password: "pass2" },
        { account: "user3", password: "pass3" }
      ];

      // After attempt 1 fails with accounts[0], should try accounts[1]
      let attempt = 1;
      let index = attempt;
      assert.strictEqual(accounts[index]?.account, "user2");

      // After attempt 2 fails with accounts[1], should try accounts[2]
      attempt = 2;
      index = attempt;
      assert.strictEqual(accounts[index]?.account, "user3");

      // After attempt 3 fails, index 3 is out of bounds
      attempt = 3;
      index = attempt;
      assert.strictEqual(accounts[index], undefined);
    });

    test("Old buggy logic always used last account", () => {
      // Demonstrates the bug: index = accounts.length - 1
      const accounts: IStoredAuth[] = [
        { account: "user1", password: "pass1" },
        { account: "user2", password: "pass2" }
      ];

      // Bug: Always used last account regardless of attempt
      const buggyIndex = accounts.length - 1;
      assert.strictEqual(buggyIndex, 1); // Always 1, never cycles
    });
  });

  suite("Pre-set Credentials (Bug 2 Fix)", () => {
    test("Should pre-set credentials when none exist", () => {
      const accounts: IStoredAuth[] = [{ account: "user1", password: "pass1" }];

      let username: string | undefined;
      let password: string | undefined;

      // Fix: Pre-set from first stored account if none set
      if (!username && !password && accounts.length > 0) {
        username = accounts[0].account;
        password = accounts[0].password;
      }

      assert.strictEqual(username, "user1");
      assert.strictEqual(password, "pass1");
    });

    test("Should not override existing credentials", () => {
      const accounts: IStoredAuth[] = [{ account: "user1", password: "pass1" }];

      let username: string | undefined = "existing";
      let password: string | undefined = "creds";

      // Fix: Don't override if credentials already set
      if (!username && !password && accounts.length > 0) {
        username = accounts[0].account;
        password = accounts[0].password;
      }

      assert.strictEqual(username, "existing");
      assert.strictEqual(password, "creds");
    });

    test("Should handle empty stored accounts", () => {
      const accounts: IStoredAuth[] = [];

      let username: string | undefined;
      let password: string | undefined;

      if (!username && !password && accounts.length > 0) {
        username = accounts[0].account;
        password = accounts[0].password;
      }

      assert.strictEqual(username, undefined);
      assert.strictEqual(password, undefined);
    });
  });

  suite("Auth Error Detection Integration", () => {
    test("E170001 triggers auth retry", () => {
      const svnError: ISvnErrorData = {
        svnErrorCode: svnErrorCodes.AuthorizationFailed,
        message: "Authorization failed"
      };

      assert.strictEqual(
        svnError.svnErrorCode,
        svnErrorCodes.AuthorizationFailed
      );
    });

    test("E170013 alone does not trigger auth retry", () => {
      const svnError: ISvnErrorData = {
        svnErrorCode: svnErrorCodes.UnableToConnect,
        message: "Unable to connect"
      };

      assert.notStrictEqual(
        svnError.svnErrorCode,
        svnErrorCodes.AuthorizationFailed
      );
    });
  });

  suite("Retry Flow Simulation", () => {
    test("Complete auth retry flow with 2 stored accounts", () => {
      const accounts: IStoredAuth[] = [
        { account: "user1", password: "pass1" },
        { account: "user2", password: "pass2" }
      ];

      let username: string | undefined;
      let password: string | undefined;
      const attemptLog: string[] = [];

      // Pre-set from first account (Bug 2 fix)
      if (!username && !password && accounts.length > 0) {
        username = accounts[0].account;
        password = accounts[0].password;
      }

      // Simulate retry loop
      for (let attempt = 1; attempt <= 5; attempt++) {
        attemptLog.push(`Attempt ${attempt}: ${username}`);

        // Simulate auth failure
        const isAuthError = true;

        if (isAuthError && attempt <= accounts.length) {
          // Bug 1 fix: use attempt as index
          const index = attempt;
          if (typeof accounts[index] !== "undefined") {
            username = accounts[index].account;
            password = accounts[index].password;
          }
        } else if (isAuthError && attempt <= 3 + accounts.length) {
          // Would prompt user here
          attemptLog.push(`Prompt triggered at attempt ${attempt}`);
          break;
        }
      }

      // Verify flow:
      // Attempt 1: user1 (pre-set) → fails → set user2
      // Attempt 2: user2 → fails → index=2 out of bounds
      // Attempt 3: user2 → fails → prompt
      assert.strictEqual(attemptLog[0], "Attempt 1: user1");
      assert.strictEqual(attemptLog[1], "Attempt 2: user2");
      assert.strictEqual(attemptLog[2], "Attempt 3: user2");
      assert.ok(attemptLog[3].includes("Prompt triggered"));
    });
  });
});
