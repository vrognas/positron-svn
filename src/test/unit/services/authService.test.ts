import * as assert from "assert";
import { commands } from "vscode";
import { AuthService, ICredentialStorage } from "../../../services/authService";
import { IAuth, IStoredAuth, ISvnErrorData } from "../../../common/types";
import { svnErrorCodes } from "../../../svn";
import { Repository as SvnRepository } from "../../../svnRepository";

suite("AuthService Tests", () => {
  let authService: AuthService;
  let mockSvnRepo: Partial<SvnRepository>;
  let promptResults: (IAuth | undefined)[];
  let storedCreds: IStoredAuth[];

  // Mock storage
  class MockStorage implements ICredentialStorage {
    async load(): Promise<IStoredAuth[]> {
      return storedCreds;
    }
    async save(auth: IAuth): Promise<void> {
      storedCreds.push({ account: auth.username, password: auth.password });
    }
  }

  setup(() => {
    // Mock SvnRepository
    mockSvnRepo = {
      username: undefined,
      password: undefined
    };

    // Mock promptAuth command responses
    promptResults = [];
    const origExecuteCommand = commands.executeCommand;
    (commands as any).executeCommand = async (command: string, ...args: any[]) => {
      if (command === "svn.promptAuth") {
        return promptResults.shift();
      }
      return origExecuteCommand(command, ...args);
    };

    // Mock storage
    storedCreds = [];

    authService = new AuthService(
      mockSvnRepo as SvnRepository,
      {
        workspaceRoot: "/test/workspace",
        canSaveAuth: true,
        storage: new MockStorage()
      }
    );
  });

  test("isAuthError - detects authorization failed error", () => {
    const authError: ISvnErrorData = {
      error: new Error("Auth failed"),
      message: "Authorization failed",
      svnErrorCode: svnErrorCodes.AuthorizationFailed
    };

    assert.strictEqual(authService.isAuthError(authError), true);
  });

  test("isAuthError - ignores non-auth errors", () => {
    const otherError: ISvnErrorData = {
      error: new Error("Other error"),
      message: "Repository locked",
      svnErrorCode: svnErrorCodes.RepositoryIsLocked
    };

    assert.strictEqual(authService.isAuthError(otherError), false);
  });

  test("getCredentials - returns null when no credentials set", () => {
    const creds = authService.getCredentials();
    assert.strictEqual(creds, null);
  });

  test("getCredentials - returns credentials when set", () => {
    mockSvnRepo.username = "user1";
    mockSvnRepo.password = "pass1";

    const creds = authService.getCredentials();
    assert.deepStrictEqual(creds, { username: "user1", password: "pass1" });
  });

  test("getCredentials - returns null when only username set", () => {
    mockSvnRepo.username = "user1";
    mockSvnRepo.password = undefined;

    const creds = authService.getCredentials();
    assert.strictEqual(creds, null);
  });

  test("setCredentials - sets username and password", () => {
    authService.setCredentials({ username: "user1", password: "pass1" });

    assert.strictEqual(mockSvnRepo.username, "user1");
    assert.strictEqual(mockSvnRepo.password, "pass1");
  });

  test("setCredentials - clears credentials when null", () => {
    mockSvnRepo.username = "user1";
    mockSvnRepo.password = "pass1";

    authService.setCredentials(null);

    assert.strictEqual(mockSvnRepo.username, undefined);
    assert.strictEqual(mockSvnRepo.password, undefined);
  });

  test("clearCredentials - removes all credentials", () => {
    mockSvnRepo.username = "user1";
    mockSvnRepo.password = "pass1";

    authService.clearCredentials();

    assert.strictEqual(mockSvnRepo.username, undefined);
    assert.strictEqual(mockSvnRepo.password, undefined);
  });

  test("promptForCredentials - returns user input", async () => {
    promptResults.push({ username: "user1", password: "pass1" });

    const result = await authService.promptForCredentials();

    assert.deepStrictEqual(result, { username: "user1", password: "pass1" });
  });

  test("promptForCredentials - returns null on user cancel", async () => {
    promptResults.push(undefined);

    const result = await authService.promptForCredentials();

    assert.strictEqual(result, null);
  });

  test("retryWithAuth - succeeds on first attempt", async () => {
    let attempts = 0;
    const operation = async () => {
      attempts++;
      return "success";
    };

    const result = await authService.retryWithAuth(operation);

    assert.strictEqual(result, "success");
    assert.strictEqual(attempts, 1);
  });

  test("retryWithAuth - rethrows non-auth errors immediately", async () => {
    let attempts = 0;
    const operation = async () => {
      attempts++;
      const err: ISvnErrorData = {
        error: new Error("Locked"),
        message: "Repository locked",
        svnErrorCode: svnErrorCodes.RepositoryIsLocked
      };
      throw err;
    };

    await assert.rejects(
      () => authService.retryWithAuth(operation),
      (err: ISvnErrorData) => {
        return err.svnErrorCode === svnErrorCodes.RepositoryIsLocked;
      }
    );

    assert.strictEqual(attempts, 1, "Should not retry non-auth errors");
  });

  test("retryWithAuth - prompts user on auth failure", async () => {
    promptResults.push({ username: "user1", password: "pass1" });

    let attempts = 0;
    const operation = async () => {
      attempts++;
      if (attempts === 1) {
        const err: ISvnErrorData = {
          error: new Error("Auth failed"),
          message: "Authorization failed",
          svnErrorCode: svnErrorCodes.AuthorizationFailed
        };
        throw err;
      }
      return "success";
    };

    const result = await authService.retryWithAuth(operation);

    assert.strictEqual(result, "success");
    assert.strictEqual(attempts, 2);
    assert.strictEqual(mockSvnRepo.username, "user1");
    assert.strictEqual(mockSvnRepo.password, "pass1");
  });

  test("retryWithAuth - throws when user cancels prompt", async () => {
    promptResults.push(undefined); // User cancels

    let attempts = 0;
    const operation = async () => {
      attempts++;
      const err: ISvnErrorData = {
        error: new Error("Auth failed"),
        message: "Authorization failed",
        svnErrorCode: svnErrorCodes.AuthorizationFailed
      };
      throw err;
    };

    await assert.rejects(
      () => authService.retryWithAuth(operation),
      (err: ISvnErrorData) => {
        return err.svnErrorCode === svnErrorCodes.AuthorizationFailed;
      }
    );

    assert.strictEqual(attempts, 1, "Should not retry after user cancels");
  });

  test("retryWithAuth - exhausts max attempts", async () => {
    // User keeps providing wrong credentials
    promptResults.push(
      { username: "wrong1", password: "wrong1" },
      { username: "wrong2", password: "wrong2" },
      { username: "wrong3", password: "wrong3" }
    );

    let attempts = 0;
    const operation = async () => {
      attempts++;
      const err: ISvnErrorData = {
        error: new Error("Auth failed"),
        message: "Authorization failed",
        svnErrorCode: svnErrorCodes.AuthorizationFailed
      };
      throw err;
    };

    await assert.rejects(
      () => authService.retryWithAuth(operation, 4),
      (err: ISvnErrorData) => {
        return err.svnErrorCode === svnErrorCodes.AuthorizationFailed;
      }
    );

    assert.strictEqual(attempts, 4, "Should retry up to maxAttempts");
  });
});
