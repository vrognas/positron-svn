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
import {
  IAuth,
  IFileStatus,
  IOperations,
  ISvnErrorData,
  ISvnInfo,
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
import { RemoteChangeService } from "./services/RemoteChangeService";
import { ResourceGroupManager } from "./services/ResourceGroupManager";
import { StatusService, IStatusEvents, IStatusRepository } from "./services/StatusService";
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

export class Repository implements IRemoteRepository {
  public sourceControl: SourceControl;
  public statusBar: StatusBarCommands;
  private resourceGroupManager!: ResourceGroupManager;
  private statusService!: StatusService;
  public statusIgnored: IFileStatus[] = [];
  public statusExternal: IFileStatus[] = [];
  private disposables: Disposable[] = [];
  public currentBranch = "";
  public remoteChangedFiles: number = 0;
  public isIncomplete: boolean = false;
  public needCleanUp: boolean = false;
  private deletedUris: Uri[] = [];
  private canSaveAuth: boolean = false;
  private remoteChangeService!: RemoteChangeService;

  // Getters for backward compatibility
  get changes() { return this.resourceGroupManager.changes; }
  get unversioned() { return this.resourceGroupManager.unversioned; }
  get conflicts() { return this.resourceGroupManager.conflicts; }
  get remoteChanges() { return this.resourceGroupManager.remoteChanges; }
  get changelists() { return this.resourceGroupManager.changelists; }

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

    this.resourceGroupManager.clearAll();
    this.remoteChanges?.dispose();

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

  /**
   * Static factory method to create Repository instances asynchronously.
   * This replaces direct constructor calls to avoid async constructor anti-pattern.
   */
  public static async create(
    repository: BaseRepository,
    secrets: SecretStorage
  ): Promise<Repository> {
    const instance = new Repository(repository, secrets);

    // Execute async initialization
    await instance.updateRemoteChangedFiles();
    await instance.status();

    return instance;
  }

  private constructor(
    public repository: BaseRepository,
    private secrets: SecretStorage
  ) {
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
    this.resourceGroupManager = new ResourceGroupManager(
      this.sourceControl,
      this.disposables
    );

    // Initialize StatusService with focused interfaces
    const statusRepository: IStatusRepository = {
      root: this.repository.root,
      workspaceRoot: this.repository.workspaceRoot,
      getStatus: (options: any) => this.repository.getStatus(options),
      getRepositoryUuid: () => this.repository.getRepositoryUuid(),
      retryRun: <T,>(operation: () => Promise<T>) => this.retryRun(operation)
    };

    const statusEvents: IStatusEvents = {
      onDidChangeStatus: () => this._onDidChangeStatus.fire(),
      onDidChangeRemoteChangedFiles: () => this._onDidChangeRemoteChangedFiles.fire(),
      getCurrentBranch: async () => this.currentBranch
    };

    this.statusService = new StatusService(
      statusRepository,
      this.resourceGroupManager,
      statusEvents
    );

    // Initialize RemoteChangeService for polling
    this.remoteChangeService = new RemoteChangeService(
      this,
      <T,>(key: string, defaultValue: T) => configuration.get<T>(key, defaultValue),
      configuration.onDidChange
    );
    this.disposables.push(this.remoteChangeService);

    // For each deleted file, append to list
    this._fsWatcher.onDidWorkspaceDelete(
      uri => this.deletedUris.push(uri),
      this,
      this.disposables
    );

    // Only check deleted files after the status list is fully updated
    this.onDidChangeStatus(this.actionForDeletedFiles, this, this.disposables);

    this.disposables.push(
      workspace.onDidSaveTextDocument(document => {
        this.onDidSaveTextDocument(document);
      })
    );
  }

  @debounce(1000)
  private async onDidAnyFileChanged(e: Uri) {
    await this.repository.updateInfo();
    this._onDidChangeRepository.fire(e);
  }

  /**
   * Check all recently deleted files and compare with svn status "missing"
   */
  @debounce(1000)
  private async actionForDeletedFiles() {
    if (!this.deletedUris.length) {
      return;
    }

    const allUris = this.deletedUris;
    this.deletedUris = [];

    const actionForDeletedFiles = configuration.get<string>(
      "delete.actionForDeletedFiles",
      "prompt"
    );

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

    const ignoredRulesForDeletedFiles = configuration.get<string[]>(
      "delete.ignoredRulesForDeletedFiles",
      []
    );
    const rules = ignoredRulesForDeletedFiles.map(ignored => match(ignored));

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

  /**
   * Updates remote changed files by delegating to RemoteChangeService.
   * This method is kept for backward compatibility with existing call sites.
   */
  public async updateRemoteChangedFiles(): Promise<void> {
    return this.remoteChangeService.updateRemoteChangedFiles();
  }

  private onFSChange(_uri: Uri): void {
    const autorefresh = configuration.get<boolean>("autorefresh");

    if (!autorefresh) {
      return;
    }

    if (!this.operations.isIdle()) {
      return;
    }

    this.eventuallyUpdateWhenIdleAndWait();
  }

  @debounce(1000)
  private eventuallyUpdateWhenIdleAndWait(): void {
    this.updateWhenIdleAndWait();
  }

  @throttle
  private async updateWhenIdleAndWait(): Promise<void> {
    await this.whenIdleAndFocused();
    await this.status();
    await timeout(5000);
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
    // Delegate to StatusService
    const result = await this.statusService.updateModelState(
      this.statusExternal,
      this.statusIgnored,
      this.isIncomplete,
      this.needCleanUp,
      this.remoteChangedFiles,
      this.currentBranch,
      checkRemoteChanges
    );

    // Update Repository state with results
    this.statusExternal = result.statusExternal;
    this.statusIgnored = result.statusIgnored;
    this.isIncomplete = result.isIncomplete;
    this.needCleanUp = result.needCleanUp;
    this.remoteChangedFiles = result.remoteChangedFiles;
    this.currentBranch = result.currentBranch;

    return Promise.resolve();
  }

  public getResourceFromFile(uri: string | Uri): Resource | undefined {
    if (typeof uri === "string") {
      uri = Uri.file(uri);
    }

    const groups = [
      this.changes,
      this.conflicts,
      this.unversioned,
      ...this.changelists.values()
    ];

    const uriString = uri.toString();

    for (const group of groups) {
      for (const resource of group.resourceStates) {
        if (
          uriString === resource.resourceUri.toString() &&
          resource instanceof Resource
        ) {
          return resource;
        }
      }
    }

    return undefined;
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

  public async run<T>(
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
    let accounts: IStoredAuth[] = [];

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
          // First attempt load all stored auths
          if (attempt === 1) {
            accounts = await this.loadStoredAuths();
          }

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
    this.disposables = dispose(this.disposables);
  }
}
