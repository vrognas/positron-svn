// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import * as path from "path";
import * as tmp from "tmp";
import { Uri, workspace } from "vscode";
import {
  ConstructorPolicy,
  ICpOptions,
  IExecutionResult,
  IFileStatus,
  ILockOptions,
  ISvnInfo,
  ISvnLockInfo,
  ISvnLogEntry,
  IUnlockOptions,
  Status,
  SvnDepth,
  ISvnPathChange,
  ISvnPath,
  ISvnListItem,
  ISvnBlameLine
} from "./common/types";
import { sequentialize } from "./decorators";
import * as encodeUtil from "./encoding";
import { exists, writeFile, stat, readdir } from "./fs";
import { getBranchName } from "./helpers/branch";
import { configuration } from "./helpers/configuration";
import { parseInfoXml } from "./parser/infoParser";
import { parseSvnList } from "./parser/listParser";
import { parseLockInfo } from "./parser/lockParser";
import { parseSvnLog } from "./parser/logParser";
import { parseStatusXml } from "./parser/statusParser";
import { parseSvnBlame } from "./parser/blameParser";
import { Svn, BufferResult } from "./svn";
import {
  fixPathSeparator,
  fixPegRevision,
  isDescendant,
  normalizePath,
  unwrap
} from "./util";
import { logError } from "./util/errorLogger";
import { matchAll } from "./util/globMatch";
import { parseDiffXml } from "./parser/diffParser";
import {
  validateChangelist,
  validateAcceptAction,
  validateSearchPattern,
  validateFilePath,
  validateLockComment
} from "./validation";

export class Repository {
  private _infoCache = new Map<
    string,
    { info: ISvnInfo; timeout: NodeJS.Timeout; lastAccessed: number }
  >();
  private _info?: ISvnInfo;
  private readonly MAX_CACHE_SIZE = 500;
  // Phase 10.3 perf fix - timestamp-based caching (5s)
  private lastInfoUpdate: number = 0;
  private readonly INFO_CACHE_MS = 5000;

  // Blame cache - smaller than info cache (blame is heavier operation)
  private _blameCache = new Map<
    string,
    { blame: ISvnBlameLine[]; timeout: NodeJS.Timeout; lastAccessed: number }
  >();
  private readonly MAX_BLAME_CACHE_SIZE = 100;
  private readonly BLAME_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  public username?: string;
  public password?: string;

  constructor(
    private svn: Svn,
    public root: string,
    public workspaceRoot: string,
    policy: ConstructorPolicy
  ) {
    if (policy === ConstructorPolicy.LateInit) {
      return (async (): Promise<Repository> => {
        return this;
      })() as unknown as Repository;
    }
    return (async (): Promise<Repository> => {
      await this.updateInfo();
      return this;
    })() as unknown as Repository;
  }

