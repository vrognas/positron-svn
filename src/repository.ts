// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import * as path from "path";
import {
  commands,
  Disposable,
  env,
  Event,
  EventEmitter,
  FileDecoration,
  ProgressLocation,
  scm,
  SecretStorage,
  SourceControl,
  SourceControlInputBox,
  TextDocument,
  Uri,
  window,
  workspace
} from "vscode";

/**
 * Credential storage mode - determines where SVN credentials are stored
 */
type CredentialMode = "auto" | "systemKeyring" | "extensionStorage" | "prompt";

/**
 * Determine if extension storage should be used for credentials.
 * @returns true if extension storage should be used
 */
function shouldUseExtensionStorage(): boolean {
  const mode = configuration.get<CredentialMode>("auth.credentialMode", "auto");
  const isRemote = !!env.remoteName;

  switch (mode) {
    case "auto":
      // Extension storage only when remote
      return isRemote;
    case "extensionStorage":
      // Always use extension storage
      return true;
    case "systemKeyring":
    case "prompt":
      // Never use extension storage
      return false;
    default:
      return isRemote;
  }
}
import { StatusService } from "./services/StatusService";
import { ResourceGroupManager } from "./services/ResourceGroupManager";
import { RemoteChangeService } from "./services/RemoteChangeService";
import {
  IAuth,
  ICleanupOptions,
  IFileStatus,
  ILockOptions,
  IOperations,
  ISvnErrorData,
  ISvnInfo,
  ISvnLockInfo,
  ISvnResourceGroup,
  IUnlockOptions,
  IUpdateResult,
  Operation,
  RepositoryState,
  Status,
  SvnDepth,
  SvnUriAction,
  ISvnPathChange,
  IStoredAuth,
  ISvnListItem
} from "./common/types";
import { debounce, globalSequentialize, memoize, throttle } from "./decorators";
import { exists } from "./fs";
import { configuration } from "./helpers/configuration";
import OperationsImpl from "./operationsImpl";
import { PathNormalizer } from "./pathNormalizer";
import { IRemoteRepository } from "./remoteRepository";
import { Resource } from "./resource";
import { StatusBarCommands } from "./statusbar/statusBarCommands";
import { svnErrorCodes } from "./svn";
import { Repository as BaseRepository } from "./svnRepository";
import { toSvnUri } from "./uri";
import {
  anyEvent,
  dispose,
  eventToPromise,
  filterEvent,
  getSvnDir,
  isDescendant,
  isReadOnly,
  timeout
} from "./util";
import { logError } from "./util/errorLogger";
import { match } from "./util/globMatch";
import { RepositoryFilesWatcher } from "./watchers/repositoryFilesWatcher";

function shouldShowProgress(operation: Operation): boolean {
  switch (operation) {
    case Operation.CurrentBranch:
    case Operation.Show:
    case Operation.Info:
      return false;
    default:
      return true;
  }
}

/**
 * Cached configuration values (Phase 8.1 perf fix)
 */
type RepositoryConfig = {
  actionForDeletedFiles: string;
  ignoredRulesForDeletedFiles: string[];
  updateFrequency: number;
  autorefresh: boolean;
  remoteChangesCheckFrequency: number;
};

export class Repository implements IRemoteRepository {
  public sourceControl: SourceControl;
  public statusBar: StatusBarCommands;
  public statusIgnored: IFileStatus[] = [];
  public statusExternal: IFileStatus[] = [];
  private disposables: Disposable[] = [];
  public currentBranch = "";
  public remoteChangedFiles: number = 0;
  public isIncomplete: boolean = false;
  public needCleanUp: boolean = false;
  private deletedUris = new Set<Uri>(); // Phase 8.1 perf fix - Set for auto-deduplication
  private canSaveAuth: boolean = false;
  private statusService: StatusService;
  private groupManager: ResourceGroupManager;
  private remoteChangeService: RemoteChangeService;
  private fileDecorationProvider: {
    provideFileDecoration(uri: Uri): FileDecoration | undefined;
    refresh(uris?: Uri | Uri[]): void;
    dispose(): void;
  };
  private _configCache: RepositoryConfig | undefined;

  // Property accessors for backward compatibility
  get changes(): ISvnResourceGroup {
    return this.groupManager.changes;
  }

  get conflicts(): ISvnResourceGroup {
    return this.groupManager.conflicts;
  }

  get unversioned(): ISvnResourceGroup {
    return this.groupManager.unversioned;
  }

  get changelists(): ReadonlyMap<string, ISvnResourceGroup> {
    return this.groupManager.changelists;
  }

  get remoteChanges(): ISvnResourceGroup | undefined {
    return this.groupManager.remoteChanges;
  }

