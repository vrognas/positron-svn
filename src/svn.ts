// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import * as cp from "child_process";
import { EventEmitter } from "events";
import * as proc from "process";
import { Readable } from "stream";
import * as semver from "semver";
import {
  ConstructorPolicy,
  ICpOptions,
  IExecutionResult,
  ISvnOptions
} from "./common/types";
import * as encodeUtil from "./encoding";
import { configuration } from "./helpers/configuration";
import { parseInfoXml } from "./parser/infoParser";
import SvnError from "./svnError";
import { SvnAuthCache } from "./services/svnAuthCache";
import { Repository } from "./svnRepository";
import { dispose, IDisposable, toDisposable } from "./util";
import { logError } from "./util/errorLogger";
import { showSystemKeyringAuthNotification } from "./util/nativeStoreAuthNotification";
import { iconv } from "./vscodeModules";

export const svnErrorCodes: { [key: string]: string } = {
  AuthorizationFailed: "E170001",
  RepositoryIsLocked: "E155004",
  NotASvnRepository: "E155007",
  NotShareCommonAncestry: "E195012",
  WorkingCopyIsTooOld: "E155036",
  UnableToConnect: "E170013",
  NetworkTimeout: "E175002"
};

// Path separator pattern for cross-platform path splitting
const PATH_SEPARATOR_PATTERN = /[\\\/]+/;

// Default locale for SVN command execution
const DEFAULT_LOCALE = "en_US.UTF-8";

function getSvnErrorCode(stderr: string): string | undefined {
  // Priority: Check auth-related patterns FIRST
  // SVN may return E170013 (UnableToConnect) with E215004 (NoMoreCredentials)
  // We want to treat this as an auth error so retry logic triggers
  if (/No more credentials or we tried too many times/.test(stderr)) {
    return svnErrorCodes.AuthorizationFailed;
  }
  if (/E215004/.test(stderr)) {
    return svnErrorCodes.AuthorizationFailed;
  }

  for (const name in svnErrorCodes) {
    if (svnErrorCodes.hasOwnProperty(name)) {
      const code = svnErrorCodes[name];
      const regex = new RegExp(`svn: ${code}`);
      if (regex.test(stderr)) {
        return code;
      }
    }
  }

  return void 0;
}

export function cpErrorHandler(
  cb: (reason?: unknown) => void
): (reason?: unknown) => void {
  return err => {
    let error = err;
    if (err instanceof Error && /ENOENT/.test(err.message)) {
      error = new SvnError({
        error: err,
        message: "Failed to execute svn (ENOENT)",
        svnErrorCode: "NotASvnRepository"
      });
    }

    cb(error);
  };
}

export interface BufferResult {
  exitCode: number;
  stdout: Buffer;
  stderr: string;
}

export class Svn {
  public version: string;

  private svnPath: string;
  private lastCwd: string = "";
  private authCache: SvnAuthCache;

  private _onOutput = new EventEmitter();
  get onOutput(): EventEmitter {
    return this._onOutput;
  }

  constructor(options: ISvnOptions) {
    this.svnPath = options.svnPath;
    this.version = options.version;
    this.authCache = new SvnAuthCache();
  }

  public logOutput(output: string): void {
    this._onOutput.emit("log", output);
  }

  public getAuthCache(): SvnAuthCache {
    return this.authCache;
  }