  public async updateInfo() {
    // Check cache first
    const now = Date.now();
    if (now - this.lastInfoUpdate < this.INFO_CACHE_MS) {
      return;
    }
    this.lastInfoUpdate = now;

    const result = await this.exec([
      "info",
      "--xml",
      fixPegRevision(this.workspaceRoot ? this.workspaceRoot : this.root)
    ]);

    try {
      this._info = await parseInfoXml(result.stdout);
    } catch (err) {
      logError(
        `Failed to parse repository info for ${this.workspaceRoot}`,
        err
      );
      throw new Error(
        `Repository info unavailable: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }
  }

  public async exec(
    args: string[],
    options: ICpOptions = {}
  ): Promise<IExecutionResult> {
    options.username = this.username;
    options.password = this.password;
    // Security: Pass repository URL for credential cache (CVSS 7.5 → 3.2 fix)
    if (this._info?.url) {
      options.realmUrl = this._info.url;
    }

    return this.svn.exec(this.workspaceRoot, args, options);
  }

  public async execBuffer(
    args: string[],
    options: ICpOptions = {}
  ): Promise<BufferResult> {
    options.username = this.username;
    options.password = this.password;
    // Security: Pass repository URL for credential cache (CVSS 7.5 → 3.2 fix)
    if (this._info?.url) {
      options.realmUrl = this._info.url;
    }

    return this.svn.execBuffer(this.workspaceRoot, args, options);
  }

  public removeAbsolutePath(file: string) {
    file = fixPathSeparator(file);

    file = path.relative(this.workspaceRoot, file);

    if (file === "") {
      file = ".";
    }

    return fixPegRevision(file);
  }

  /**
   * Check if there are new remote revisions without running full status.
   * Uses `svn log -r BASE:HEAD --limit 1` to detect if BASE < HEAD.
   *
   * @returns true if new revisions exist, false otherwise
   */
  public async hasRemoteChanges(): Promise<boolean> {
    try {
      const result = await this.exec([
        "log",
        "-r",
        "BASE:HEAD",
        "--limit",
        "1",
        "--xml"
      ]);

      // Parse log XML to check if any entries exist
      // Empty log means BASE == HEAD (no new revisions)
      const hasEntries = result.stdout.includes("<logentry");

      return hasEntries;
    } catch (err) {
      // If log fails, assume changes exist and fall back to full status
      logError("hasRemoteChanges failed, falling back to full status", err);
      return true;
    }
  }

  public async getStatus(params: {
    includeIgnored?: boolean;
    includeExternals?: boolean;
    checkRemoteChanges?: boolean;
  }): Promise<IFileStatus[]> {
    params = Object.assign(
      {},
      {
        includeIgnored: false,
        includeExternals: true,
        checkRemoteChanges: false
      },
      params
    );

    // Optimization: Check for remote changes before expensive status call
    if (params.checkRemoteChanges) {
      const hasChanges = await this.hasRemoteChanges();
      if (!hasChanges) {
        console.log("Remote poll: No new revisions, skipping status");
        return [];
      }
    }

    const args = ["stat", "--xml"];

    if (params.includeIgnored) {
      args.push("--no-ignore");
    }
    if (!params.includeExternals) {
      args.push("--ignore-externals");
    }
    if (params.checkRemoteChanges) {
      args.push("--show-updates");
    }

    const result = await this.exec(args);

    let status: IFileStatus[];
    try {
      status = await parseStatusXml(result.stdout);
    } catch (err) {
      logError(`Failed to parse status XML for ${this.workspaceRoot}`, err);
      throw new Error(
        `Status update failed: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }

    // Phase 10 perf fix - parallel external info fetching (was N+1 sequential)
    await Promise.all(
      status
        .filter(s => s.status === Status.EXTERNAL)
        .map(s =>
          this.getInfo(s.path)
            .then(info => {
              s.repositoryUuid = info.repository?.uuid;
            })
            .catch(error => {
              logError(
                `Failed to fetch external repository info for ${s.path}`,
                error
              );
            })
        )
    );

    return status;
  }

  public get info(): ISvnInfo {
    return unwrap(this._info);
  }

  public resetInfoCache(file: string = "") {
    const entry = this._infoCache.get(file);
    if (entry) {
      clearTimeout(entry.timeout);
      this._infoCache.delete(file);
    }
  }

  private evictLRUEntry(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this._infoCache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey !== null) {
      this.resetInfoCache(oldestKey);
    }
  }

  public resetBlameCache(cacheKey: string): void {
    const entry = this._blameCache.get(cacheKey);
    if (entry) {
      clearTimeout(entry.timeout);
      this._blameCache.delete(cacheKey);
    }
  }