  private lastPromptAuth?: Thenable<IAuth | undefined>;
  private saveAuthLock: Promise<void> = Promise.resolve();
  private credentialLock: Promise<void> = Promise.resolve(); // Mutex for credential assignment
  private promptAuthCooldown: boolean = false;
  private promptAuthCooldownTimer?: ReturnType<typeof setTimeout>;
  private storedAuthsCache?: { accounts: IStoredAuth[]; expiry: number };

  private _fsWatcher: RepositoryFilesWatcher;
  public get fsWatcher() {
    return this._fsWatcher;
  }

  private _onDidChangeRepository = new EventEmitter<Uri>();
  public readonly onDidChangeRepository: Event<Uri> =
    this._onDidChangeRepository.event;

  private _onDidChangeState = new EventEmitter<RepositoryState>();
  public readonly onDidChangeState: Event<RepositoryState> =
    this._onDidChangeState.event;

  private _onDidChangeStatus = new EventEmitter<void>();
  public readonly onDidChangeStatus: Event<void> =
    this._onDidChangeStatus.event;

  private _onDidChangeRemoteChangedFiles = new EventEmitter<void>();
  public readonly onDidChangeRemoteChangedFile: Event<void> =
    this._onDidChangeRemoteChangedFiles.event;

  private _onRunOperation = new EventEmitter<Operation>();
  public readonly onRunOperation: Event<Operation> = this._onRunOperation.event;

  private _onDidRunOperation = new EventEmitter<Operation>();
  public readonly onDidRunOperation: Event<Operation> =
    this._onDidRunOperation.event;

  @memoize
  get onDidChangeOperations(): Event<void> {
    return anyEvent(
      this.onRunOperation as unknown as Event<void>,
      this.onDidRunOperation as unknown as Event<void>
    );
  }

  private _operations = new OperationsImpl();
  get operations(): IOperations {
    return this._operations;
  }

  private _state = RepositoryState.Idle;
  get state(): RepositoryState {
    return this._state;
  }
  set state(state: RepositoryState) {
    this._state = state;
    this._onDidChangeState.fire(state);

    this.groupManager.clearAll();

    this.isIncomplete = false;
    this.needCleanUp = false;
  }

  /**
   * Flag to suppress status updates during sparse checkout downloads.
   * When true, file watcher events won't trigger SVN status commands,
   * preventing working copy lock conflicts on Windows.
   */
  private _sparseDownloadInProgress = false;
  get sparseDownloadInProgress(): boolean {
    return this._sparseDownloadInProgress;
  }
  set sparseDownloadInProgress(value: boolean) {
    this._sparseDownloadInProgress = value;
  }

  get root(): string {
    return this.repository.root;
  }

  get workspaceRoot(): string {
    return this.repository.workspaceRoot;
  }

  /** 'svn://repo.x/branches/b1' e.g. */
  get branchRoot(): Uri {
    return Uri.parse(this.repository.info.url);
  }

  get inputBox(): SourceControlInputBox {
    return this.sourceControl.inputBox;
  }

  get username(): string | undefined {
    return this.repository.username;
  }

  set username(username: string | undefined) {
    this.repository.username = username;
  }

  get password(): string | undefined {
    return this.repository.password;
  }

  set password(password: string | undefined) {
    this.repository.password = password;
  }

