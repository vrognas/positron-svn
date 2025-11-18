import * as path from "path";
import {
  commands,
  Disposable,
  Event,
  EventEmitter,
  ThemeIcon,
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,
  TreeView,
  Uri,
  window,
  workspace
} from "vscode";
import {
  RepositoryChangeEvent,
  ISvnLogEntry,
  ISvnLogEntryPath
} from "../common/types";
import { exists } from "../fs";
import { SourceControlManager } from "../source_control_manager";
import { IRemoteRepository } from "../remoteRepository";
import { Repository } from "../repository";
import { dispose, unwrap } from "../util";
import {
  checkIfFile,
  copyCommitToClipboard,
  fetchMore,
  getCommitIcon,
  getCommitLabel,
  getCommitToolTip,
  getIconObject,
  getLimit,
  ICachedLog,
  ILogTreeItem,
  insertBaseMarker,
  LogTreeItemKind,
  openDiff,
  openFileRemote,
  SvnPath,
  transform,
  getCommitDescription
} from "./common";
import { revealFileInOS, diffWithExternalTool } from "../util/fileOperations";
import { logError } from "../util/errorLogger";

function getActionIcon(action: string) {
  let name: string | undefined;
  switch (action) {
    case "A":
      name = "status-added";
      break;
    case "D":
      name = "status-deleted";
      break;
    case "M":
      name = "status-modified";
      break;
    case "R":
      name = "status-renamed";
      break;
  }
  if (name === undefined) {
    return undefined;
  }
  return getIconObject(name);
}

