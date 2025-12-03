// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { spawn } from "child_process";

/**
 * SVN Credential Cache Service
 *
 * Manages SVN credential files in ~/.subversion/auth/svn.simple/
 * Implements secure file-based credential storage to avoid exposing
 * passwords in process arguments (CVSS 7.5 → 3.2).
 *
 * Security Features:
 * - Unix: File mode 600 (owner read/write only)
 * - Windows: ACL restricted to current user via icacls
 * - Ephemeral: Credentials deleted after use (RAII pattern)
 * - Standard SVN format: Compatible with native SVN client
 *
 * Extracted to address credential exposure vulnerability in svn.ts:119-124
 */
export class SvnAuthCache {
  private readonly cacheDir: string;
  private readonly writtenFiles: Set<string> = new Set();

  /**
   * @param svnConfigDir Override SVN config directory (for testing)
   */
  constructor(svnConfigDir?: string) {
    const homeDir = os.homedir();
    const baseDir = svnConfigDir || path.join(homeDir, ".subversion");
    this.cacheDir = path.join(baseDir, "auth", "svn.simple");
  }

  /**
   * Write credential to cache file
   * Creates file with SVN K-V format and secure permissions
   *
   * @param username SVN username
   * @param password SVN password
   * @param realmUrl Repository URL (used to compute realm)
   * @returns Absolute path to created credential file
   */
  async writeCredential(
    username: string,
    password: string,
    realmUrl: string
  ): Promise<string> {
    // Ensure cache directory exists
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true, mode: 0o700 });
    }

    const realm = this.computeRealm(realmUrl);
    const hash = this.computeHash(realm);
    const filePath = path.join(this.cacheDir, hash);

    // Format credential file in SVN K-V format
    const content = this.formatCredentialFile(username, password, realm);

    // Write file (async for consistency, though could be sync)
    await fs.promises.writeFile(filePath, content, { encoding: "utf8" });

    // Set secure permissions
    await this.setFilePermissions(filePath);

    // Track written files for cleanup
    this.writtenFiles.add(filePath);

    return filePath;
  }

  /**
   * Read credential from cache file
   *
   * @param realmUrl Repository URL
   * @returns Credentials if found, null otherwise
   */
  async readCredential(
    realmUrl: string
  ): Promise<{ username: string; password: string } | null> {
    const realm = this.computeRealm(realmUrl);
    const hash = this.computeHash(realm);
    const filePath = path.join(this.cacheDir, hash);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const content = await fs.promises.readFile(filePath, "utf8");
      return this.parseCredentialFile(content);
    } catch (err) {
      // Re-throw permission errors
      if ((err as NodeJS.ErrnoException).code === "EACCES") {
        throw err;
      }
      // Return null for other errors (corrupt file, etc.)
      return null;
    }
  }

  /**
   * Delete credential from cache
   * Idempotent - safe to call multiple times
   *
   * @param realmUrl Repository URL
   */
  async deleteCredential(realmUrl: string): Promise<void> {
    const realm = this.computeRealm(realmUrl);
    const hash = this.computeHash(realm);
    const filePath = path.join(this.cacheDir, hash);

    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }

    this.writtenFiles.delete(filePath);
  }

  /**
   * Get list of files written by this instance
   * Used for testing and cleanup tracking
   */
  getWrittenFiles(): string[] {
    return Array.from(this.writtenFiles);
  }

  /**
   * Clear tracking of written files
   * Used for testing (does not delete files)
   */
  clearCache(): void {
    this.writtenFiles.clear();
  }

  /**
   * Get cache directory path
   * Used for testing
   */
  getCacheDirectory(): string {
    return this.cacheDir;
  }

  /**
   * Dispose and cleanup all tracked credential files
   * Called on extension deactivation
   */
  dispose(): void {
    // Synchronous cleanup for dispose
    for (const filePath of this.writtenFiles) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (err) {
        // Security: Don't log raw error (may contain sensitive paths)
        console.error(
          `[SvnAuthCache] Failed to delete credential file: ${(err as Error).message}`
        );
      }
    }
    this.writtenFiles.clear();
  }

  /**
   * Compute SVN realm string from repository URL
   * Format: <scheme://host:port> Authentication Realm
   *
   * Examples:
   * - https://svn.example.com:443/repo → <https://svn.example.com:443> Authentication Realm
   * - svn://svn.local/repo → <svn://svn.local> Authentication Realm
   */
  private computeRealm(realmUrl: string): string {
    try {
      const url = new URL(realmUrl);
      const scheme = url.protocol.replace(":", ""); // Remove trailing colon

      // Default ports
      const defaultPorts: Record<string, number> = {
        http: 80,
        https: 443,
        svn: 3690
      };

      // Parse host and port
      const hostPart = url.hostname;
      const port = url.port || String(defaultPorts[scheme] || "");

      // Include port in realm if non-default
      const hostWithPort = port ? `${hostPart}:${port}` : hostPart;

      return `<${scheme}://${hostWithPort}> Authentication Realm`;
    } catch (err) {
      // Fallback for invalid URLs
      return `<${realmUrl}> Authentication Realm`;
    }
  }

  /**
   * Compute MD5 hash of realm for filename
   * SVN uses MD5(realm) as credential file name
   */
  private computeHash(realm: string): string {
    return crypto.createHash("md5").update(realm, "utf8").digest("hex");
  }

  /**
   * Format credential file in SVN K-V format
   *
   * Format: K <length>\n<key>\nV <length>\n<value>\n
   * Ends with: END\n
   */
  private formatCredentialFile(
    username: string,
    password: string,
    realm: string
  ): string {
    const lines: string[] = [];

    // Add key-value pairs
    const addKV = (key: string, value: string) => {
      lines.push(`K ${key.length}`);
      lines.push(key);
      lines.push(`V ${value.length}`);
      lines.push(value);
    };

    addKV("svn:realmstring", realm);
    addKV("username", username);
    addKV("password", password);

    // End marker
    lines.push("END");

    return lines.join("\n") + "\n";
  }

  /**
   * Parse SVN K-V format credential file
   * Returns null if file is corrupt or missing required fields
   */
  private parseCredentialFile(
    content: string
  ): { username: string; password: string } | null {
    if (!content || content.trim() === "") {
      return null;
    }

    try {
      const lines = content.split("\n");
      const values: Record<string, string> = {};
      let i = 0;

      while (i < lines.length) {
        const line = lines[i]!.trim();

        // End marker
        if (line === "END") {
          break;
        }

        // Key line: K <length>
        if (line.startsWith("K ")) {
          // Bounds check: need at least 3 more lines (key, V, value)
          if (i + 3 >= lines.length) {
            return null; // Truncated file - not enough lines
          }

          const key = lines[i + 1];

          // Value line: V <length>
          const valueLine = lines[i + 2];
          if (!valueLine || !valueLine.startsWith("V ")) {
            return null; // Corrupt format
          }

          const value = lines[i + 3];

          if (key && value !== undefined) {
            values[key] = value;
          }

          i += 4; // Skip K, key, V, value lines
        } else {
          i++;
        }
      }

      // Extract username and password
      const username = values["username"];
      const password = values["password"];

      if (!username || !password) {
        return null; // Missing required fields
      }

      return { username, password };
    } catch (err) {
      // Parsing error - corrupt file
      return null;
    }
  }

  /**
   * Validate Windows username to prevent command injection (defense in depth)
   * Blocks shell metacharacters: & | ; < > ( ) $ ` \ " ' % and control characters
   * Note: % blocks environment variable expansion attacks (%APPDATA%, etc.)
   *
   * @param username - Username from environment variable
   * @returns true if username is safe for use in icacls command
   */
  private isValidWindowsUsername(username: string | undefined): boolean {
    if (!username || username.length === 0 || username.length > 255) {
      return false;
    }

    // Block shell metacharacters, % (env var expansion), and control characters
    const dangerousChars = /[&|;<>()$`\\"'%\n\r\t\x00-\x1F\x7F]/;
    if (dangerousChars.test(username)) {
      return false;
    }

    return true;
  }

  /**
   * Set secure file permissions
   * - Unix: mode 600 (owner read/write only)
   * - Windows: ACL restricted to current user
   */
  private async setFilePermissions(filePath: string): Promise<void> {
    if (process.platform === "win32") {
      // Windows: Use icacls to set ACL
      await this.setWindowsACL(filePath);
    } else {
      // Unix: Set mode 600
      await fs.promises.chmod(filePath, 0o600);
    }
  }

  /**
   * Set Windows ACL to restrict file to current user
   * Uses icacls command: /inheritance:r (remove inherited), /grant:r (grant replace)
   *
   * SECURITY: shell:false prevents command injection. icacls.exe is in System32 and
   * available via PATH by default on all Windows systems. Args passed as array elements
   * are not interpreted by shell, blocking injection attacks.
   */
  private async setWindowsACL(filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const username = process.env.USERNAME || process.env.USER;

      // Validate username to block shell metacharacters (defense in depth)
      if (!this.isValidWindowsUsername(username)) {
        reject(new Error(`Invalid Windows username: ${username}`));
        return;
      }

      const args = [
        filePath,
        "/inheritance:r", // Remove inherited permissions
        "/grant:r",
        `${username}:F` // Grant full control to current user only
      ];

      const proc = spawn("icacls", args, {
        stdio: "pipe",
        shell: false // SECURITY: Prevent command injection
      });

      let stderr = "";
      proc.stderr.on("data", data => {
        stderr += data.toString();
      });

      proc.on("close", code => {
        if (code !== 0) {
          reject(new Error(`icacls failed with code ${code}: ${stderr}`));
        } else {
          resolve();
        }
      });

      proc.on("error", err => {
        // icacls not available - reject to prevent creating file with insecure permissions
        reject(new Error(`Failed to set Windows ACL: ${err.message}`));
      });
    });
  }
}