  constructor(
    public repository: BaseRepository,
    private secrets: SecretStorage
  ) {
    this.statusService = new StatusService(
      repository,
      repository.workspaceRoot,
      repository.root
    );

    this._fsWatcher = new RepositoryFilesWatcher(repository.root);
    this.disposables.push(this._fsWatcher);

    this._fsWatcher.onDidAny(this.onFSChange, this, this.disposables);
    this._fsWatcher.onDidSvnAny(
      async (e: Uri) => {
        await this.onDidAnyFileChanged(e);
      },
      this,
      this.disposables
    );

    this.sourceControl = scm.createSourceControl(
      "svn",
      "SVN",
      Uri.file(repository.workspaceRoot)
    );

    // @ts-expect-error - contextValue exists at runtime but not in types
    this.sourceControl.contextValue = "repository";
    this.sourceControl.inputBox.placeholder = "Commit message";
    this.sourceControl.inputBox.visible = true;
    this.sourceControl.inputBox.enabled = true;
    this.sourceControl.quickDiffProvider = this;
    this.sourceControl.count = 0;
    this.disposables.push(this.sourceControl);

    this.statusBar = new StatusBarCommands(this);
    this.disposables.push(this.statusBar);
    this.statusBar.onDidChange(
      () => (this.sourceControl.statusBarCommands = this.statusBar.commands),
      null,
      this.disposables
    );

    // Initialize ResourceGroupManager
    this.groupManager = new ResourceGroupManager(
      this.sourceControl,
      this.disposables
    );

    // Initialize RemoteChangeService
    this.remoteChangeService = new RemoteChangeService(
      () => this.updateRemoteChangedFiles(),
      () => ({
        checkFrequencySeconds: configuration.get<number>(
          "remoteChanges.checkFrequency",
          300
        )
      })
    );

    // Initialize FileDecorationProvider for Explorer view decorations
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { SvnFileDecorationProvider } = require("./fileDecorationProvider");
    this.fileDecorationProvider = new SvnFileDecorationProvider(this);
    this.disposables.push(
      window.registerFileDecorationProvider(this.fileDecorationProvider)
    );
    this.disposables.push(this.fileDecorationProvider);

    // For each deleted file, add to set (auto-deduplicates)
    this._fsWatcher.onDidWorkspaceDelete(
      uri => this.deletedUris.add(uri),
      this,
      this.disposables
    );

    // Only check deleted files after the status list is fully updated
    this.onDidChangeStatus(this.actionForDeletedFiles, this, this.disposables);

    // Start remote change polling
    this.remoteChangeService.start();
    this.updateRemoteChangedFiles();

    // On change config, restart remote change service
    configuration.onDidChange(e => {
      // Invalidate config cache (Phase 8.1 perf fix)
      this._configCache = undefined;

      if (e.affectsConfiguration("svn.remoteChanges.checkFrequency")) {
        this.remoteChangeService.restart();
        this.updateRemoteChangedFiles();
      }

      // Clear runtime credentials and caches when auth mode changes
      // Forces re-authentication with new storage mode
      if (e.affectsConfiguration("svn.auth.credentialMode")) {
        // Chain credential clearing to saveAuthLock to serialize properly
        // This ensures any concurrent operation waits for clearing to complete
        this.saveAuthLock = this.saveAuthLock.then(() => {
          this.username = undefined;
          this.password = undefined;
          this.canSaveAuth = false;
          this.storedAuthsCache = undefined;
        });
      }
    });

    this.status();

    this.disposables.push(
      workspace.onDidSaveTextDocument(document => {
        this.onDidSaveTextDocument(document);
      })
    );
  }

  /**
   * Get cached configuration values (Phase 8.1 perf fix)
   * Prevents repeated configuration.get() calls in hot paths
   */
  private getConfig(): RepositoryConfig {
    if (this._configCache) {
      return this._configCache;
    }

    this._configCache = {
      actionForDeletedFiles: configuration.get<string>(
        "delete.actionForDeletedFiles",
        "prompt"
      ),
      ignoredRulesForDeletedFiles: configuration.get<string[]>(
        "delete.ignoredRulesForDeletedFiles",
        []
      ),
      updateFrequency: configuration.get<number>(
        "sourceControl.countBadge",
        10
      ),
      autorefresh: configuration.get<boolean>("autorefresh"),
      remoteChangesCheckFrequency: configuration.get<number>(
        "remoteChanges.checkFrequency",
        300
      )
    };

    return this._configCache;
  }

  @debounce(500)
  private async onDidAnyFileChanged(e: Uri) {
    // Skip during sparse checkout downloads to prevent svn info spam
    if (this._sparseDownloadInProgress) {
      return;
    }
    await this.repository.updateInfo();
    this._onDidChangeRepository.fire(e);
  }

  /**
   * Check all recently deleted files and compare with svn status "missing"
   */
  @debounce(300)
  private async actionForDeletedFiles() {
    if (this.deletedUris.size === 0) {
      return;
    }

    const allUris = Array.from(this.deletedUris);
    this.deletedUris.clear();

    const config = this.getConfig();
    const actionForDeletedFiles = config.actionForDeletedFiles;

    if (actionForDeletedFiles === "none") {
      return;
    }

    const resources = allUris
      .map(uri => this.getResourceFromFile(uri))
      .filter(
        resource => resource && resource.type === Status.MISSING
      ) as Resource[];

    let uris = resources.map(resource => resource.resourceUri);

    if (!uris.length) {
      return;
    }

    const rules = config.ignoredRulesForDeletedFiles.map(ignored =>
      match(ignored)
    );

    if (rules.length) {
      uris = uris.filter(uri => {
        // Check first for relative URL (Better for workspace configuration)
        const relativePath = this.repository.removeAbsolutePath(uri.fsPath);

        // If some match, remove from list
        return !rules.some(rule => rule(relativePath) || rule(uri.fsPath));
      });
    }

    if (!uris.length) {
      return;
    }

    if (actionForDeletedFiles === "remove") {
      return this.removeFiles(
        uris.map(uri => uri.fsPath),
        false
      );
    } else if (actionForDeletedFiles === "prompt") {
      return commands.executeCommand("svn.promptRemove", ...uris);
    }

    // Unknown action - do nothing (config enum exhausted above)
    return;
  }

  @debounce(500)
  public async updateRemoteChangedFiles() {
    const config = this.getConfig();

    if (config.remoteChangesCheckFrequency) {
      this.run(Operation.StatusRemote);
    } else {
      // Clear remote changes when disabled
      if (this.groupManager.remoteChanges) {
        this.groupManager.remoteChanges.resourceStates = [];
      }
    }
  }

