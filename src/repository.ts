import * as path from "path";
import {
  commands,
  Disposable,
  Event,
  EventEmitter,
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
import { StatusService } from "./services/StatusService";
import { ResourceGroupManager } from "./services/ResourceGroupManager";
import { RemoteChangeService } from "./services/RemoteChangeService";
import {
  IAuth,
  IFileStatus,
  IOperations,
  ISvnErrorData,
  ISvnInfo,
  ISvnResourceGroup,
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
      this.onRunOperation as Event<any>,
      this.onDidRunOperation as Event<any>
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

    this.sourceControl.count = 0;
    this.sourceControl.inputBox.placeholder =
      "Message (press Ctrl+Enter to commit)";
    this.sourceControl.acceptInputCommand = {
      command: "svn.commitWithMessage",
      title: "commit",
      arguments: [this.sourceControl]
    };
    this.sourceControl.quickDiffProvider = this;
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

    const rules = config.ignoredRulesForDeletedFiles.map(ignored => match(ignored));

    if (rules.length) {
      uris = uris.filter(uri => {
        // Check first for relative URL (Better for workspace configuration)
        const relativePath = this.repository.removeAbsolutePath(uri.fsPath);

        // If some match, remove from list
        return !rules.some(
          rule => rule.match(relativePath) || rule.match(uri.fsPath)
        );
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

  @throttle
  @globalSequentialize("updateModelState")
  public async updateModelState(checkRemoteChanges: boolean = false) {
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
    if (checkRemoteChanges && result.remoteChanges.length !== this.remoteChangedFiles) {
      this.remoteChangedFiles = result.remoteChanges.length;
      this._onDidChangeRemoteChangedFiles.fire();
    }

    this._onDidChangeStatus.fire();

    this.currentBranch = await this.getCurrentBranch();

    return Promise.resolve();
  }

  public getResourceFromFile(uri: string | Uri): Resource | undefined {
    return this.groupManager.getResourceFromFile(uri);
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
      this.updateRemoteChangedFiles();
    });
  }

  public async switchBranch(name: string, force: boolean = false) {
    await this.run(Operation.SwitchBranch, async () => {
      await this.repository.switchBranch(name, force);
      this.updateRemoteChangedFiles();
    });
  }

  public async merge(
    name: string,
    reintegrate: boolean = false,
    accept_action: string = "postpone"
  ) {
    await this.run(Operation.Merge, async () => {
      await this.repository.merge(name, reintegrate, accept_action);
      this.updateRemoteChangedFiles();
    });
  }

  public async updateRevision(
    ignoreExternals: boolean = false
  ): Promise<string> {
    return this.run<string>(Operation.Update, async () => {
      const response = await this.repository.update(ignoreExternals);
      this.updateRemoteChangedFiles();
      return response;
    });
  }

  public async pullIncomingChange(path: string) {
    return this.run<string>(Operation.Update, async () => {
      const response = await this.repository.pullIncomingChange(path);
      this.updateRemoteChangedFiles();
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

  public async getInfo(path: string, revision?: string): Promise<ISvnInfo> {
    return this.run(Operation.Info, () =>
      this.repository.getInfo(path, revision, true)
    );
  }

  public async getChanges(): Promise<ISvnPathChange[]> {
    return this.run(Operation.Changes, () => this.repository.getChanges());
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
      return this.repository.ls(filePath);
    });
  }

  public getPathNormalizer(): PathNormalizer {
    return new PathNormalizer(this.repository.info);
  }

  protected getCredentialServiceName() {
    let key = "vscode.positron-svn";

    const info = this.repository.info;

    if (info.repository?.root) {
      key += ":" + info.repository.root;
    } else if (info.url) {
      key += ":" + info.url;
    }

    return key;
  }

  public async loadStoredAuths(): Promise<Array<IStoredAuth>> {
    // Prevent multiple prompts for auth
    if (this.lastPromptAuth) {
      await this.lastPromptAuth;
    }

    const secret = await this.secrets.get(this.getCredentialServiceName());

    if (secret === undefined) {
      return [];
    }

    const credentials = JSON.parse(secret) as Array<IStoredAuth>;

    return credentials;
  }

  public async saveAuth(): Promise<void> {
    if (this.canSaveAuth && this.username && this.password) {
      const secret = await this.secrets.get(this.getCredentialServiceName());
      let credentials: Array<IStoredAuth> = [];

      if (typeof secret === "string") {
        credentials = JSON.parse(secret) as Array<IStoredAuth>;
      }

      credentials.push({
        account: this.username,
        password: this.password
      });

      await this.secrets.store(
        this.getCredentialServiceName(),
        JSON.stringify(credentials)
      );

      this.canSaveAuth = false;
    }
  }

  public async promptAuth(): Promise<IAuth | undefined> {
    // Prevent multiple prompts for auth
    if (this.lastPromptAuth) {
      return this.lastPromptAuth;
    }

    this.lastPromptAuth = commands.executeCommand("svn.promptAuth");
    const result = await this.lastPromptAuth;

    if (result) {
      this.username = result.username;
      this.password = result.password;
      this.canSaveAuth = true;
    }

    this.lastPromptAuth = undefined;
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
    runOperation: () => Promise<T> = () => Promise.resolve<any>(null)
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
      ? window.withProgress({ location: ProgressLocation.SourceControl }, run)
      : run();
  }

  private async retryRun<T>(
    runOperation: () => Promise<T> = () => Promise.resolve<any>(null)
  ): Promise<T> {
    let attempt = 0;
    // Phase 8.2 perf fix - pre-load accounts before retry loop to avoid blocking
    const accounts: IStoredAuth[] = await this.loadStoredAuths();

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
          // quatratic backoff
          await timeout(Math.pow(attempt, 2) * 50);
        } else if (
          svnError.svnErrorCode === svnErrorCodes.AuthorizationFailed &&
          attempt <= 1 + accounts.length
        ) {

          // each attempt, try a different account
          const index = accounts.length - 1;
          if (typeof accounts[index] !== "undefined") {
            this.username = accounts[index].account;
            this.password = accounts[index].password;
          }
        } else if (
          svnError.svnErrorCode === svnErrorCodes.AuthorizationFailed &&
          attempt <= 3 + accounts.length
        ) {
          const result = await this.promptAuth();
          if (!result) {
            throw err;
          }
        } else {
          throw err;
        }
      }
    }
  }

  public dispose(): void {
    this.statusService.dispose();
    this.repository.clearInfoCacheTimers(); // Phase 8.2 perf fix - clear timers
    this.disposables = dispose(this.disposables);
  }
}