  private evictBlameEntry(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this._blameCache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey !== null) {
      this.resetBlameCache(oldestKey);
    }
  }

  @sequentialize
  public async getInfo(
    file: string = "",
    revision?: string,
    skipCache: boolean = false,
    isUrl: boolean = false
  ): Promise<ISvnInfo> {
    const cacheEntry = this._infoCache.get(file);
    if (!skipCache && cacheEntry) {
      // Update access time on cache hit
      cacheEntry.lastAccessed = Date.now();
      return cacheEntry.info;
    }

    const args = ["info", "--xml"];

    if (revision) {
      args.push("-r", revision);
    }

    if (file) {
      if (!isUrl) {
        file = fixPathSeparator(file);
      }
      // Add peg revision for non-working-copy revisions to handle renamed/moved/deleted files
      if (
        revision &&
        !["BASE", "COMMITTED", "PREV"].includes(revision.toUpperCase())
      ) {
        file = fixPegRevision(file) + "@" + revision;
      } else {
        file = fixPegRevision(file);
      }
      args.push(file);
    }

    const result = await this.exec(args);

    let info: ISvnInfo;
    try {
      info = await parseInfoXml(result.stdout);
    } catch (err) {
      logError(`Failed to parse info XML for ${file}`, err);
      throw new Error(
        `File info unavailable for ${file}: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }

    // Evict LRU entry if cache is at max size
    if (this._infoCache.size >= this.MAX_CACHE_SIZE) {
      this.evictLRUEntry();
    }

    // Cache for 2 minutes
    const timer = setTimeout(
      () => {
        this.resetInfoCache(file);
      },
      2 * 60 * 1000
    );

    this._infoCache.set(file, {
      info,
      timeout: timer,
      lastAccessed: Date.now()
    });

    return info;
  }

  /**
   * Get blame information for a file
   *
   * @param file Absolute or relative path to file
   * @param revision Revision to blame (default: HEAD)
   * @param skipCache Skip cache and force fresh blame
   * @returns Array of blame line information
   *
   * @example
   * const blame = await repository.blame("src/file.ts");
   * const blameAtRev = await repository.blame("src/file.ts", "100");
   */
  @sequentialize
  public async blame(
    file: string,
    revision: string = "HEAD",
    skipCache: boolean = false
  ): Promise<ISvnBlameLine[]> {
    // Convert to relative path
    const relativePath = this.removeAbsolutePath(file);

    // Cache key includes revision for per-revision caching
    const cacheKey = `${relativePath}@${revision}`;

    // Check cache first (unless skipCache=true)
    const cacheEntry = this._blameCache.get(cacheKey);
    if (!skipCache && cacheEntry) {
      // Update access time on cache hit
      cacheEntry.lastAccessed = Date.now();
      return cacheEntry.blame;
    }

    // Build SVN blame command
    const args = [
      "blame",
      "--xml",
      "-x",
      "-w --ignore-eol-style", // Ignore whitespace/EOL changes
      "-r",
      revision
    ];

    // Add peg revision for non-HEAD revisions to handle renamed/moved/deleted files
    if (revision.toUpperCase() !== "HEAD") {
      args.push(fixPegRevision(relativePath) + "@" + revision);
    } else {
      args.push(fixPegRevision(relativePath));
    }

    // Execute SVN command
    let result: IExecutionResult;
    try {
      result = await this.exec(args);
    } catch (err: unknown) {
      // Handle known SVN errors
      if (
        typeof err === "object" &&
        err !== null &&
        "stderr" in err &&
        typeof err.stderr === "string"
      ) {
        if (err.stderr.includes("E195012") && err.stderr.includes("binary")) {
          throw new Error(`Cannot blame binary file: ${relativePath}`);
        }
        if (err.stderr.includes("E155007")) {
          throw new Error(`File not under version control: ${relativePath}`);
        }
        if (err.stderr.includes("E160006")) {
          throw new Error(`Invalid revision: ${revision}`);
        }
      }
      logError(`Failed to execute blame for ${relativePath}`, err);
      throw new Error(
        `Blame failed for ${relativePath}: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }

    // Parse blame XML
    let blame: ISvnBlameLine[];
    try {
      blame = await parseSvnBlame(result.stdout);
    } catch (err) {
      logError(`Failed to parse blame XML for ${relativePath}`, err);
      throw new Error(
        `Blame parse failed for ${relativePath}: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }

    // Evict LRU entry if cache is at max size
    if (this._blameCache.size >= this.MAX_BLAME_CACHE_SIZE) {
      this.evictBlameEntry();
    }

    // Cache with TTL
    const timer = setTimeout(() => {
      this.resetBlameCache(cacheKey);
    }, this.BLAME_CACHE_TTL_MS);

    this._blameCache.set(cacheKey, {
      blame,
      timeout: timer,
      lastAccessed: Date.now()
    });

    return blame;
  }

  public async getChanges(): Promise<ISvnPathChange[]> {
    // First, check to see if this branch was copied from somewhere.
    let args = [
      "log",
      "-r1:HEAD",
      "--limit=1",
      "--stop-on-copy",
      "--xml",
      "--with-all-revprops",
      "--verbose"
    ];
    let result = await this.exec(args);
    const entries = await parseSvnLog(result.stdout);

    if (entries.length === 0 || entries[0]?.paths.length === 0) {
      return [];
    }

    const copyCommitPath = entries[0].paths[0];

    if (
      copyCommitPath.copyfromRev === undefined ||
      copyCommitPath.copyfromPath === undefined ||
      copyCommitPath._ === undefined ||
      copyCommitPath.copyfromRev.trim().length === 0 ||
      copyCommitPath.copyfromPath.trim().length === 0 ||
      copyCommitPath._.trim().length === 0
    ) {
      return [];
    }

    const copyFromPath = copyCommitPath.copyfromPath;
    const copyFromRev = copyCommitPath.copyfromRev;
    const copyToPath = copyCommitPath._;
    const copyFromUrl = this.info.repository.root + copyFromPath;
    const copyToUrl = this.info.repository.root + copyToPath;

    // Get last merge revision from path that this branch was copied from.
    args = ["mergeinfo", "--show-revs=merged", copyFromUrl, copyToUrl];
    result = await this.exec(args);
    const revisions = result.stdout.trim().split("\n");
    let latestMergedRevision: string = "";

    if (revisions.length) {
      latestMergedRevision = revisions[revisions.length - 1];
    }

    if (latestMergedRevision.trim().length === 0) {
      latestMergedRevision = copyFromRev;
    }

    // Now, diff the source branch at the latest merged revision with the current branch's revision
    const info = await this.getInfo(copyToUrl, undefined, true, true);
    args = [
      "diff",
      `${copyFromUrl}@${latestMergedRevision}`,
      copyToUrl,
      "--ignore-properties",
      "--xml",
      "--summarize"
    ];
    result = await this.exec(args);
    let paths: ISvnPath[];
    try {
      paths = await parseDiffXml(result.stdout);
    } catch (err) {
      return [];
    }

    const changes: ISvnPathChange[] = [];

    // Now, we have all the files that this branch changed.
    for (const path of paths) {
      changes.push({
        oldPath: Uri.parse(path._),
        newPath: Uri.parse(path._.replace(copyFromUrl, copyToUrl)),
        oldRevision: latestMergedRevision.replace("r", ""),
        newRevision: info.revision,
        item: path.item,
        props: path.props,
        kind: path.kind,
        repo: Uri.parse(this.info.repository.root),
        localPath: Uri.parse(path._.replace(copyFromUrl, ""))
      });
    }

    return changes;
  }

  /**
   * Prepare arguments for 'svn cat' command
   * @private
   */
  private async prepareCatArgs(
    file: string | Uri,
    revision?: string
  ): Promise<{ args: string[]; uri: Uri; filePath: string }> {
    const args = ["cat"];

    let uri: Uri;
    let filePath: string;

    if (file instanceof Uri) {
      uri = file;
      filePath = file.toString(true);
    } else {
      uri = Uri.file(file);
      filePath = file;
    }

    const isChild =
      uri.scheme === "file" && isDescendant(this.workspaceRoot, uri.fsPath);

    let target: string = filePath;

    if (isChild) {
      target = this.removeAbsolutePath(target);
    }

    if (revision) {
      args.push("-r", revision);
      if (
        isChild &&
        !["BASE", "COMMITTED", "PREV"].includes(revision.toUpperCase())
      ) {
        const info = await this.getInfo();
        target = info.url + "/" + target.replace(/\\/g, "/");
        // TODO move to SvnRI
      }
    }

    // Add peg revision for non-working-copy revisions to handle renamed/moved/deleted files
    // SVN syntax: path@revision tells SVN to look at path as it existed at that revision
    if (
      revision &&
      !["BASE", "COMMITTED", "PREV"].includes(revision.toUpperCase())
    ) {
      target = fixPegRevision(target) + "@" + revision;
    } else {
      target = fixPegRevision(target);
    }

    args.push(target);

    return { args, uri, filePath };
  }

  public async show(file: string | Uri, revision?: string): Promise<string> {
    const { args, uri, filePath } = await this.prepareCatArgs(file, revision);

    /**
     * ENCODE DETECTION
     * if TextDocuments exists and autoGuessEncoding is true,
     * try detect current encoding of content
     */
    const configs = workspace.getConfiguration("files", uri);

    let encoding: string | undefined | null = configs.get("encoding");
    let autoGuessEncoding: boolean = configs.get<boolean>(
      "autoGuessEncoding",
      false
    );

    const textDocument = workspace.textDocuments.find(
      doc => normalizePath(doc.uri.fsPath) === normalizePath(filePath)
    );

    if (textDocument) {
      // Load encoding by languageId
      const languageConfigs = workspace.getConfiguration(
        `[${textDocument.languageId}]`,
        uri
      );
      if (languageConfigs["files.encoding"] !== undefined) {
        encoding = languageConfigs["files.encoding"];
      }
      if (languageConfigs["files.autoGuessEncoding"] !== undefined) {
        autoGuessEncoding = languageConfigs["files.autoGuessEncoding"];
      }

      if (autoGuessEncoding) {
        // The `getText` return a `utf-8` string
        const buffer = Buffer.from(textDocument.getText(), "utf-8");
        const detectedEncoding = encodeUtil.detectEncoding(buffer);
        if (detectedEncoding) {
          encoding = detectedEncoding;
        }
      }
    } else {
      const svnEncoding: string | undefined =
        configuration.get<string>("default.encoding");
      if (svnEncoding) {
        encoding = svnEncoding;
      }
    }

    const experimental = configuration.get<boolean>(
      "experimental.detect_encoding",
      false
    );
    if (experimental) {
      encoding = null;
    }

    const result = await this.exec(args, { encoding });

    return result.stdout;
  }

  public async showBuffer(
    file: string | Uri,
    revision?: string
  ): Promise<Buffer> {
    const { args } = await this.prepareCatArgs(file, revision);
    const result = await this.execBuffer(args);
    return result.stdout;
  }

  public async commitFiles(message: string, files: string[]) {
    files = files.map(file => this.removeAbsolutePath(file));

    const args = ["commit", ...files];

    if (await exists(path.join(this.workspaceRoot, message))) {
      args.push("--force-log");
    }

    let tmpFile: tmp.FileResult | undefined;

    /**
     * For message with line break or non:
     * \x00-\x7F -> ASCII
     * \x80-\xFF -> Latin
     * Use a file for commit message
     */
    if (/\n|[^\x00-\x7F\x80-\xFF]/.test(message)) {
      tmp.setGracefulCleanup();

      tmpFile = tmp.fileSync({
        prefix: "svn-commit-message-"
      });

      await writeFile(tmpFile.name, message, { encoding: "utf-8" });

      args.push("-F", tmpFile.name);
      args.push("--encoding", "UTF-8");
    } else {
      args.push("-m", message);
    }

    // Prevents commit the files inside the folder
    args.push("--depth", "empty");

    let result: IExecutionResult;
    try {
      result = await this.exec(args);
    } finally {
      // Remove temporary file if exists - cleanup on success or error
      if (tmpFile) {
        tmpFile.removeCallback();
      }
    }

    const matches = result.stdout.match(/Committed revision (.*)\./i);
    if (matches && matches[0]) {
      const sendedFiles = (
        result.stdout.match(/(Sending|Adding|Deleting)\s+/g) ?? []
      ).length;

      const filesMessage = `${sendedFiles} ${
        sendedFiles === 1 ? "file" : "files"
      } commited`;

      return `${filesMessage}: revision ${matches[1]}.`;
    }

    return result.stdout;
  }

  private async addFilesByIgnore(files: string[], ignoreList: string[]) {
    const allFiles = async (file: string): Promise<string[]> => {
      if ((await stat(file)).isDirectory()) {
        return (
          await Promise.all(
            (await readdir(file)).map(subfile => {
              const abspath = path.resolve(file + path.sep + subfile);
              const relpath = this.removeAbsolutePath(abspath);
              if (
                !matchAll(path.sep + relpath, ignoreList, {
                  dot: true,
                  matchBase: true
                })
              ) {
                return allFiles(abspath);
              }
              return [];
            })
          )
        ).reduce<string[]>((acc, cur) => acc.concat(cur), [file]);
      }
      return [file];
    };
    files = (await Promise.all(files.map(file => allFiles(file)))).flat();
    files = files.map(file => this.removeAbsolutePath(file));
    return this.exec(["add", "--depth=empty", ...files]);
  }

  public async addFiles(files: string[]) {
    const ignoreList = configuration.get<string[]>("sourceControl.ignore");
    if (ignoreList.length > 0) {
      return this.addFilesByIgnore(files, ignoreList);
    }
    files = files.map(file => this.removeAbsolutePath(file));

    // Phase 21.D: Adaptive batching for large file sets
    const { executeBatched } = await import("./util/batchOperations");
    const results = await executeBatched(files, async chunk => {
      return this.exec(["add", ...chunk]);
    });

    // Combine results - return last non-empty stdout
    return results.reverse().find(r => r.stdout)?.stdout || "";
  }

  public addChangelist(files: string[], changelist: string) {
    if (!validateChangelist(changelist)) {
      throw new Error("Invalid changelist name");
    }
    files = files.map(file => this.removeAbsolutePath(file));
    return this.exec(["changelist", changelist, ...files]);
  }

  public removeChangelist(files: string[]) {
    files = files.map(file => this.removeAbsolutePath(file));
    return this.exec(["changelist", "--remove", ...files]);
  }

  public async getCurrentBranch(): Promise<string> {
    const info = await this.getInfo();

    const branch = getBranchName(info.url);

    if (branch) {
      const showFullName = configuration.get<boolean>("layout.showFullName");
      if (showFullName) {
        return branch.path;
      } else {
        return branch.name;
      }
    }

    return "";
  }

  public async getRepositoryUuid(): Promise<string> {
    const info = await this.getInfo();

    return info.repository.uuid;
  }

  public async getRepoUrl() {
    const info = await this.getInfo();

    const branch = getBranchName(info.url);

    if (!branch) {
      return info.repository.root;
    }

    const regex = new RegExp(branch.path + "$");

    return info.url.replace(regex, "").replace(/\/$/, "");
  }

  public async getBranches() {
    const trunkLayout = configuration.get<string>("layout.trunk");
    const branchesLayout = configuration.get<string>("layout.branches");
    const tagsLayout = configuration.get<string>("layout.tags");

    const repoUrl = await this.getRepoUrl();

    const branches: string[] = [];

    const promises = [];

    if (trunkLayout) {
      promises.push(
        new Promise<string[]>(async resolve => {
          try {
            await this.exec([
              "ls",
              repoUrl + "/" + trunkLayout,
              "--depth",
              "empty"
            ]);

            resolve([trunkLayout]);
          } catch (error) {
            resolve([]);
          }
        })
      );
    }

    const trees: string[] = [];

    if (branchesLayout) {
      trees.push(branchesLayout);
    }

    if (tagsLayout) {
      trees.push(tagsLayout);
    }

    for (const tree of trees) {
      promises.push(
        new Promise<string[]>(async resolve => {
          const branchUrl = repoUrl + "/" + tree;

          try {
            const result = await this.exec(["ls", branchUrl]);

            const list = result.stdout
              .trim()
              .replace(/\/|\\/g, "")
              .split(/[\r\n]+/)
              .filter((x: string) => !!x)
              .map((i: string) => tree + "/" + i);

            resolve(list);
          } catch (error) {
            resolve([]);
          }
        })
      );
    }

    const all = await Promise.all(promises);
    all.forEach(list => {
      branches.push(...list);
    });

    return branches;
  }

  public async newBranch(
    name: string,
    commitMessage: string = "Created new branch"
  ) {
    const repoUrl = await this.getRepoUrl();
    const newBranch = repoUrl + "/" + name;
    const info = await this.getInfo();
    const currentBranch = info.url;

    await this.exec(["copy", currentBranch, newBranch, "-m", commitMessage]);

    await this.switchBranch(name);

    return true;
  }

  public async switchBranch(ref: string, force: boolean = false) {
    const repoUrl = await this.getRepoUrl();
    const branchUrl = repoUrl + "/" + ref;

    await this.exec(
      ["switch", branchUrl].concat(force ? ["--ignore-ancestry"] : [])
    );

    this.resetInfoCache();
    return true;
  }

  public async merge(
    ref: string,
    reintegrate: boolean = false,
    accept_action: string = "postpone"
  ) {
    if (!validateAcceptAction(accept_action)) {
      throw new Error("Invalid accept action");
    }
    const repoUrl = await this.getRepoUrl();
    const branchUrl = repoUrl + "/" + ref;

    let args = ["merge", "--accept", accept_action];
    args = args.concat(reintegrate ? ["--reintegrate"] : []);
    args = args.concat([branchUrl]);

    await this.exec(args);

    this.resetInfoCache();
    return true;
  }

  public async revert(files: string[], depth: keyof typeof SvnDepth) {
    files = files.map(file => this.removeAbsolutePath(file));

    // Phase 21.D: Adaptive batching for large file sets
    const { executeBatched } = await import("./util/batchOperations");
    const results = await executeBatched(files, async chunk => {
      return this.exec(["revert", "--depth", depth, ...chunk]);
    });

    // Combine results - return last non-empty stdout
    return results.reverse().find(r => r.stdout)?.stdout || "";
  }

  public async update(ignoreExternals: boolean = true): Promise<string> {
    const args = ["update"];

    if (ignoreExternals) {
      args.push("--ignore-externals");
    }

    const result = await this.exec(args);

    this.resetInfoCache();

    const message = result.stdout.trim().split(/\r?\n/).pop();

    if (message) {
      return message;
    }
    return result.stdout;
  }

  public async pullIncomingChange(path: string): Promise<string> {
    const args = ["update", path];

    const result = await this.exec(args);

    this.resetInfoCache();

    const message = result.stdout.trim().split(/\r?\n/).pop();

    if (message) {
      return message;
    }
    return result.stdout;
  }

  public async patch(files: string[]) {
    files = files.map(file => this.removeAbsolutePath(file));
    const result = await this.exec(["diff", "--internal-diff", ...files]);
    const message = result.stdout;
    return message;
  }

  public async patchBuffer(files: string[]) {
    files = files.map(file => this.removeAbsolutePath(file));
    const result = await this.execBuffer(["diff", "--internal-diff", ...files]);
    const message = result.stdout;
    return message;
  }

  public async patchChangelist(changelistName: string) {
    const result = await this.exec([
      "diff",
      "--internal-diff",
      "--changelist",
      changelistName
    ]);
    const message = result.stdout;
    return message;
  }

  public async removeFiles(files: string[], keepLocal: boolean) {
    files = files.map(file => this.removeAbsolutePath(file));
    const args = ["remove"];

    if (keepLocal) {
      args.push("--keep-local");
    }

    args.push(...files);

    const result = await this.exec(args);

    return result.stdout;
  }

  public async resolve(files: string[], action: string) {
    if (!validateAcceptAction(action)) {
      throw new Error(
        `Invalid resolve action: "${action}". ` +
          `Valid options: base, working, mine-full, theirs-full, mine-conflict, theirs-conflict`
      );
    }

    files = files.map(file => this.removeAbsolutePath(file));

    const result = await this.exec(["resolve", "--accept", action, ...files]);

    return result.stdout;
  }

  public async plainLog(): Promise<string> {
    const logLength = configuration.get<string>("log.length") ?? "50";
    const result = await this.exec([
      "log",
      "-r",
      "HEAD:1",
      "--limit",
      logLength
    ]);

    return result.stdout;
  }

  public async plainLogBuffer(): Promise<Buffer> {
    const logLength = configuration.get<string>("log.length") ?? "50";
    const result = await this.execBuffer([
      "log",
      "-r",
      "HEAD:1",
      "--limit",
      logLength
    ]);

    return result.stdout;
  }

  public async plainLogByRevision(revision: number) {
    const result = await this.exec(["log", "-r", revision.toString()]);

    return result.stdout;
  }

  public async plainLogByRevisionBuffer(revision: number) {
    const result = await this.execBuffer(["log", "-r", revision.toString()]);

    return result.stdout;
  }

  public async plainLogByText(search: string) {
    if (!validateSearchPattern(search)) {
      throw new Error("Invalid search pattern");
    }
    const result = await this.exec(["log", "--search", search]);

    return result.stdout;
  }

  public async plainLogByTextBuffer(search: string) {
    if (!validateSearchPattern(search)) {
      throw new Error("Invalid search pattern");
    }
    const result = await this.execBuffer(["log", "--search", search]);

    return result.stdout;
  }

  public async log(
    rfrom: string,
    rto: string,
    limit: number,
    target?: string | Uri
  ): Promise<ISvnLogEntry[]> {
    const args = [
      "log",
      "-r",
      `${rfrom}:${rto}`,
      `--limit=${limit}`,
      "--xml",
      "-v"
    ];
    if (target !== undefined) {
      args.push(
        fixPegRevision(target instanceof Uri ? target.toString(true) : target)
      );
    }
    const result = await this.exec(args);

    return parseSvnLog(result.stdout);
  }

  /**
   * Fetch commit messages for multiple revisions in a single batch
   * Optimizes blame message fetching by using revision range instead of N individual calls
   *
   * @param revisions Array of revision numbers (e.g., ["100", "150", "200"])
   * @param target Optional file/directory path to filter log entries
   * @returns Array of log entries matching requested revisions
   *
   * @example
   * const entries = await repository.logBatch(["100", "105", "200"]);
   * // Executes: svn log -r 100:200 --xml -v
   * // Returns: entries for revisions 100, 105, 200 (filters out 101-104, 106-199)
   */
  public async logBatch(
    revisions: string[],
    target?: string | Uri
  ): Promise<ISvnLogEntry[]> {
    // Edge case: empty array
    if (revisions.length === 0) {
      return [];
    }

    // Edge case: single revision (use existing log method)
    if (revisions.length === 1) {
      return this.log(revisions[0], revisions[0], 1, target);
    }

    // Parse revisions as numbers
    const revNums = revisions.map(r => parseInt(r, 10)).filter(n => !isNaN(n));
    if (revNums.length === 0) {
      return [];
    }

    // Calculate min/max range
    const minRev = Math.min(...revNums);
    const maxRev = Math.max(...revNums);

    // Fetch entire range (trade bandwidth for speed)
    const args = ["log", "-r", `${minRev}:${maxRev}`, "--xml", "-v"];

    if (target !== undefined) {
      args.push(
        fixPegRevision(target instanceof Uri ? target.toString(true) : target)
      );
    }

    const result = await this.exec(args);
    const allEntries = await parseSvnLog(result.stdout);

    // Filter to only requested revisions (discard intermediate entries)
    const requestedSet = new Set(revisions);
    return allEntries.filter(entry => requestedSet.has(entry.revision));
  }

  public async logByUser(user: string) {
    const result = await this.exec(["log", "--xml", "-v", "--search", user]);

    return parseSvnLog(result.stdout);
  }

  public async cleanup() {
    const result = await this.exec(["cleanup"]);

    return result.stdout;
  }

  public async removeUnversioned() {
    const result = await this.exec(["cleanup", "--remove-unversioned"]);

    this.svn.logOutput(result.stdout);

    return result.stdout;
  }

  public async finishCheckout() {
    const info = await this.getInfo();

    const result = await this.exec(["switch", info.url]);

    return result.stdout;
  }

  public async list(folder?: string) {
    let url = await this.getRepoUrl();

    if (folder) {
      url += "/" + folder;
    }

    const result = await this.exec(["list", url, "--xml"]);

    return parseSvnList(result.stdout);
  }

  public async ls(file: string): Promise<ISvnListItem[]> {
    const result = await this.exec(["list", file, "--xml"]);

    return parseSvnList(result.stdout);
  }

  private async getCurrentIgnore(directory: string) {
    directory = this.removeAbsolutePath(directory);

    let currentIgnore = "";

    try {
      const args = ["propget", "svn:ignore"];

      if (directory) {
        args.push(directory);
      }

      const currentIgnoreResult = await this.exec(args);

      currentIgnore = currentIgnoreResult.stdout.trim();
    } catch (error) {
      logError("Merge operation failed", error);
    }

    const ignores = currentIgnore.split(/[\r\n]+/);

    return ignores;
  }

  public async addToIgnore(
    expressions: string[],
    directory: string,
    recursive: boolean = false
  ) {
    const ignores = await this.getCurrentIgnore(directory);

    directory = this.removeAbsolutePath(directory);

    ignores.push(...expressions);
    const newIgnore = [...new Set(ignores)]
      .filter(v => !!v)
      .sort()
      .join("\n");

    const args = ["propset", "svn:ignore", newIgnore];

    if (directory) {
      args.push(directory);
    } else {
      args.push(".");
    }
    if (recursive) {
      args.push("--recursive");
    }

    const result = await this.exec(args);

    return result.stdout;
  }

  public async rename(oldName: string, newName: string): Promise<string> {
    oldName = this.removeAbsolutePath(oldName);
    newName = this.removeAbsolutePath(newName);
    const args = ["rename", oldName, newName];

    const result = await this.exec(args);

    return result.stdout;
  }

  /**
   * Lock files or directories to prevent concurrent modifications.
   * Supports both files and directories.
   *
   * @param files Array of file/directory paths to lock
   * @param options Lock options (comment, force)
   * @returns SVN lock output
   */
  public async lock(
    files: string[],
    options: ILockOptions = {}
  ): Promise<IExecutionResult> {
    files = files.map(file => this.removeAbsolutePath(file));

    // Validate paths to prevent path traversal
    for (const file of files) {
      if (!validateFilePath(file)) {
        throw new Error(`Invalid file path: ${file}`);
      }
    }

    // Validate comment to prevent command injection
    if (options.comment && !validateLockComment(options.comment)) {
      throw new Error("Invalid characters in lock comment");
    }

    const args = ["lock"];

    if (options.comment) {
      args.push("--message", options.comment);
    }

    if (options.force) {
      args.push("--force");
    }

    args.push(...files);

    return this.exec(args);
  }

  /**
   * Unlock files or directories.
   * Use force option to break locks owned by other users.
   *
   * @param files Array of file/directory paths to unlock
   * @param options Unlock options (force to break others' locks)
   * @returns SVN unlock output
   */
  public async unlock(
    files: string[],
    options: IUnlockOptions = {}
  ): Promise<IExecutionResult> {
    files = files.map(file => this.removeAbsolutePath(file));

    // Validate paths to prevent path traversal
    for (const file of files) {
      if (!validateFilePath(file)) {
        throw new Error(`Invalid file path: ${file}`);
      }
    }

    const args = ["unlock"];

    if (options.force) {
      args.push("--force");
    }

    args.push(...files);

    return this.exec(args);
  }

  /**
   * Get lock information for a file or directory.
   * Returns null if the path is not locked.
   *
   * @param filePath Path to check for lock
   * @returns Lock info or null if not locked
   */
  public async getLockInfo(filePath: string): Promise<ISvnLockInfo | null> {
    filePath = this.removeAbsolutePath(filePath);

    try {
      const result = await this.exec([
        "info",
        "--xml",
        fixPegRevision(filePath)
      ]);
      return parseLockInfo(result.stdout);
    } catch (err) {
      logError(`Failed to get lock info for ${filePath}`, err);
      return null;
    }
  }

  /**
   * Set the depth of a working copy folder for sparse checkouts.
   * Use this to exclude large directories or selectively include content.
   *
   * @param folderPath Path to the folder
   * @param depth One of: exclude, empty, files, immediates, infinity
   * @returns SVN update output
   */
  public async setDepth(
    folderPath: string,
    depth: keyof typeof SvnDepth
  ): Promise<IExecutionResult> {
    // Validate depth is a valid SvnDepth key
    const validDepths = Object.keys(SvnDepth);
    if (!validDepths.includes(depth)) {
      throw new Error(`Invalid depth: ${depth}`);
    }

    folderPath = this.removeAbsolutePath(folderPath);

    // Validate path to prevent path traversal
    if (!validateFilePath(folderPath)) {
      throw new Error(`Invalid folder path: ${folderPath}`);
    }

    const args = ["update", "--set-depth", depth, folderPath];

    return this.exec(args);
  }

  /**
   * Check if a file has the svn:needs-lock property set.
   * Files with this property are read-only until locked.
   */
  public async hasNeedsLock(filePath: string): Promise<boolean> {
    filePath = this.removeAbsolutePath(filePath);

    if (!validateFilePath(filePath)) {
      throw new Error(`Invalid file path: ${filePath}`);
    }

    try {
      const result = await this.exec(["propget", "svn:needs-lock", filePath]);
      return result.stdout.trim() !== "";
    } catch {
      return false;
    }
  }

  /**
   * Set the svn:needs-lock property on a file.
   * This makes the file read-only until locked.
   */
  public async setNeedsLock(filePath: string): Promise<IExecutionResult> {
    filePath = this.removeAbsolutePath(filePath);

    if (!validateFilePath(filePath)) {
      throw new Error(`Invalid file path: ${filePath}`);
    }

    return this.exec(["propset", "svn:needs-lock", "*", filePath]);
  }

  /**
   * Remove the svn:needs-lock property from a file.
   */
  public async removeNeedsLock(filePath: string): Promise<IExecutionResult> {
    filePath = this.removeAbsolutePath(filePath);

    if (!validateFilePath(filePath)) {
      throw new Error(`Invalid file path: ${filePath}`);
    }

    return this.exec(["propdel", "svn:needs-lock", filePath]);
  }

  /**
   * Clear all info cache timers (Phase 8.2 perf fix - prevent memory leak)
   * Should be called on repository disposal
   */
  public clearInfoCacheTimers(): void {
    this._infoCache.forEach(entry => clearTimeout(entry.timeout));
    this._infoCache.clear();
    this._blameCache.forEach(entry => clearTimeout(entry.timeout));
    this._blameCache.clear();
  }
}