  private onFSChange(_uri: Uri): void {
    const config = this.getConfig();

    if (!config.autorefresh) {
      return;
    }

    if (!this.operations.isIdle()) {
      return;
    }

    this.eventuallyUpdateWhenIdleAndWait();
  }

  @debounce(500)
  private eventuallyUpdateWhenIdleAndWait(): void {
    this.updateWhenIdleAndWait();
  }

  @throttle
  private async updateWhenIdleAndWait(): Promise<void> {
    await this.whenIdleAndFocused();
    await this.status();
  }

  public async whenIdleAndFocused(): Promise<void> {
    while (true) {
      if (!this.operations.isIdle()) {
        await eventToPromise(this.onDidRunOperation);
        continue;
      }

      if (!window.state.focused) {
        const onDidFocusWindow = filterEvent(
          window.onDidChangeWindowState,
          e => e.focused
        );
        await eventToPromise(onDidFocusWindow);
        continue;
      }

      return;
    }
  }

  private lastModelUpdate: number = 0;
  private readonly MODEL_CACHE_MS = 2000; // 2s cache

  @globalSequentialize("updateModelState")
  public async updateModelState(checkRemoteChanges: boolean = false) {
    // Skip status updates during sparse checkout downloads
    // Prevents working copy lock conflicts on Windows
    if (this._sparseDownloadInProgress) {
      return;
    }

    // Short-term cache: skip if called within 2s
    // Note: @throttle removed (Phase 15) - cache already handles throttling
    const now = Date.now();
    if (now - this.lastModelUpdate < this.MODEL_CACHE_MS) {
      return;
    }
    this.lastModelUpdate = now;

    // Get categorized status from StatusService
    const result = await this.retryRun(async () => {
      return this.statusService.updateStatus({ checkRemoteChanges });
    });

    // Update metadata
    this.statusExternal = [...result.statusExternal];
    this.statusIgnored = [...result.statusIgnored];
    this.isIncomplete = result.isIncomplete;
    this.needCleanUp = result.needCleanUp;

    // Delegate group management to ResourceGroupManager
    const count = this.groupManager.updateGroups({
      result,
      config: {
        ignoreOnStatusCountList: configuration.get<string[]>(
          "sourceControl.ignoreOnStatusCount",
          []
        ),
        countUnversioned: configuration.get<boolean>(
          "sourceControl.countUnversioned",
          false
        )
      }
    });

    this.sourceControl.count = count;

    // Set repository reference on remote changes group
    if (this.groupManager.remoteChanges) {
      this.groupManager.remoteChanges.repository = this;
    }

    // Update remote changes count
    if (
      checkRemoteChanges &&
      result.remoteChanges.length !== this.remoteChangedFiles
    ) {
      this.remoteChangedFiles = result.remoteChanges.length;
      this._onDidChangeRemoteChangedFiles.fire();
    }

    this._onDidChangeStatus.fire();

    // Refresh file decorations in Explorer view
    if (this.fileDecorationProvider) {
      // Always refresh all decorations - simpler and handles all cases:
      // - Files added to changes
      // - Files removed from changes (reverted)
      // - Files moved between groups
      // Passing undefined refreshes all tracked files efficiently
      this.fileDecorationProvider.refresh(undefined);
    }

    this.currentBranch = await this.getCurrentBranch();

    return Promise.resolve();
  }

  public getResourceFromFile(uri: string | Uri): Resource | undefined {
    return this.groupManager.getResourceFromFile(uri);
  }

  /**
   * Get flat resource map for batch operations (Phase 21.A perf)
   * Avoids repeated URI conversion overhead in hot loops
   * @returns Map of file paths to resources
   */
  public getResourceMap(): Map<string, Resource> {
    return this.groupManager.getResourceMap();
  }

  public provideOriginalResource(uri: Uri): Uri | undefined {
    if (uri.scheme !== "file") {
      return;
    }

    // Not has original resource for content of ".svn" folder
    if (isDescendant(path.join(this.root, getSvnDir()), uri.fsPath)) {
      return;
    }

    return toSvnUri(uri, SvnUriAction.SHOW, {}, true);
  }

  public async getBranches() {
    try {
      return await this.repository.getBranches();
    } catch (error) {
      return [];
    }
  }

  @throttle
  public async status() {
    return this.run(Operation.Status);
  }

  public async show(
    filePath: string | Uri,
    revision?: string
  ): Promise<string> {
    return this.run<string>(Operation.Show, () => {
      return this.repository.show(filePath, revision);
    });
  }

  public async showBuffer(
    filePath: string | Uri,
    revision?: string
  ): Promise<Buffer> {
    return this.run<Buffer>(Operation.Show, () => {
      return this.repository.showBuffer(filePath, revision);
    });
  }

  public async addFiles(files: string[]) {
    return this.run(Operation.Add, () => this.repository.addFiles(files));
  }