  public async exec(
    cwd: string,
    args: string[],
    options: ICpOptions = {}
  ): Promise<IExecutionResult> {
    try {
      if (cwd) {
        this.lastCwd = cwd;
        options.cwd = cwd;
      }

      if (options.log !== false) {
        const argsOut = args.map(arg => (/ |^$/.test(arg) ? `'${arg}'` : arg));
        this.logOutput(
          `[${this.lastCwd.split(PATH_SEPARATOR_PATTERN).pop()}]$ svn ${argsOut.join(" ")}\n`
        );
      }

      // Check if system keyring caching is enabled (gnome-keyring, macOS Keychain, etc)
      const useSystemKeyring = configuration.get<boolean>(
        "auth.useSystemKeyring",
        false
      );

      // Note: Credential cache file approach removed - realm string varies per server
      // and we cannot compute the correct hash without server cooperation.

      if (options.username) {
        args.push("--username", options.username);
      }

      // Check if SVN 1.10+ for --password-from-stdin support (hides password from ps)
      const supportsStdinPassword = semver.gte(this.version, "1.10.0");
      let passwordForStdin: string | undefined;

      if (useSystemKeyring) {
        // System keyring mode: Pass password but keep native stores enabled
        // SVN will cache credentials in gnome-keyring/macOS Keychain/etc.
        if (options.password) {
          if (supportsStdinPassword) {
            args.push("--password-from-stdin");
            passwordForStdin = options.password;
          } else {
            args.push("--password", options.password);
          }
        }
        // Don't disable stores - let SVN cache credentials in system keyring
      } else {
        // Extension-only mode: Use --password and disable system keyring caching
        // Credentials stored only in VS Code's encrypted SecretStorage
        if (options.password) {
          if (supportsStdinPassword) {
            args.push("--password-from-stdin");
            passwordForStdin = options.password;
          } else {
            args.push("--password", options.password);
          }
        }

        if (options.username || options.password) {
          // Configuration format: FILE:SECTION:OPTION=[VALUE]
          // Disable all password stores to prevent credential confusion
          args.push("--config-option", "config:auth:password-stores=");
          args.push("--config-option", "servers:global:store-auth-creds=no");
        }
      }

      // Force non interactive environment
      args.push("--non-interactive");

      // Read configurable timeout (in seconds, convert to ms)
      const timeoutSeconds = configuration.get<number>(
        "auth.commandTimeout",
        60
      );
      const configuredTimeoutMs = timeoutSeconds * 1000;

      // Debug authentication indicators (never expose password values)
      const authMethod = supportsStdinPassword ? "stdin" : "--password";
      if (useSystemKeyring && options.password && options.log !== false) {
        this.logOutput(`[auth: system keyring + ${authMethod}]\n`);
      } else if (useSystemKeyring && options.log !== false) {
        this.logOutput(`[auth: system keyring]\n`);
      } else if (
        !useSystemKeyring &&
        options.password &&
        options.log !== false
      ) {
        this.logOutput(`[auth: extension-only (${authMethod})]\n`);
      } else if (
        options.username &&
        !options.password &&
        options.log !== false
      ) {
        this.logOutput(`[auth: username only]\n`);
      } else if (
        !options.username &&
        !options.password &&
        options.log !== false
      ) {
        this.logOutput(`[auth: none - will prompt if needed]\n`);
      }

      let encoding: string | undefined | null = options.encoding;
      delete options.encoding;

      // SVN with '--xml' always return 'UTF-8', and jschardet detects this encoding: 'TIS-620'
      if (args.includes("--xml")) {
        encoding = "utf8";
      }

      const defaults: cp.SpawnOptions = {
        env: proc.env
      };
      if (cwd) {
        defaults.cwd = cwd;
      }

      defaults.env = Object.assign({}, proc.env, options.env || {}, {
        LC_ALL: DEFAULT_LOCALE,
        LANG: DEFAULT_LOCALE
      });

      const process = cp.spawn(this.svnPath, args, defaults);

      // Write password via stdin if using --password-from-stdin (SVN 1.10+)
      // This hides password from process list (ps aux)
      if (passwordForStdin && process.stdin) {
        process.stdin.write(passwordForStdin);
        process.stdin.end();
      }

      const disposables: IDisposable[] = [];

      const once = <T extends unknown[]>(
        ee: NodeJS.EventEmitter,
        name: string,
        fn: (...args: T) => void
      ) => {
        ee.once(name, fn);
        disposables.push(toDisposable(() => ee.removeListener(name, fn)));
      };

      const on = <T extends unknown[]>(
        ee: NodeJS.EventEmitter,
        name: string,
        fn: (...args: T) => void
      ) => {
        ee.on(name, fn);
        disposables.push(toDisposable(() => ee.removeListener(name, fn)));
      };

      // Phase 12 perf fix - Add timeout to prevent hanging SVN commands
      // Use configured timeout from settings, or explicit option, or default
      const timeoutMs = options.timeout || configuredTimeoutMs;
      const timeoutPromise = new Promise<[number, Buffer, string]>(
        (_, reject) => {
          setTimeout(() => {
            process.kill();
            reject(
              new SvnError({
                message: `SVN command timeout after ${timeoutMs}ms`,
                svnCommand: args[0],
                exitCode: 124
              })
            );
          }, timeoutMs);
        }
      );

      // Phase 18 perf fix - Add cancellation token support
      const cancellationPromise = new Promise<[number, Buffer, string]>(
        (_, reject) => {
          if (options.token) {
            options.token.onCancellationRequested(() => {
              process.kill();
              reject(
                new SvnError({
                  message: `SVN command cancelled`,
                  svnCommand: args[0],
                  exitCode: 130
                })
              );
            });
          }
        }
      );

      const [exitCode, stdout, stderr] = await Promise.race([
        Promise.all([
          new Promise<number>((resolve, reject) => {
            once(process, "error", reject);
            once(process, "exit", resolve);
          }),
          new Promise<Buffer>(resolve => {
            const buffers: Buffer[] = [];
            on(process.stdout as Readable, "data", (b: Buffer) =>
              buffers.push(b)
            );
            once(process.stdout as Readable, "close", () =>
              resolve(Buffer.concat(buffers))
            );
          }),
          new Promise<string>(resolve => {
            const buffers: Buffer[] = [];
            on(process.stderr as Readable, "data", (b: Buffer) =>
              buffers.push(b)
            );
            once(process.stderr as Readable, "close", () =>
              resolve(Buffer.concat(buffers).toString())
            );
          })
        ]),
        timeoutPromise,
        ...(options.token ? [cancellationPromise] : [])
      ]);

      dispose(disposables);

      if (!encoding) {
        encoding = encodeUtil.detectEncoding(stdout);
      }

      // if not detected
      if (!encoding) {
        encoding = configuration.get<string>("default.encoding");
      }

      if (!iconv.encodingExists(encoding)) {
        if (encoding) {
          console.warn(`SVN: The encoding "${encoding}" is invalid`);
        }
        encoding = "utf8";
      }

      const decodedStdout = iconv.decode(stdout, encoding);

      if (options.log !== false && stderr.length > 0) {
        const name = this.lastCwd.split(PATH_SEPARATOR_PATTERN).pop();
        const err = stderr
          .split("\n")
          .filter((line: string) => line)
          .map((line: string) => `[${name}]$ ${line}`)
          .join("\n");
        this.logOutput(err);
      }

      if (exitCode) {
        const svnErrorCode = getSvnErrorCode(stderr);

        // Show notification for system keyring auth failures (keyring may need unlock)
        if (
          useSystemKeyring &&
          svnErrorCode === svnErrorCodes.AuthorizationFailed
        ) {
          // Fire and forget - don't await, just show notification
          showSystemKeyringAuthNotification();
        }

        return Promise.reject<IExecutionResult>(
          new SvnError({
            message: "Failed to execute svn",
            stdout: decodedStdout,
            stderr,
            stderrFormated: stderr.replace(/^svn: E\d+: +/gm, ""),
            exitCode,
            svnErrorCode,
            svnCommand: args[0]
          })
        );
      }

      return { exitCode, stdout: decodedStdout, stderr };
    } catch (err) {
      throw err;
    }
  }

