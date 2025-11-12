import { commands } from "vscode";
import { IAuth, IStoredAuth, ISvnErrorData } from "../common/types";
import { svnErrorCodes } from "../svn";
import { Repository as SvnRepository } from "../svnRepository";

/**
 * Storage interface for credential persistence
 * Injected by Repository to decouple from SecretStorage
 */
export interface ICredentialStorage {
  load(): Promise<IStoredAuth[]>;
  save(auth: IAuth): Promise<void>;
}

/**
 * Configuration for auth service
 */
export interface AuthServiceConfig {
  readonly workspaceRoot: string;
  readonly canSaveAuth: boolean;
  readonly storage: ICredentialStorage;
}

/**
 * Centralized authentication service for SVN operations.
 *
 * Responsibilities:
 * - Detect auth errors
 * - Manage credentials (prompt, load, save)
 * - Provide auth state queries
 *
 * Security:
 * - Single point for credential access
 * - Consistent error handling
 * - Audit trail for auth operations
 *
 * Extracted from scattered logic across:
 * - repository.ts (promptAuth, loadStoredAuths, saveAuth, retry logic)
 * - svn.ts (error code detection)
 * - svnRepository.ts (username/password fields)
 */
export class AuthService {
  constructor(
    private readonly svnRepository: SvnRepository,
    private readonly config: AuthServiceConfig
  ) {}

  /**
   * Check if error is an authorization failure
   */
  public isAuthError(error: ISvnErrorData): boolean {
    return error.svnErrorCode === svnErrorCodes.AuthorizationFailed;
  }

  /**
   * Get current credentials
   */
  public getCredentials(): IAuth | null {
    const username = this.svnRepository.username;
    const password = this.svnRepository.password;

    if (!username || !password) {
      return null;
    }

    return { username, password };
  }

  /**
   * Set credentials
   */
  public setCredentials(auth: IAuth | null): void {
    if (!auth) {
      this.svnRepository.username = undefined;
      this.svnRepository.password = undefined;
    } else {
      this.svnRepository.username = auth.username;
      this.svnRepository.password = auth.password;
    }
  }

  /**
   * Prompt user for credentials
   * Returns null if user cancels
   */
  public async promptForCredentials(
    prevUsername?: string,
    prevPassword?: string
  ): Promise<IAuth | null> {
    const result = await commands.executeCommand<IAuth | undefined>(
      "svn.promptAuth",
      prevUsername,
      prevPassword
    );

    return result ?? null;
  }

  /**
   * Load stored credentials from workspace storage
   * Returns array of stored auth entries (newest first)
   */
  public async loadStoredCredentials(): Promise<IStoredAuth[]> {
    return this.config.storage.load();
  }

  /**
   * Save current credentials to workspace storage
   * Only saves if canSaveAuth is true and credentials exist
   */
  public async saveCredentials(): Promise<void> {
    if (!this.config.canSaveAuth) {
      return;
    }

    const creds = this.getCredentials();
    if (!creds) {
      return;
    }

    await this.config.storage.save(creds);
  }

  /**
   * Clear all credentials (runtime + stored)
   */
  public clearCredentials(): void {
    this.setCredentials(null);
  }

  /**
   * Attempt authentication with retry logic
   *
   * Strategy:
   * 1. Try with current credentials
   * 2. Try stored credentials (if available)
   * 3. Prompt user (up to 3 attempts)
   *
   * @param operation - Async operation to retry
   * @param maxAttempts - Maximum retry attempts (default: 5)
   * @returns Operation result
   * @throws Last error if all attempts fail
   */
  public async retryWithAuth<T>(
    operation: () => Promise<T>,
    maxAttempts: number = 5
  ): Promise<T> {
    const storedAccounts = await this.loadStoredCredentials();
    let attempt = 0;

    while (attempt < maxAttempts) {
      attempt++;

      try {
        const result = await operation();
        // Success - save credentials if changed
        await this.saveCredentials();
        return result;
      } catch (err) {
        const svnError = err as ISvnErrorData;

        if (!this.isAuthError(svnError)) {
          // Not an auth error - rethrow immediately
          throw err;
        }

        // Auth error - try recovery
        if (attempt <= storedAccounts.length) {
          // Try stored credentials (attempt 1, 2, ...)
          const index = attempt - 1;
          const stored = storedAccounts[index];
          this.setCredentials({
            username: stored.account,
            password: stored.password
          });
          continue;
        }

        if (attempt <= 3 + storedAccounts.length) {
          // Prompt user (attempts after stored accounts exhausted)
          const currentCreds = this.getCredentials();
          const result = await this.promptForCredentials(
            currentCreds?.username,
            currentCreds?.password
          );

          if (!result) {
            // User cancelled - rethrow
            throw err;
          }

          this.setCredentials(result);
          continue;
        }

        // All attempts exhausted - rethrow
        throw err;
      }
    }

    throw new Error(`Auth retry failed after ${maxAttempts} attempts`);
  }
}