  public async addChangelist(files: string[], changelist: string) {
    return this.run(Operation.AddChangelist, () =>
      this.repository.addChangelist(files, changelist)
    );
  }

  public async removeChangelist(files: string[]) {
    return this.run(Operation.RemoveChangelist, () =>
      this.repository.removeChangelist(files)
    );
  }

  public async getCurrentBranch() {
    return this.run(Operation.CurrentBranch, async () => {
      return this.repository.getCurrentBranch();
    });
  }

  public async newBranch(
    name: string,
    commitMessage: string = "Created new branch"
  ) {
    return this.run(Operation.NewBranch, async () => {
      await this.repository.newBranch(name, commitMessage);
      void this.updateRemoteChangedFiles();
    });
  }

  public async switchBranch(name: string, force: boolean = false) {
    await this.run(Operation.SwitchBranch, async () => {
      await this.repository.switchBranch(name, force);
      void this.updateRemoteChangedFiles();
    });
  }

  public async merge(
    name: string,
    reintegrate: boolean = false,
    accept_action: string = "postpone"
  ) {
    await this.run(Operation.Merge, async () => {
      await this.repository.merge(name, reintegrate, accept_action);
      void this.updateRemoteChangedFiles();
    });
  }

  public async updateRevision(
    ignoreExternals: boolean = false
  ): Promise<IUpdateResult> {
    return this.run<IUpdateResult>(Operation.Update, async () => {
      const result = await this.repository.update(ignoreExternals);
      // Brief delay to ensure SVN releases working copy lock
      await timeout(100);
      // Refresh local status to show conflicts and updated files
      await this.status();
      await this.updateRemoteChangedFiles();
      return result;
    });
  }

  public async pullIncomingChange(path: string) {
    return this.run<string>(Operation.Update, async () => {
      const response = await this.repository.pullIncomingChange(path);
      void this.updateRemoteChangedFiles();
      return response;
    });
  }

  public async resolve(files: string[], action: string) {
    return this.run(Operation.Resolve, () =>
      this.repository.resolve(files, action)
    );
  }

  public async commitFiles(message: string, files: string[]) {
    return this.run(Operation.Commit, () =>
      this.repository.commitFiles(message, files)
    );
  }

  public async revert(files: string[], depth: keyof typeof SvnDepth) {
    return this.run(Operation.Revert, () =>
      this.repository.revert(files, depth)
    );
  }

  public async info(path: string) {
    return this.run(Operation.Info, () => this.repository.getInfo(path));
  }

  public async patch(files: string[]) {
    return this.run(Operation.Patch, () => this.repository.patch(files));
  }

  public async patchBuffer(files: string[]) {
    return this.run(Operation.Patch, () => this.repository.patchBuffer(files));
  }

  public async patchChangelist(changelistName: string) {
    return this.run(Operation.Patch, () =>
      this.repository.patchChangelist(changelistName)
    );
  }

  public async removeFiles(files: string[], keepLocal: boolean) {
    return this.run(Operation.Remove, () =>
      this.repository.removeFiles(files, keepLocal)
    );
  }

  public async plainLog() {
    return this.run(Operation.Log, () => this.repository.plainLog());
  }

  public async plainLogBuffer() {
    return this.run(Operation.Log, () => this.repository.plainLogBuffer());
  }

  public async plainLogByRevision(revision: number) {
    return this.run(Operation.Log, () =>
      this.repository.plainLogByRevision(revision)
    );
  }

  public async plainLogByRevisionBuffer(revision: number) {
    return this.run(Operation.Log, () =>
      this.repository.plainLogByRevisionBuffer(revision)
    );
  }

  public async plainLogByText(search: string) {
    return this.run(Operation.Log, () =>
      this.repository.plainLogByText(search)
    );
  }

  public async plainLogByTextBuffer(search: string) {
    return this.run(Operation.Log, () =>
      this.repository.plainLogByTextBuffer(search)
    );
  }

  public async log(
    rfrom: string,
    rto: string,
    limit: number,
    target?: string | Uri
  ) {
    return this.run(Operation.Log, () =>
      this.repository.log(rfrom, rto, limit, target)
    );
  }

  public async logBatch(revisions: string[], target?: string | Uri) {
    return this.run(Operation.Log, () =>
      this.repository.logBatch(revisions, target)
    );
  }

  public async logByUser(user: string) {
    return this.run(Operation.Log, () => this.repository.logByUser(user));
  }

  public async cleanup() {
    return this.run(Operation.CleanUp, () => this.repository.cleanup());
  }

  public async removeUnversioned() {
    return this.run(Operation.CleanUp, () =>
      this.repository.removeUnversioned()
    );
  }

  public async removeIgnored() {
    return this.run(Operation.CleanUp, () => this.repository.removeIgnored());
  }

  public async vacuumPristines() {
    return this.run(Operation.CleanUp, () => this.repository.vacuumPristines());
  }