  public async execBuffer(
    cwd: string,
    args: string[],
    options: ICpOptions = {}
  ): Promise<BufferResult> {
    try {
      if (cwd) {
        this.lastCwd = cwd;
        options.cwd = cwd;
      }

      if (options.log !== false) {
        const argsOut = args.map(arg => (/ |^$/.test(arg) ? `'${arg}'` : arg));
        this.logOutput(
          `[${this.lastCwd.split(PATH_SEPARATOR_PATTERN).pop()}]$ svn ${argsOut.join(" ")}\n`
        );
      }

      // Check if system keyring caching is enabled (gnome-keyring, macOS Keychain, etc)
      const useSystemKeyring = configuration.get<boolean>(
        "auth.useSystemKeyring",
        false
      );

      // Note: Credential cache file approach removed - realm string varies per server
      // and we cannot compute the correct hash without server cooperation.

      if (options.username) {
        args.push("--username", options.username);
      }

      // Check if SVN 1.10+ for --password-from-stdin support (hides password from ps)
      const supportsStdinPassword = semver.gte(this.version, "1.10.0");
      let passwordForStdin: string | undefined;

      if (useSystemKeyring) {
        // System keyring mode: Pass password but keep native stores enabled
        // SVN will cache credentials in gnome-keyring/macOS Keychain/etc.
        if (options.password) {
          if (supportsStdinPassword) {
            args.push("--password-from-stdin");
            passwordForStdin = options.password;
          } else {
            args.push("--password", options.password);
          }
        }
        // Don't disable stores - let SVN cache credentials in system keyring
      } else {
        // Extension-only mode: Use --password and disable system keyring caching
        // Credentials stored only in VS Code's encrypted SecretStorage
        if (options.password) {
          if (supportsStdinPassword) {
            args.push("--password-from-stdin");
            passwordForStdin = options.password;
          } else {
            args.push("--password", options.password);
          }
        }

        if (options.username || options.password) {
          // Configuration format: FILE:SECTION:OPTION=[VALUE]
          // Disable all password stores to prevent credential confusion
          args.push("--config-option", "config:auth:password-stores=");
          args.push("--config-option", "servers:global:store-auth-creds=no");
        }
      }

      // Force non interactive environment
      args.push("--non-interactive");

      // Read configurable timeout (in seconds, convert to ms)
      const timeoutSeconds = configuration.get<number>(
        "auth.commandTimeout",
        60
      );
      const configuredTimeoutMs = timeoutSeconds * 1000;

      // Debug authentication indicators (never expose password values)
      const authMethod = supportsStdinPassword ? "stdin" : "--password";
      if (useSystemKeyring && options.password && options.log !== false) {
        this.logOutput(`[auth: system keyring + ${authMethod}]\n`);
      } else if (useSystemKeyring && options.log !== false) {
        this.logOutput(`[auth: system keyring]\n`);
      } else if (
        !useSystemKeyring &&
        options.password &&
        options.log !== false
      ) {
        this.logOutput(`[auth: extension-only (${authMethod})]\n`);
      } else if (
        options.username &&
        !options.password &&
        options.log !== false
      ) {
        this.logOutput(`[auth: username only]\n`);
      } else if (
        !options.username &&
        !options.password &&
        options.log !== false
      ) {
        this.logOutput(`[auth: none - will prompt if needed]\n`);
      }

      const defaults: cp.SpawnOptions = {
        env: proc.env
      };
      if (cwd) {
        defaults.cwd = cwd;
      }

      defaults.env = Object.assign({}, proc.env, options.env || {}, {
        LC_ALL: DEFAULT_LOCALE,
        LANG: DEFAULT_LOCALE
      });

      const process = cp.spawn(this.svnPath, args, defaults);

      // Write password via stdin if using --password-from-stdin (SVN 1.10+)
      // This hides password from process list (ps aux)
      if (passwordForStdin && process.stdin) {
        process.stdin.write(passwordForStdin);
        process.stdin.end();
      }

      const disposables: IDisposable[] = [];

      const once = <T extends unknown[]>(
        ee: NodeJS.EventEmitter,
        name: string,
        fn: (...args: T) => void
      ) => {
        ee.once(name, fn);
        disposables.push(toDisposable(() => ee.removeListener(name, fn)));
      };

      const on = <T extends unknown[]>(
        ee: NodeJS.EventEmitter,
        name: string,
        fn: (...args: T) => void
      ) => {
        ee.on(name, fn);
        disposables.push(toDisposable(() => ee.removeListener(name, fn)));
      };

      // Phase 12 perf fix - Add timeout to prevent hanging SVN commands
      // Use configured timeout from settings, or explicit option, or default
      const timeoutMs = options.timeout || configuredTimeoutMs;
      const timeoutPromise = new Promise<[number, Buffer, string]>(
        (_, reject) => {
          setTimeout(() => {
            process.kill();
            reject(
              new SvnError({
                message: `SVN command timeout after ${timeoutMs}ms`,
                svnCommand: args[0],
                exitCode: 124
              })
            );
          }, timeoutMs);
        }
      );

      const [exitCode, stdout, stderr] = await Promise.race([
        Promise.all([
          new Promise<number>((resolve, reject) => {
            once(process, "error", reject);
            once(process, "exit", resolve);
          }),
          new Promise<Buffer>(resolve => {
            const buffers: Buffer[] = [];
            on(process.stdout as Readable, "data", (b: Buffer) =>
              buffers.push(b)
            );
            once(process.stdout as Readable, "close", () =>
              resolve(Buffer.concat(buffers))
            );
          }),
          new Promise<string>(resolve => {
            const buffers: Buffer[] = [];
            on(process.stderr as Readable, "data", (b: Buffer) =>
              buffers.push(b)
            );
            once(process.stderr as Readable, "close", () =>
              resolve(Buffer.concat(buffers).toString())
            );
          })
        ]),
        timeoutPromise
      ]);

      dispose(disposables);

      if (options.log !== false && stderr.length > 0) {
        const name = this.lastCwd.split(PATH_SEPARATOR_PATTERN).pop();
        const err = stderr
          .split("\n")
          .filter((line: string) => line)
          .map((line: string) => `[${name}]$ ${line}`)
          .join("\n");
        this.logOutput(err);
      }

      return { exitCode, stdout, stderr };
    } catch (err) {
      throw err;
    }
  }

  public async getRepositoryRoot(path: string) {
    try {
      const result = await this.exec(path, ["info", "--xml"]);

      const info = await parseInfoXml(result.stdout);

      if (info && info.wcInfo && info.wcInfo.wcrootAbspath) {
        return info.wcInfo.wcrootAbspath;
      }

      // SVN 1.6 not has "wcroot-abspath"
      return path;
    } catch (error) {
      if (error instanceof SvnError) {
        throw error;
      }
      logError("Find repository root failed", error);
      throw new Error("Unable to find repository root path");
    }
  }

  public async open(
    repositoryRoot: string,
    workspaceRoot: string
  ): Promise<Repository> {
    return new Repository(
      this,
      repositoryRoot,
      workspaceRoot,
      ConstructorPolicy.Async
    );
  }
}