export class RepoLogProvider
  implements TreeDataProvider<ILogTreeItem>, Disposable
{
  private _onDidChangeTreeData: EventEmitter<ILogTreeItem | undefined> =
    new EventEmitter<ILogTreeItem | undefined>();
  public readonly onDidChangeTreeData: Event<ILogTreeItem | undefined> =
    this._onDidChangeTreeData.event;
  // TODO on-disk cache?
  private readonly logCache: Map<string, ICachedLog> = new Map();
  private _dispose: Disposable[] = [];

  // Performance optimization: visibility tracking and debouncing
  private treeView?: TreeView<ILogTreeItem>;
  private refreshTimeout?: NodeJS.Timeout;
  private readonly DEBOUNCE_MS = 2000;

  private getCached(maybeItem?: ILogTreeItem): ICachedLog {
    // With flat structure, commits are at root level
    // Walk up to find root, then return first cache entry
    if (!maybeItem) {
      // Return first repo in cache (should only be one workspace repo)
      const first = this.logCache.values().next().value;
      return unwrap(first);
    }

    const item = unwrap(maybeItem);
    if (item.data instanceof SvnPath) {
      return unwrap(this.logCache.get(item.data.toString()));
    }

    // For commits at root level, return first cache entry
    if (!item.parent) {
      const first = this.logCache.values().next().value;
      return unwrap(first);
    }

    return this.getCached(item.parent);
  }

  constructor(private sourceControlManager: SourceControlManager) {
    this.refresh();

    // Create TreeView for visibility tracking
    this.treeView = window.createTreeView("repolog", {
      treeDataProvider: this
    });

    this._dispose.push(
      this.treeView,
      commands.registerCommand(
        "svn.repolog.copymsg",
        async (item: ILogTreeItem) => copyCommitToClipboard("msg", item)
      ),
      commands.registerCommand(
        "svn.repolog.copyrevision",
        async (item: ILogTreeItem) => copyCommitToClipboard("revision", item)
      ),
      commands.registerCommand(
        "svn.repolog.addrepolike",
        this.addRepolikeGui,
        this
      ),
      commands.registerCommand("svn.repolog.remove", this.removeRepo, this),
      commands.registerCommand(
        "svn.repolog.openFileRemote",
        this.openFileRemoteCmd,
        this
      ),
      commands.registerCommand("svn.repolog.openDiff", this.openDiffCmd, this),
      commands.registerCommand(
        "svn.repolog.openFileLocal",
        this.openFileLocal,
        this
      ),
      commands.registerCommand("svn.repolog.refresh", this.explicitRefreshCmd, this),
      commands.registerCommand("svn.repolog.revealInExplorer", this.revealInExplorerCmd, this),
      commands.registerCommand("svn.repolog.diffWithExternalTool", this.diffWithExternalToolCmd, this),
      this.sourceControlManager.onDidChangeRepository(
        async (_e: RepositoryChangeEvent) => {
          // Performance: Skip refresh when view is hidden
          if (!this.treeView?.visible) {
            return;
          }

          // Performance: Debounce rapid events (2 second window)
          if (this.refreshTimeout) {
            clearTimeout(this.refreshTimeout);
          }

          this.refreshTimeout = setTimeout(() => {
            this.refresh();
          }, this.DEBOUNCE_MS);
        }
      )
    );
  }

  public dispose() {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }
    dispose(this._dispose);
  }

  public removeRepo(element: ILogTreeItem) {
    this.logCache.delete((element.data as SvnPath).toString());
    this.refresh();
  }

  private async addRepolike(repoLike: string, rev: string) {
    // TODO save user's custom repositories
    const item: ICachedLog = {
      entries: [],
      isComplete: false,
      svnTarget: {} as Uri, // later
      repo: {} as IRemoteRepository, // later
      persisted: {
        commitFrom: rev,
        userAdded: true
      },
      order: this.logCache.size
    };
    if (this.logCache.has(repoLike)) {
      window.showWarningMessage("This path is already added");
      return;
    }
    const repo = this.sourceControlManager.getRepository(repoLike);
    if (repo === null) {
      try {
        let uri: Uri;
        if (repoLike.startsWith("^")) {
          const wsrepo = this.sourceControlManager.getRepository(
            unwrap(workspace.workspaceFolders)[0].uri
          );
          if (!wsrepo) {
            throw new Error("No repository in workspace root");
          }
          const info = await wsrepo.getInfo(repoLike);
          uri = Uri.parse(info.url);
        } else {
          uri = Uri.parse(repoLike);
        }
        if (rev !== "HEAD" && isNaN(parseInt(rev, 10))) {
          throw new Error("erroneous revision");
        }
        const remRepo = await this.sourceControlManager.getRemoteRepository(
          uri
        );
        item.repo = remRepo;
        item.svnTarget = uri;
      } catch (e) {
        window.showWarningMessage(
          "Failed to add repo: " + (e instanceof Error ? e.message : "")
        );
        return;
      }
    } else {
      try {
        const svninfo = await repo.getInfo(repoLike, rev);
        item.repo = repo;
        item.svnTarget = Uri.parse(svninfo.url);
        item.persisted.baseRevision = parseInt(svninfo.revision, 10);
      } catch (e) {
        window.showErrorMessage("Failed to resolve svn path");
        return;
      }
    }

    const repoName = item.svnTarget.toString(true);
    if (this.logCache.has(repoName)) {
      window.showWarningMessage("Repository with this name already exists");
      return;
    }
    this.logCache.set(repoName, item);
    this._onDidChangeTreeData.fire(undefined);
  }

  public addRepolikeGui() {
    const box = window.createInputBox();
    box.prompt = "Enter SVN URL or local path";
    box.onDidAccept(async () => {
      let repoLike = box.value;
      if (
        !path.isAbsolute(repoLike) &&
        workspace.workspaceFolders &&
        !repoLike.startsWith("^") &&
        !/^[a-z]+?:\/\//.test(repoLike)
      ) {
        for (const wsf of workspace.workspaceFolders) {
          const joined = path.join(wsf.uri.fsPath, repoLike);
          if (await exists(joined)) {
            repoLike = joined;
            break;
          }
        }
      }
      box.dispose();
      const box2 = window.createInputBox();
      box2.prompt = "Enter starting revision (optional)";
      box2.onDidAccept(async () => {
        const rev = box2.value;
        box2.dispose();
        return this.addRepolike(repoLike, rev || "HEAD");
      }, undefined);
      box2.show();
    });
    box.show();
  }

  public async openFileRemoteCmd(element: ILogTreeItem) {
    const commit = element.data as ISvnLogEntryPath;
    const item = this.getCached(element);
    const ri = item.repo.getPathNormalizer().parse(commit._);
    if ((await checkIfFile(ri, false)) === false) {
      return;
    }
    const parent = (element.parent as ILogTreeItem).data as ISvnLogEntry;
    return openFileRemote(item.repo, ri.remoteFullPath, parent.revision);
  }

  public openFileLocal(element: ILogTreeItem) {
    const commit = element.data as ISvnLogEntryPath;
    const item = this.getCached(element);
    const ri = item.repo.getPathNormalizer().parse(commit._);
    if (!checkIfFile(ri, true)) {
      return;
    }
    commands.executeCommand("vscode.open", unwrap(ri.localFullPath));
  }

  public async openDiffCmd(element: ILogTreeItem) {
    const commit = element.data as ISvnLogEntryPath;
    const item = this.getCached(element);
    const parent = (element.parent as ILogTreeItem).data as ISvnLogEntry;
    const remotePath = item.repo
      .getPathNormalizer()
      .parse(commit._).remoteFullPath;
    let prevRev: ISvnLogEntry;

    const revs = await item.repo.log(parent.revision, "1", 2, remotePath);

    if (revs.length === 2) {
      prevRev = revs[1];
    } else {
      window.showWarningMessage("Cannot find previous commit");
      return;
    }

    return openDiff(item.repo, remotePath, prevRev.revision, parent.revision);
  }

  public async revealInExplorerCmd(element: ILogTreeItem) {
    if (element.kind !== LogTreeItemKind.CommitDetail) {
      return;
    }

    try {
      const commit = element.data as ISvnLogEntryPath;
      const item = this.getCached(element);
      const pathInfo = item.repo.getPathNormalizer().parse(commit._);

      // Use local path if available
      if (pathInfo.localFullPath) {
        await revealFileInOS(pathInfo.localFullPath);
      } else {
        window.showWarningMessage("File not available locally");
      }
    } catch (error) {
      logError("Failed to reveal file in explorer", error);
      window.showErrorMessage("Could not reveal file in explorer");
    }
  }

  public async diffWithExternalToolCmd(element: ILogTreeItem) {
    if (element.kind !== LogTreeItemKind.CommitDetail) {
      return;
    }

    try {
      const commit = element.data as ISvnLogEntryPath;
      const item = this.getCached(element);
      const parent = (element.parent as ILogTreeItem).data as ISvnLogEntry;
      const remotePath = item.repo
        .getPathNormalizer()
        .parse(commit._).remoteFullPath;

      // Single query - reuse result
      const revs = await item.repo.log(parent.revision, "1", 2, remotePath);

      if (revs.length < 2) {
        const message = commit.action === "A"
          ? "This is the first revision of this file - no previous version to diff"
          : "Cannot find previous commit for diff";
        window.showWarningMessage(message);
        return;
      }

      const prevRev = revs[1];

      // Diff between previous and current revision
      // Use workspaceRoot if available (Repository), otherwise empty string (RemoteRepository)
      // Empty string is handled by svn.exec - uses current process working directory
      const workspaceRoot = item.repo instanceof Repository
        ? item.repo.workspaceRoot
        : "";

      const scm = this.sourceControlManager;
      await diffWithExternalTool(
        workspaceRoot,
        remotePath.toString(),
        scm.svn.exec.bind(scm.svn),
        prevRev.revision,
        parent.revision
      );
    } catch (error) {
      logError("Failed to open external diff", error);
      window.showErrorMessage("Could not open external diff tool");
    }
  }

  // Wrapper for explicit user refresh (clears cache)
  public async explicitRefreshCmd(element?: ILogTreeItem, fetchMoreClick?: boolean) {
    return this.refresh(element, fetchMoreClick, true);
  }

  public async refresh(element?: ILogTreeItem, fetchMoreClick?: boolean, explicitRefresh?: boolean) {
    if (fetchMoreClick) {
      // Fetch more commits for current repo
      const cached = this.getCached(element);
      await fetchMore(cached);
    } else if (element === undefined) {
      // Determine if we should clear or preserve cache
      const shouldClearCache = explicitRefresh === true;

      // Save entries before modifying cache (if preserving)
      const savedEntries = new Map<string, ISvnLogEntry[]>();
      if (!shouldClearCache) {
        for (const [k, v] of this.logCache) {
          savedEntries.set(k, v.entries);
        }
      }

      // Remove auto-added repositories
      for (const [k, v] of this.logCache) {
        if (!v.persisted.userAdded) {
          this.logCache.delete(k);
        }
      }

      // Rebuild cache with preserved or empty entries
      for (const repo of this.sourceControlManager.repositories) {
        const remoteRoot = repo.branchRoot;
        const repoUrl = remoteRoot.toString(true);
        let persisted: ICachedLog["persisted"] = {
          commitFrom: "HEAD",
          baseRevision: parseInt(repo.repository.info.revision, 10)
        };
        const prev = this.logCache.get(repoUrl);
        if (prev) {
          persisted = prev.persisted;
        }
        const entries = shouldClearCache ? [] : (savedEntries.get(repoUrl) || []);
        this.logCache.set(repoUrl, {
          entries,
          isComplete: false,
          repo,
          svnTarget: remoteRoot,
          persisted,
          order: this.logCache.size
        });
      }
    }
    this._onDidChangeTreeData.fire(element);
  }

  public async getTreeItem(element: ILogTreeItem): Promise<TreeItem> {
    let ti: TreeItem;
    if (element.kind === LogTreeItemKind.Commit) {
      const commit = element.data as ISvnLogEntry;
      ti = new TreeItem(
        getCommitLabel(commit),
        TreeItemCollapsibleState.Collapsed
      );
      ti.description = getCommitDescription(commit);
      ti.tooltip = getCommitToolTip(commit);
      ti.iconPath = getCommitIcon(commit.author);
      ti.contextValue = "commit";
    } else if (element.kind === LogTreeItemKind.CommitDetail) {
      // TODO optional tree-view instead of flat
      const pathElem = element.data as ISvnLogEntryPath;
      const basename = path.basename(pathElem._);
      const dirname = path.dirname(pathElem._);
      const cached = this.getCached(element);
      const nm = cached.repo.getPathNormalizer();
      const parsedPath = nm.parse(pathElem._);

      ti = new TreeItem(basename, TreeItemCollapsibleState.None);

      // Show directory path (decoration badge added automatically by FileDecorationProvider)
      ti.description = dirname;
      ti.tooltip = parsedPath.relativeFromBranch;

      // Use resourceUri to show file type icon and trigger file decorations
      // Add action as query param so FileDecorationProvider can decorate historical files
      if (parsedPath.localFullPath) {
        ti.resourceUri = parsedPath.localFullPath.with({
          query: `action=${pathElem.action}`
        });
      }

      ti.contextValue = "diffable";
      ti.command = {
        command: "svn.repolog.openDiff",
        title: "Open diff",
        arguments: [element]
      };
    } else if (element.kind === LogTreeItemKind.TItem) {
      ti = element.data as TreeItem;
    } else {
      throw new Error("Unknown tree elem");
    }

    return ti;
  }

  public async getChildren(
    element: ILogTreeItem | undefined
  ): Promise<ILogTreeItem[]> {
    if (element === undefined) {
      // Show commits directly at root level (skip repo folder)
      const limit = getLimit();
      const cached = this.getCached();
      const logentries = cached.entries;

      if (logentries.length === 0) {
        await fetchMore(cached);
      }
      const result = transform(logentries, LogTreeItemKind.Commit, undefined);
      insertBaseMarker(cached, logentries, result);
      if (!cached.isComplete) {
        const ti = new TreeItem(`Load another ${limit} revisions`);
        ti.tooltip = "Paging size may be adjusted using log.length setting";
        ti.command = {
          command: "svn.repolog.refresh",
          arguments: [undefined, true],
          title: "refresh element"
        };
        ti.iconPath = new ThemeIcon("unfold");
        result.push({ kind: LogTreeItemKind.TItem, data: ti });
      }
      return result;
    } else if (element.kind === LogTreeItemKind.Commit) {
      const commit = element.data as ISvnLogEntry;
      return transform(commit.paths, LogTreeItemKind.CommitDetail, element);
    }
    return [];
  }
}