  public async cleanupWithExternals() {
    return this.run(Operation.CleanUp, () =>
      this.repository.cleanupWithExternals()
    );
  }

  public async cleanupAdvanced(options: ICleanupOptions) {
    return this.run(Operation.CleanUp, () =>
      this.repository.cleanupAdvanced(options)
    );
  }

  public async getInfo(path: string, revision?: string): Promise<ISvnInfo> {
    return this.run(Operation.Info, () =>
      this.repository.getInfo(path, revision, true)
    );
  }

  public async getChanges(): Promise<ISvnPathChange[]> {
    return this.run(Operation.Changes, () => this.repository.getChanges());
  }

  public async blame(path: string, revision?: string) {
    return this.run(Operation.Blame, () =>
      this.repository.blame(path, revision)
    );
  }

  public async finishCheckout() {
    return this.run(Operation.SwitchBranch, () =>
      this.repository.finishCheckout()
    );
  }

  public async addToIgnore(
    expressions: string[],
    directory: string,
    recursive: boolean = false
  ) {
    return this.run(Operation.Ignore, () =>
      this.repository.addToIgnore(expressions, directory, recursive)
    );
  }

  public async rename(oldFile: string, newFile: string) {
    return this.run(Operation.Rename, () =>
      this.repository.rename(oldFile, newFile)
    );
  }

  public async list(filePath: string): Promise<ISvnListItem[]> {
    return this.run<ISvnListItem[]>(Operation.List, () => {
      // Convert local path to relative for URL-based listing (faster, non-recursive)
      const relativePath =
        filePath === this.root ? undefined : path.relative(this.root, filePath);
      return this.repository.list(relativePath);
    });
  }

  /**
   * List folder contents recursively (for folder size/count estimation).
   * @param folderPath Local folder path
   * @param timeout Optional timeout in ms for large folders
   */
  public async listRecursive(
    folderPath: string,
    timeout?: number
  ): Promise<ISvnListItem[]> {
    return this.run<ISvnListItem[]>(Operation.List, () => {
      const relativePath = path.relative(this.root, folderPath);
      return this.repository.listRecursive(relativePath, timeout);
    });
  }

  public getPathNormalizer(): PathNormalizer {
    return new PathNormalizer(this.repository.info);
  }

  /**
   * Get credential storage key based on server (not repo path).
   * This allows multiple repos on same server to share credentials.
   * e.g., https://svn.example.com/repoA and /repoB both use
   * key "vscode.positron-svn:https://svn.example.com"
   */
  public getCredentialServiceName() {
    const info = this.repository.info;
    const repoUrl = info.repository?.root || info.url;

    if (repoUrl) {
      try {
        const url = new URL(repoUrl);
        // Use scheme + host + port (if non-default)
        const server = `${url.protocol}//${url.host}`;
        return `vscode.positron-svn:${server}`;
      } catch {
        // Invalid URL, fall back to full URL
        return `vscode.positron-svn:${repoUrl}`;
      }
    }

    return "vscode.positron-svn";
  }

  public async loadStoredAuths(): Promise<Array<IStoredAuth>> {
    // Skip if extension storage disabled for this environment
    if (!shouldUseExtensionStorage()) {
      return [];
    }

    // Return cached if valid (60s TTL)
    const now = Date.now();
    if (this.storedAuthsCache && now < this.storedAuthsCache.expiry) {
      return this.storedAuthsCache.accounts;
    }

    // Prevent multiple prompts for auth
    if (this.lastPromptAuth) {
      await this.lastPromptAuth;
    }

    try {
      const secret = await this.secrets.get(this.getCredentialServiceName());

      if (secret === undefined) {
        this.storedAuthsCache = { accounts: [], expiry: now + 60000 };
        return [];
      }

      // Safe JSON.parse with runtime type validation
      const parsed = JSON.parse(secret);
      if (!Array.isArray(parsed)) {
        this.storedAuthsCache = { accounts: [], expiry: now + 60000 };
        return [];
      }
      // Filter to only valid credential entries
      const accounts = parsed.filter(
        (c): c is IStoredAuth =>
          c && typeof c.account === "string" && typeof c.password === "string"
      );
      this.storedAuthsCache = { accounts, expiry: now + 60000 };
      return accounts;
    } catch (error) {
      // SecretStorage can fail if keyring is locked/unavailable
      logError("Failed to load stored credentials", error);
      return [];
    }
  }

