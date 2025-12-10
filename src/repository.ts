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

// Input box validation types (not in older vscode types)
interface InputBoxValidation {
  message: string;
  type: InputBoxValidationType;
}
enum InputBoxValidationType {
  Error = 0,
  Warning = 1,
  Information = 2
}

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
import { STAGING_CHANGELIST } from "./services/stagingService";
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
  LockStatus,
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
import { exists, rename as fsRename, stat } from "./fs";
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
import { IHistoryFilter } from "./historyView/historyFilter";
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
  get staged(): ISvnResourceGroup {
    return this.groupManager.staged;
  }

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

  get staging() {
    return this.groupManager.staging;
  }

  private lastPromptAuth?: Thenable<IAuth | undefined>;
  private saveAuthLock: Promise<void> = Promise.resolve();
  private credentialLock: Promise<void> = Promise.resolve(); // Mutex for credential assignment
  private promptAuthCooldown: boolean = false;
  private promptAuthCooldownTimer?: ReturnType<typeof setTimeout>;
  private storedAuthsCache?: { accounts: IStoredAuth[]; expiry: number };

  // Needs-lock cache: set of relative paths with svn:needs-lock property
  // Populated in batch by refreshNeedsLockCache() for efficient decoration
  private needsLockFilesSet = new Set<string>();
  private needsLockCacheExpiry = 0;
  private static readonly NEEDS_LOCK_CACHE_TTL = 60000; // 60 seconds

  // Lock status cache: preserves lock info between status calls
  // Lock status is only visible with --show-updates, so we cache it
  // Map: relative path -> { lockStatus, lockOwner, hasLockToken }
  private lockStatusCache = new Map<
    string,
    { lockStatus: LockStatus; lockOwner?: string; hasLockToken: boolean }
  >();

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
        try {
          await this.onDidAnyFileChanged(e);
        } catch (err) {
          logError("File watcher callback failed", err);
        }
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
    this.sourceControl.inputBox.placeholder =
      "Message here or Ctrl+Enter for guided commit";
    this.sourceControl.inputBox.visible = true;
    this.sourceControl.inputBox.enabled = true;
    // @ts-expect-error - validateInput exists at runtime but not in types
    this.sourceControl.inputBox.validateInput = (text: string) =>
      this.validateCommitInput(text);
    this.sourceControl.acceptInputCommand = {
      command: "svn.commitFromInputBox",
      title: "Commit",
      arguments: [this]
    };
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

    // Update action button when operations start/end (for spinning icon)
    this.onDidChangeOperations(
      () => this.updateActionButton(),
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

    // Intercept file renames to use svn move for tracked files
    this.disposables.push(
      workspace.onDidRenameFiles(e => this.onDidRenameFiles(e))
    );

    // Intercept file deletes to use svn delete for tracked files
    this.disposables.push(
      workspace.onDidDeleteFiles(e => this.onDidDeleteFiles(e))
    );

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
      // Invalidate config cache only when cached settings change (v2.32.14 fix)
      // Previously invalidated on ANY config change which was too aggressive
      if (
        e.affectsConfiguration("svn.delete.actionForDeletedFiles") ||
        e.affectsConfiguration("svn.delete.ignoredRulesForDeletedFiles") ||
        e.affectsConfiguration("svn.sourceControl.countBadge") ||
        e.affectsConfiguration("svn.autorefresh") ||
        e.affectsConfiguration("svn.remoteChanges.checkFrequency")
      ) {
        this._configCache = undefined;
      }

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

    this.status().catch(err => {
      // Show user-friendly message for connection errors on startup
      const svnError = err as ISvnErrorData;
      if (
        svnError.svnErrorCode === svnErrorCodes.UnableToConnect ||
        svnError.stderrFormated?.includes("No such host")
      ) {
        window.showErrorMessage(
          "Unable to connect to SVN server. Check VPN/network."
        );
      }
    });

    this.disposables.push(
      workspace.onDidSaveTextDocument(document => {
        this.onDidSaveTextDocument(document);
      }),
      // Prompt to lock files with svn:needs-lock property when opened
      workspace.onDidOpenTextDocument(document => {
        if (document.uri.scheme === "file") {
          // Fire async - don't block document open
          void this.promptLockIfNeeded(document.uri);
        }
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
        "remove"
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

    // Check grace period after force refresh to avoid redundant calls
    if (this.isInGracePeriod()) {
      return; // Info was already updated during force refresh
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

  /**
   * Intercept file renames to use svn move for tracked files.
   * This preserves file history when renaming via Explorer.
   */
  private async onDidRenameFiles(e: {
    files: ReadonlyArray<{ oldUri: Uri; newUri: Uri }>;
  }): Promise<void> {
    for (const { oldUri, newUri } of e.files) {
      // Skip files outside this repository
      if (!oldUri.fsPath.startsWith(this.workspaceRoot)) {
        continue;
      }

      try {
        // Check if old path was tracked by SVN (will show as "missing" now)
        const wasTracked = await this.wasFileTracked(oldUri.fsPath);

        if (wasTracked) {
          // Undo the filesystem rename
          await fsRename(newUri.fsPath, oldUri.fsPath);

          // Use svn rename to preserve history
          await this.rename(oldUri.fsPath, newUri.fsPath);
        }
      } catch (err) {
        // Log but don't block - user can manually fix if needed
        logError(`Failed to convert rename to svn move: ${oldUri.fsPath}`, err);
      }
    }
  }

  /**
   * Intercept file deletes to use svn delete for tracked files.
   * This immediately marks files for deletion instead of leaving as "missing".
   */
  private async onDidDeleteFiles(e: {
    files: ReadonlyArray<Uri>;
  }): Promise<void> {
    const config = this.getConfig();

    // Only auto-delete if setting is "remove"
    if (config.actionForDeletedFiles !== "remove") {
      return;
    }

    // Collect all tracked files first, then delete in batch
    // This prevents race conditions when deleting multiple files
    const trackedFiles: string[] = [];

    for (const uri of e.files) {
      // Skip files outside this repository
      if (!uri.fsPath.startsWith(this.workspaceRoot)) {
        continue;
      }

      try {
        // Check if file was tracked by SVN
        const wasTracked = await this.wasFileTracked(uri.fsPath);
        if (wasTracked) {
          trackedFiles.push(uri.fsPath);
        }
      } catch (err) {
        logError(`Failed to check if tracked: ${uri.fsPath}`, err);
      }
    }

    // Delete all tracked files in a single svn delete call
    if (trackedFiles.length > 0) {
      try {
        await this.removeFiles(trackedFiles, false);
      } catch (err) {
        logError(`Failed to auto-delete files`, err);
      }
    }
  }

  /**
   * Check if a file path was tracked by SVN before it was renamed/deleted.
   * Uses svn info which works even on missing files.
   */
  private async wasFileTracked(filePath: string): Promise<boolean> {
    try {
      // svn info succeeds for tracked files, even if missing
      await this.repository.getInfo(filePath);
      return true;
    } catch {
      // Not tracked or error
      return false;
    }
  }

  private onFSChange(_uri: Uri): void {
    const config = this.getConfig();

    if (!config.autorefresh) {
      return;
    }

    // Check grace period after force refresh (Update, Commit, etc.)
    // to avoid redundant status calls from file watcher
    if (this.isInGracePeriod()) {
      this.queueRefreshAfterGracePeriod();
      return;
    }

    // Don't check idle here - eventuallyUpdateWhenIdleAndWait handles
    // idle-waiting via whenIdleAndFocused(). Previously, events were
    // silently dropped if operations were running, causing missed updates.
    this.eventuallyUpdateWhenIdleAndWait();
  }

  /**
   * Check if within grace period after a force refresh operation.
   */
  private isInGracePeriod(): boolean {
    return Date.now() - this.lastForceRefresh < this.FORCE_REFRESH_GRACE_MS;
  }

  /**
   * Queue a refresh for after the grace period ends.
   * Ensures user changes during grace period aren't lost.
   */
  private queueRefreshAfterGracePeriod(): void {
    // Already queued
    if (this.pendingGraceRefresh) {
      return;
    }

    const remaining =
      this.FORCE_REFRESH_GRACE_MS - (Date.now() - this.lastForceRefresh);
    if (remaining <= 0) {
      // Grace period already expired, refresh now
      this.eventuallyUpdateWhenIdleAndWait();
      return;
    }

    // Queue refresh for after grace period
    this.pendingGraceRefresh = setTimeout(() => {
      this.pendingGraceRefresh = undefined;
      this.eventuallyUpdateWhenIdleAndWait();
    }, remaining + 100); // +100ms buffer
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
  // Cache matches debounce time (500ms) - after debounce completes, cache expired
  private readonly MODEL_CACHE_MS = 500;

  // Grace period after force refresh to avoid redundant file watcher status calls
  private lastForceRefresh: number = 0;
  private readonly FORCE_REFRESH_GRACE_MS = 5000; // 5 seconds
  private pendingGraceRefresh: NodeJS.Timeout | undefined;

  /** Set grace period to block file watcher status updates */
  public setGracePeriod(): void {
    this.lastForceRefresh = Date.now();
  }

  @globalSequentialize("updateModelState")
  public async updateModelState(
    checkRemoteChanges: boolean = false,
    forceRefresh: boolean = false,
    fetchLockStatus: boolean = false
  ) {
    // Skip status updates during sparse checkout downloads
    // Prevents working copy lock conflicts on Windows
    if (this._sparseDownloadInProgress) {
      return;
    }

    // Short-term cache: skip if called within 2s (unless forced)
    // Note: @throttle removed (Phase 15) - cache already handles throttling
    const now = Date.now();
    if (!forceRefresh && now - this.lastModelUpdate < this.MODEL_CACHE_MS) {
      return;
    }
    this.lastModelUpdate = now;

    // Force refresh repository info after revision-changing operations
    // (Commit, Update, etc.) so repo history can detect the new revision
    if (forceRefresh) {
      // Set grace period BEFORE updateInfo to block file watcher events
      // that fire during lock/unlock .svn directory changes
      this.lastForceRefresh = Date.now();
      await this.repository.updateInfo(true);
    }

    // Get categorized status from StatusService
    const result = await this.retryRun(async () => {
      return this.statusService.updateStatus({
        checkRemoteChanges,
        fetchLockStatus
      });
    });

    // Update metadata
    this.statusExternal = [...result.statusExternal];
    this.statusIgnored = [...result.statusIgnored];
    this.isIncomplete = result.isIncomplete;
    this.needCleanUp = result.needCleanUp;

    // Populate lock status cache from status results
    // Clear and replace to remove stale entries (unlocked files)
    this.lockStatusCache.clear();
    for (const [relativePath, lockInfo] of result.lockStatuses) {
      this.lockStatusCache.set(relativePath, lockInfo);
    }

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
      },
      // Lock status is authoritative when fetched with --show-updates
      lockStatusFresh: fetchLockStatus
    });

    this.sourceControl.count = count;
    this.updateActionButton();

    // Update context keys for conditional UI
    const hasConflicts = this.groupManager.conflicts.resourceStates.length > 0;
    commands.executeCommand("setContext", "svn.hasConflicts", hasConflicts);

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

    // Update context key for remote changes
    const hasRemoteChanges = this.remoteChangedFiles > 0;
    commands.executeCommand(
      "setContext",
      "svn.updateAvailable",
      hasRemoteChanges
    );

    this._onDidChangeStatus.fire();

    // Refresh needs-lock cache only when expired (60s TTL)
    // Avoids redundant propget calls on frequent status updates
    if (Date.now() >= this.needsLockCacheExpiry) {
      await this.refreshNeedsLockCache();
    }

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

  private updateActionButton(): void {
    const stagedCount = this.groupManager.staged.resourceStates.length;
    const changesCount = this.groupManager.changes.resourceStates.length;
    const hasChanges = stagedCount > 0 || changesCount > 0;

    // Check if commit/update is in progress
    const isCommitting = this.operations.isRunning(Operation.Commit);
    const isUpdating = this.operations.isRunning(Operation.Update);
    const isOperationRunning = isCommitting || isUpdating;

    // Use spinning icon during operations
    let icon = "$(check)";
    let tooltip = "Commit Changes";
    if (isCommitting) {
      icon = "$(sync~spin)";
      tooltip = "Committing...";
    } else if (isUpdating) {
      icon = "$(sync~spin)";
      tooltip = "Updating...";
    }

    const label =
      stagedCount > 0 ? `${icon} Commit (${stagedCount})` : `${icon} Commit`;

    // Secondary commands for dropdown menu (Command[][])
    const secondaryCommands = [
      [
        {
          command: "svn.commitStaged",
          title: "Commit Staged...",
          tooltip: "Commit only staged files",
          arguments: [this]
        },
        {
          command: "svn.commitAll",
          title: "Commit All...",
          tooltip: "Commit all changed files",
          arguments: [this]
        },
        {
          command: "svn.commitQuick",
          title: "Commit (Quick)",
          tooltip: "Commit staged files without message prompt",
          arguments: [this]
        }
      ]
    ];

    // @ts-expect-error - actionButton exists at runtime but not in types
    this.sourceControl.actionButton = {
      command: {
        command: "svn.commitFromInputBox",
        title: label,
        tooltip,
        arguments: [this]
      },
      secondaryCommands,
      enabled: hasChanges && !isOperationRunning
    };
  }

  /**
   * Force re-validation of the commit input box.
   * VS Code only calls validateInput when text changes, so we toggle value
   * to trigger re-validation after staging/unstaging operations.
   */
  private triggerInputValidation(): void {
    const inputBox = this.sourceControl.inputBox;
    const currentValue = inputBox.value;
    // Toggle value to force validateInput callback
    inputBox.value = currentValue + " ";
    inputBox.value = currentValue;
  }

  private validateCommitInput(text: string): InputBoxValidation | undefined {
    const stagedCount = this.groupManager.staged.resourceStates.length;
    const conflictCount = this.groupManager.conflicts.resourceStates.length;

    // Error: conflicts must be resolved first
    if (conflictCount > 0) {
      return {
        message: `${conflictCount} conflict(s) must be resolved before committing`,
        type: InputBoxValidationType.Error
      };
    }

    // Warning: no files staged
    if (stagedCount === 0) {
      return {
        message: "No files staged for commit",
        type: InputBoxValidationType.Warning
      };
    }

    // Info: message empty (but not an error - guided commit will prompt)
    if (!text || text.trim() === "") {
      return {
        message: "Enter message or press Ctrl+Enter for guided commit",
        type: InputBoxValidationType.Information
      };
    }

    return undefined;
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

  public async rollbackToRevision(
    filePath: string,
    targetRevision: string
  ): Promise<string> {
    return this.run<string>(Operation.Merge, () => {
      return this.repository.rollbackToRevision(filePath, targetRevision);
    });
  }

  public async patchRevision(revision: string, url: Uri): Promise<string> {
    return this.run<string>(Operation.Show, () => {
      return this.repository.patchRevision(revision, url);
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

  /**
   * Stage files with optimistic UI update (no directory expansion).
   * Stages just the paths provided - folders are staged alone for visual grouping.
   * For unversioned files, `svn add` is called first before changelist.
   */
  public async stageOptimistic(files: string[]): Promise<void> {
    // Find unversioned items that need `svn add` first
    const unversionedPaths = this.findUnversionedPaths(files);
    if (unversionedPaths.length > 0) {
      // svn add handles parent directories automatically
      await this.repository.addFiles(unversionedPaths);
    }

    // Filter out directories for SVN command (changelists are file-only)
    // but keep them for UI update
    const filesOnly = await this.filterOutDirectories(files);

    // Run SVN command to update working copy state (files only)
    if (filesOnly.length > 0) {
      await this.repository.addChangelist(filesOnly, STAGING_CHANGELIST);
    }
    // Optimistically update UI (includes directories for visual grouping)
    this.groupManager.moveToStaged(files);
    this.updateActionButton();
    this.triggerInputValidation();
  }

  /**
   * Stage files with optimistic UI update, expanding directories.
   * When staging a directory, includes all changed descendant files.
   * For unversioned files, `svn add` is called first before changelist.
   */
  public async stageOptimisticWithChildren(files: string[]): Promise<void> {
    // Expand directories to include all changed descendant files
    // (SVN changelists don't support directories)
    const expanded = this.expandDirectoriesToChangedFiles(files);

    // Find unversioned items that need `svn add` first
    const unversionedPaths = this.findUnversionedPaths(expanded);
    if (unversionedPaths.length > 0) {
      // svn add handles parent directories automatically
      await this.repository.addFiles(unversionedPaths);
    }

    // Filter out directories for SVN command (changelists are file-only)
    // but keep them for UI update
    const filesOnly = await this.filterOutDirectories(expanded);

    // Run SVN command to update working copy state (files only)
    if (filesOnly.length > 0) {
      await this.repository.addChangelist(filesOnly, STAGING_CHANGELIST);
    }
    // Optimistically update UI (includes directories for visual grouping)
    this.groupManager.moveToStaged(expanded);
    this.updateActionButton();
    this.triggerInputValidation();
  }

  /**
   * Find paths that are unversioned (need `svn add` before changelist).
   */
  private findUnversionedPaths(paths: string[]): string[] {
    const unversioned: string[] = [];
    for (const p of paths) {
      const resource = this.groupManager.getResourceFromFile(p);
      if (resource && resource.type === Status.UNVERSIONED) {
        unversioned.push(p);
      }
    }
    return unversioned;
  }

  /**
   * Filter out directories from path list.
   */
  private async filterOutDirectories(paths: string[]): Promise<string[]> {
    const files: string[] = [];
    for (const p of paths) {
      try {
        const stats = await stat(p);
        if (!stats.isDirectory()) {
          files.push(p);
        }
      } catch {
        // If stat fails (file doesn't exist), include it anyway
        files.push(p);
      }
    }
    return files;
  }

  /**
   * Expand directory paths to include all changed descendant files.
   * SVN changelists only work with files, not directories.
   */
  private expandDirectoriesToChangedFiles(paths: string[]): string[] {
    const result = new Set<string>();
    const changedPaths = this.groupManager.changes.resourceStates.map(
      r => r.resourceUri.fsPath
    );

    for (const p of paths) {
      // Always include the original path
      result.add(p);

      // Check if any changed files are descendants of this path
      for (const changed of changedPaths) {
        if (isDescendant(p, changed)) {
          result.add(changed);
        }
      }
    }

    return Array.from(result);
  }

  /**
   * Unstage files with optimistic UI update.
   * Runs SVN changelist command but skips full status refresh.
   * @param files Files to unstage
   * @param targetChangelist Optional changelist to restore to
   */
  public async unstageOptimistic(
    files: string[],
    targetChangelist?: string
  ): Promise<void> {
    // Expand directories to include all staged descendant files
    const expanded = this.expandDirectoriesToStagedFiles(files);

    // Filter out directories for SVN command (changelists are file-only)
    const filesOnly = await this.filterOutDirectories(expanded);

    if (filesOnly.length > 0) {
      if (targetChangelist) {
        // Restore to original changelist
        await this.repository.addChangelist(filesOnly, targetChangelist);
      } else {
        // Remove from changelist entirely
        await this.repository.removeChangelist(filesOnly);
      }
    }
    // Optimistically update UI without status refresh
    this.groupManager.moveFromStaged(expanded, targetChangelist);
    this.updateActionButton();
    this.triggerInputValidation();
  }

  /**
   * Expand directory paths to include all staged descendant files.
   */
  private expandDirectoriesToStagedFiles(paths: string[]): string[] {
    const result = new Set<string>();
    const stagedPaths = this.groupManager.staged.resourceStates.map(
      r => r.resourceUri.fsPath
    );

    for (const p of paths) {
      result.add(p);

      for (const staged of stagedPaths) {
        if (isDescendant(p, staged)) {
          result.add(staged);
        }
      }
    }

    return Array.from(result);
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
    const result = await this.run<IUpdateResult>(Operation.Update, async () => {
      const updateResult = await this.repository.update(ignoreExternals);
      // Note: status refresh handled by run() via updateModelState() after callback
      // Do NOT call this.status() here - causes credentialLock deadlock (nested retryRun)
      // Skip updateRemoteChangedFiles - after update we're at HEAD, no remote changes
      return updateResult;
    });
    // Fetch history views to show new commits from update
    await commands.executeCommand("svn.repolog.fetch");
    await commands.executeCommand("svn.itemlog.refresh");
    return result;
  }

  /**
   * Check if server has new commits since last update.
   * Uses svn log BASE:HEAD to compare local vs remote revision.
   */
  public async hasRemoteChanges(): Promise<boolean> {
    return this.repository.hasRemoteChanges();
  }

  public async pullIncomingChange(path: string) {
    return this.run<string>(Operation.Update, async () => {
      const response = await this.repository.pullIncomingChange(path);
      // Note: updateRemoteChangedFiles() called by caller after batch completes
      // to avoid N redundant calls when pulling N files
      return response;
    });
  }

  /**
   * Trigger remote changes refresh after batch operations complete.
   * Call this once after pulling multiple incoming changes.
   */
  public refreshRemoteChanges(): void {
    void this.updateRemoteChangedFiles();
  }

  public async resolve(files: string[], action: string) {
    return this.run(Operation.Resolve, () =>
      this.repository.resolve(files, action)
    );
  }

  public async commitFiles(message: string, files: string[]) {
    // Check for needs-lock files that aren't locked
    // Skip warning for property-only changes (e.g., setting svn:needs-lock itself)
    const unlockedNeedsLock: string[] = [];
    for (const file of files) {
      const hasNeedsLock = await this.hasNeedsLock(file);
      if (hasNeedsLock) {
        // Check if file has lock token
        const resource = this.getResourceFromFile(file);
        // Skip if property-only change (status=NORMAL means no content changes)
        if (resource?.type === Status.NORMAL) {
          continue;
        }
        if (!resource?.hasLockToken) {
          unlockedNeedsLock.push(file);
        }
      }
    }

    if (unlockedNeedsLock.length > 0) {
      const answer = await window.showWarningMessage(
        `${unlockedNeedsLock.length} file(s) have svn:needs-lock but are not locked. Commit anyway?`,
        { modal: true },
        "Commit Anyway"
      );
      if (answer !== "Commit Anyway") {
        throw new Error("Commit cancelled: unlock files or lock them first");
      }
    }

    const result = await this.run(Operation.Commit, () =>
      this.repository.commitFiles(message, files)
    );
    // Clear log cache so fresh data is fetched (log cache has 60s TTL)
    this.clearLogCache();

    // Post-commit update: sync working copy to new revision (if enabled)
    const autoUpdate = configuration.get<string>("commit.autoUpdate", "both");
    if (autoUpdate === "both" || autoUpdate === "after") {
      try {
        await window.withProgress(
          {
            location: ProgressLocation.Notification,
            title: "Syncing working copy...",
            cancellable: false
          },
          async () => {
            await this.updateRevision();
          }
        );
      } catch (updateErr) {
        // Log but don't fail the commit - it already succeeded
        console.warn("Post-commit update failed:", updateErr);
      }
    }

    // Parse commit revision from result (e.g., "3 files commited: revision 106.")
    // For partial commits, svn info on root might not show new revision
    const revMatch = result.match(/revision (\d+)/i);
    if (revMatch && revMatch[1]) {
      const newRevision = revMatch[1];
      // Update info.revision directly so BASE indicator is correct
      // This handles mixed-revision working copies after partial commit
      if (
        parseInt(newRevision, 10) > parseInt(this.repository.info.revision, 10)
      ) {
        (this.repository.info as { revision: string }).revision = newRevision;
      }
    }

    // Refresh repo info (will use cache if revision unchanged)
    await this.repository.updateInfo(true);
    // Fetch history views to show new commit
    await commands.executeCommand("svn.repolog.fetch");
    await commands.executeCommand("svn.itemlog.refresh");
    return result;
  }

  public clearLogCache(): void {
    this.repository.clearLogCache();
  }

  public async revert(files: string[], depth: keyof typeof SvnDepth = "empty") {
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

  public async logWithFilter(
    filter: IHistoryFilter,
    limit: number,
    target?: string | Uri
  ) {
    return this.run(Operation.Log, () =>
      this.repository.logWithFilter(filter, limit, target)
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
    // Schedule status refresh on save to update Changes view
    // Uses same debounce path as file watcher for consistency
    // The 500ms debounce handles rapid saves, then status() runs
    this.eventuallyUpdateWhenIdleAndWait();

    // Handle conflict auto-resolution
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

      // Determine forceRefresh BEFORE operation to set grace period early
      const forceRefresh =
        operation === Operation.Commit ||
        operation === Operation.Revert ||
        operation === Operation.Add ||
        operation === Operation.Remove ||
        operation === Operation.Update ||
        operation === Operation.Resolve ||
        operation === Operation.AddChangelist ||
        operation === Operation.RemoveChangelist ||
        operation === Operation.Lock ||
        operation === Operation.Unlock;

      // Set grace period BEFORE operation runs to block file watcher events
      // that fire during .svn directory changes from lock/unlock/commit/etc.
      if (forceRefresh) {
        this.lastForceRefresh = Date.now();
      }

      try {
        const result = await this.retryRun(runOperation);

        const checkRemote = operation === Operation.StatusRemote;

        // Always fetch lock status to show K/O/B/T badges in explorer
        const fetchLockStatus = true;

        if (!isReadOnly(operation)) {
          await this.updateModelState(
            checkRemote,
            forceRefresh,
            fetchLockStatus
          );
        }

        return result;
      } catch (err) {
        // Lock/Unlock: refresh status even on error (e.g., "already locked")
        // to show correct lock state regardless of command success
        if (operation === Operation.Lock || operation === Operation.Unlock) {
          try {
            await this.updateModelState(false, true, true);
          } catch {
            // Ignore status errors during error handling
          }
        }

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
   * Refresh the batch cache of files with svn:needs-lock property.
   * Called during status updates to populate cache efficiently.
   */
  public async refreshNeedsLockCache(): Promise<void> {
    try {
      this.needsLockFilesSet = await this.repository.getAllNeedsLockFiles();
      this.needsLockCacheExpiry = Date.now() + Repository.NEEDS_LOCK_CACHE_TTL;
    } catch {
      // Keep existing cache on error
    }
  }

  /**
   * Invalidate the needs-lock cache so it will be refreshed on next status.
   * Called after propset/propdel svn:needs-lock.
   */
  public invalidateNeedsLockCache(): void {
    this.needsLockCacheExpiry = 0;
  }

  /**
   * Refresh Explorer file decorations for specific URIs.
   * Pass undefined to refresh all decorations.
   */
  public refreshExplorerDecorations(uris?: Uri | Uri[]): void {
    this.fileDecorationProvider?.refresh(uris);
  }

  /**
   * Check if file has svn:needs-lock property (sync, uses batch cache).
   * Returns true if file is in the cached set. Fast for decorations.
   */
  public hasNeedsLockCached(filePath: string): boolean {
    // Convert absolute path to relative
    let relativePath = filePath;
    if (filePath.startsWith(this.workspaceRoot)) {
      relativePath = filePath.substring(this.workspaceRoot.length);
      // Remove leading separator
      if (relativePath.startsWith("/") || relativePath.startsWith("\\")) {
        relativePath = relativePath.substring(1);
      }
    }
    return this.needsLockFilesSet.has(relativePath);
  }

  /**
   * Check if file has svn:needs-lock property (async, accurate).
   * Uses cache if valid, otherwise queries SVN directly.
   */
  public async hasNeedsLock(filePath: string): Promise<boolean> {
    // If cache is valid, use it
    if (Date.now() < this.needsLockCacheExpiry) {
      return this.hasNeedsLockCached(filePath);
    }

    // Cache expired - do single file check (for prompt on open)
    try {
      return await this.repository.hasNeedsLock(filePath);
    } catch {
      return false;
    }
  }

  /**
   * Update lock status cache with info from --show-updates status call.
   * Called when fetchLockStatus=true in updateModelState.
   */
  public updateLockCache(
    relativePath: string,
    lockStatus: LockStatus,
    lockOwner?: string,
    hasLockToken: boolean = false
  ): void {
    this.lockStatusCache.set(relativePath, {
      lockStatus,
      lockOwner,
      hasLockToken
    });
  }

  /**
   * Get cached lock status for a file (by relative path).
   * Returns undefined if not in cache.
   */
  public getCachedLockStatus(
    relativePath: string
  ):
    | { lockStatus: LockStatus; lockOwner?: string; hasLockToken: boolean }
    | undefined {
    return this.lockStatusCache.get(relativePath);
  }

  /**
   * Get cached lock status for a file (by absolute path).
   * Sync method for use in decorators. Returns undefined if not in cache.
   */
  public getLockStatusCached(
    filePath: string
  ):
    | { lockStatus: LockStatus; lockOwner?: string; hasLockToken: boolean }
    | undefined {
    // Convert absolute path to relative
    let relativePath = filePath;
    if (filePath.startsWith(this.workspaceRoot)) {
      relativePath = filePath.substring(this.workspaceRoot.length);
      // Remove leading separator
      if (relativePath.startsWith("/") || relativePath.startsWith("\\")) {
        relativePath = relativePath.substring(1);
      }
    }
    return this.lockStatusCache.get(relativePath);
  }

  /**
   * Clear lock cache for a specific file (after unlock).
   */
  public clearLockCacheEntry(relativePath: string): void {
    this.lockStatusCache.delete(relativePath);
  }

  /**
   * Set svn:needs-lock property on file (makes read-only until locked).
   */
  public async setNeedsLock(filePath: string) {
    const result = await this.run(Operation.PropertyChange, () =>
      this.repository.setNeedsLock(filePath)
    );
    // Update cache directly for immediate L badge update
    if (result.exitCode === 0) {
      const relativePath = this.toRelativePath(filePath);
      this.needsLockFilesSet.add(relativePath);
      // Fire decoration refresh for this file
      this.fileDecorationProvider?.refresh(Uri.file(filePath));
    }
    return result;
  }

  /**
   * Remove svn:needs-lock property from file.
   */
  public async removeNeedsLock(filePath: string) {
    const result = await this.run(Operation.PropertyChange, () =>
      this.repository.removeNeedsLock(filePath)
    );
    // Update cache directly for immediate L badge removal
    if (result.exitCode === 0) {
      const relativePath = this.toRelativePath(filePath);
      this.needsLockFilesSet.delete(relativePath);
      // Fire decoration refresh for this file
      this.fileDecorationProvider?.refresh(Uri.file(filePath));
    }
    return result;
  }

  /**
   * Convert absolute path to relative path.
   */
  private toRelativePath(filePath: string): string {
    let relativePath = filePath;
    if (filePath.startsWith(this.workspaceRoot)) {
      relativePath = filePath.substring(this.workspaceRoot.length);
      if (relativePath.startsWith("/") || relativePath.startsWith("\\")) {
        relativePath = relativePath.substring(1);
      }
    }
    return relativePath;
  }

  /**
   * Check if file needs lock and prompt user to lock it.
   * Called when opening a file that might need locking.
   */
  public async promptLockIfNeeded(uri: Uri): Promise<void> {
    // Only check files in this repository's working copy
    if (!uri.fsPath.startsWith(this.workspaceRoot)) {
      return;
    }

    // Check if file already has a lock (any lock status means it's locked)
    const resource = this.getResourceFromFile(uri.fsPath);
    if (resource?.lockStatus || resource?.locked) {
      return; // Already locked
    }

    // Check if file has needs-lock property
    const needsLock = await this.hasNeedsLock(uri.fsPath);
    if (!needsLock) {
      return;
    }

    // File has needs-lock but isn't locked - prompt user
    const choice = await window.showInformationMessage(
      "This file requires a lock before editing. Lock it now?",
      "Lock File",
      "Not Now"
    );

    if (choice === "Lock File") {
      await commands.executeCommand("svn.lock", uri);
    }
  }

  public dispose(): void {
    // Clear auth cooldown timer to prevent memory leak
    if (this.promptAuthCooldownTimer) {
      clearTimeout(this.promptAuthCooldownTimer);
      this.promptAuthCooldownTimer = undefined;
    }
    // Clear grace period refresh timer
    if (this.pendingGraceRefresh) {
      clearTimeout(this.pendingGraceRefresh);
      this.pendingGraceRefresh = undefined;
    }
    // Stop remote change polling to prevent timer leak
    this.remoteChangeService.dispose();
    this.statusService.dispose();
    this.repository.clearInfoCacheTimers(); // Phase 8.2 perf fix - clear timers
    this.disposables = dispose(this.disposables);
  }
}