  public async saveAuth(): Promise<void> {
    // Skip if extension storage disabled for this environment
    if (!shouldUseExtensionStorage()) {
      return;
    }

    if (!this.canSaveAuth || !this.username || !this.password) {
      return;
    }

    // Mutex: serialize concurrent saves to prevent read-modify-write race
    const username = this.username;
    const password = this.password;
    this.canSaveAuth = false;

    this.saveAuthLock = this.saveAuthLock.then(async () => {
      try {
        const secret = await this.secrets.get(this.getCredentialServiceName());
        let credentials: Array<IStoredAuth> = [];

        if (typeof secret === "string") {
          try {
            const parsed = JSON.parse(secret);
            if (Array.isArray(parsed)) {
              credentials = parsed.filter(
                (c): c is IStoredAuth =>
                  c &&
                  typeof c.account === "string" &&
                  typeof c.password === "string"
              );
            }
          } catch (error) {
            logError("Failed to parse stored credentials", error);
            credentials = [];
          }
        }

        // Deduplicate: update existing entry or add new
        const existingIndex = credentials.findIndex(
          c => c.account === username
        );
        if (existingIndex >= 0) {
          credentials[existingIndex]!.password = password;
        } else {
          credentials.push({ account: username, password });
        }

        await this.secrets.store(
          this.getCredentialServiceName(),
          JSON.stringify(credentials)
        );
        // Invalidate cache after save
        this.storedAuthsCache = undefined;
      } catch (error) {
        // SecretStorage can fail if keyring is locked/unavailable
        // Reset canSaveAuth so user can retry on next successful operation
        this.canSaveAuth = true;
        logError("Failed to save credentials", error);
      }
    });

    return this.saveAuthLock;
  }

  /**
   * Clear all saved credentials for this repository
   * Removes from SecretStorage and clears runtime credentials
   */
  public async clearCredentials(): Promise<void> {
    // Clear SecretStorage
    await this.secrets.delete(this.getCredentialServiceName());

    // Clear runtime credentials
    this.username = undefined;
    this.password = undefined;
    this.canSaveAuth = false;
  }

  public async promptAuth(): Promise<IAuth | undefined> {
    // Prevent multiple prompts: active prompt or cooldown period
    if (this.lastPromptAuth || this.promptAuthCooldown) {
      if (this.lastPromptAuth) {
        return this.lastPromptAuth;
      }
      return undefined; // During cooldown, skip prompting
    }

    const repoUrl = this.repository.info?.url;
    this.lastPromptAuth = commands.executeCommand(
      "svn.promptAuth",
      undefined,
      undefined,
      repoUrl
    );
    const result = await this.lastPromptAuth;

    if (result) {
      this.username = result.username;
      this.password = result.password;
      this.canSaveAuth = true;
    }

    // Cooldown: prevent rapid re-prompting after dialog closes
    this.lastPromptAuth = undefined;
    this.promptAuthCooldown = true;
    if (this.promptAuthCooldownTimer) {
      clearTimeout(this.promptAuthCooldownTimer);
    }
    this.promptAuthCooldownTimer = setTimeout(() => {
      this.promptAuthCooldown = false;
      this.promptAuthCooldownTimer = undefined;
    }, 500);

    return result;
  }

  public onDidSaveTextDocument(document: TextDocument) {
    const uriString = document.uri.toString();
    const conflict = this.conflicts.resourceStates.find(
      resource => resource.resourceUri.toString() === uriString
    );
    if (!conflict) {
      return;
    }

    const text = document.getText();

    // Check for lines begin with "<<<<<<", "=======", ">>>>>>>"
    if (!/^<{7}[^]+^={7}[^]+^>{7}/m.test(text)) {
      commands.executeCommand("svn.resolved", conflict.resourceUri);
    }
  }

  private async run<T>(
    operation: Operation,
    runOperation: () => Promise<T> = () => Promise.resolve(null as T)
  ): Promise<T> {
    if (this.state !== RepositoryState.Idle) {
      throw new Error("Repository not initialized");
    }

    const run = async () => {
      this._operations.start(operation);
      this._onRunOperation.fire(operation);

      try {
        const result = await this.retryRun(runOperation);

        const checkRemote = operation === Operation.StatusRemote;

        if (!isReadOnly(operation)) {
          await this.updateModelState(checkRemote);
        }

        return result;
      } catch (err) {
        const svnError = err as ISvnErrorData;
        if (svnError.svnErrorCode === svnErrorCodes.NotASvnRepository) {
          this.state = RepositoryState.Disposed;
        }

        const rootExists = await exists(this.workspaceRoot);
        if (!rootExists) {
          await commands.executeCommand("svn.close", this);
        }

        throw err;
      } finally {
        this._operations.end(operation);
        this._onDidRunOperation.fire(operation);
      }
    };

    return shouldShowProgress(operation)
      ? window.withProgress(
          { location: ProgressLocation.SourceControl, cancellable: true },
          run
        )
      : run();
  }

  private async retryRun<T>(
    runOperation: () => Promise<T> = () => Promise.resolve(null as T)
  ): Promise<T> {
    let attempt = 0;
    // Phase 8.2 perf fix - pre-load accounts before retry loop to avoid blocking
    const accounts: IStoredAuth[] = await this.loadStoredAuths();

    // Serialize credential initialization to prevent race condition
    // Multiple concurrent retryRun calls could otherwise both set credentials
    // from accounts[0], then both fail and try accounts[1], causing lockout
    await this.credentialLock;
    let releaseLock: () => void = () => {};
    this.credentialLock = new Promise(resolve => {
      releaseLock = resolve;
    });

    try {
      // Pre-set credentials from first stored account if none set
      // Prevents first attempt failing with empty credentials in remote sessions
      if (!this.username && !this.password && accounts.length > 0) {
        this.username = accounts[0]!.account;
        this.password = accounts[0]!.password;
      }

      while (true) {
        try {
          attempt++;
          const result = await runOperation();
          this.saveAuth();
          return result;
        } catch (err) {
          const svnError = err as ISvnErrorData;

          if (
            svnError.svnErrorCode === svnErrorCodes.RepositoryIsLocked &&
            attempt <= 10
          ) {
            // quadratic backoff
            await timeout(Math.pow(attempt, 2) * 50);
          } else if (
            svnError.svnErrorCode === svnErrorCodes.AuthorizationFailed &&
            attempt <= accounts.length
          ) {
            // Backoff with jitter before trying next stored account
            await timeout(400 + Math.random() * 200); // 400-600ms
            // Cycle through stored accounts properly
            // attempt 1 failed with accounts[0], try accounts[1], etc.
            const index = attempt;
            const account = accounts[index];
            if (account) {
              this.username = account.account;
              this.password = account.password;
            }
          } else if (
            svnError.svnErrorCode === svnErrorCodes.AuthorizationFailed &&
            attempt <= 3 + accounts.length
          ) {
            // Backoff with jitter before prompting user
            await timeout(800 + Math.random() * 400); // 800-1200ms
            const result = await this.promptAuth();
            if (!result) {
              throw err;
            }
          } else {
            throw err;
          }
        }
      }
    } finally {
      // Release lock so next operation can proceed
      releaseLock();
    }
  }

  /**
   * Lock files/directories to prevent concurrent modifications.
   * @param files Paths to lock
   * @param options Lock options (comment, force)
   */
  public async lock(files: string[], options: ILockOptions = {}) {
    return this.run(Operation.Lock, () => this.repository.lock(files, options));
  }

  /**
   * Unlock files/directories.
   * @param files Paths to unlock
   * @param options Unlock options (force to break others' locks)
   */
  public async unlock(files: string[], options: IUnlockOptions = {}) {
    return this.run(Operation.Unlock, () =>
      this.repository.unlock(files, options)
    );
  }

  /**
   * Get lock information for a file/directory.
   * @param filePath Path to check
   * @returns Lock info or null if not locked
   */
  public async getLockInfo(filePath: string): Promise<ISvnLockInfo | null> {
    return this.run(Operation.Info, () =>
      this.repository.getLockInfo(filePath)
    );
  }

  /**
   * Get lock information for multiple URLs in a single SVN call.
   * Efficient batch operation for checking locks on remote files.
   */
  public async getBatchLockInfo(
    urls: string[]
  ): Promise<Map<string, ISvnLockInfo | null>> {
    return this.run(Operation.Info, () =>
      this.repository.getBatchLockInfo(urls)
    );
  }

  /**
   * Set depth of a folder for sparse checkouts.
   * @param folderPath Path to folder
   * @param depth One of: exclude, empty, files, immediates, infinity
   * @param options.parents Restore parent folders if excluded
   * @param options.timeout Custom timeout in ms for long downloads
   */
  public async setDepth(
    folderPath: string,
    depth: keyof typeof SvnDepth,
    options?: { parents?: boolean; timeout?: number }
  ) {
    return this.run(Operation.Update, () =>
      this.repository.setDepth(folderPath, depth, options)
    );
  }

  /**
   * Check if file has svn:needs-lock property.
   */
  public async hasNeedsLock(filePath: string): Promise<boolean> {
    return this.repository.hasNeedsLock(filePath);
  }

  /**
   * Set svn:needs-lock property on file (makes read-only until locked).
   */
  public async setNeedsLock(filePath: string) {
    return this.run(Operation.Update, () =>
      this.repository.setNeedsLock(filePath)
    );
  }

  /**
   * Remove svn:needs-lock property from file.
   */
  public async removeNeedsLock(filePath: string) {
    return this.run(Operation.Update, () =>
      this.repository.removeNeedsLock(filePath)
    );
  }

  public dispose(): void {
    // Clear auth cooldown timer to prevent memory leak
    if (this.promptAuthCooldownTimer) {
      clearTimeout(this.promptAuthCooldownTimer);
      this.promptAuthCooldownTimer = undefined;
    }
    // Stop remote change polling to prevent timer leak
    this.remoteChangeService.dispose();
    this.statusService.dispose();
    this.repository.clearInfoCacheTimers(); // Phase 8.2 perf fix - clear timers
    this.disposables = dispose(this.disposables);
  }
}
