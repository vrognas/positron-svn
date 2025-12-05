// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

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
  window
} from "vscode";
import {
  RepositoryChangeEvent,
  ISvnLogEntry,
  ISvnLogEntryPath
} from "../common/types";
import { SourceControlManager } from "../source_control_manager";
import { Repository } from "../repository";
import { dispose } from "../util";
import {
  checkIfFile,
  copyCommitToClipboard,
  fetchMore,
  getCommitIcon,
  getCommitLabel,
  getCommitToolTip,
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

// Reserved for future use - icon rendering in history view
/*
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
*/

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
  private static readonly MAX_LOG_CACHE_SIZE = 50;

  // Performance optimization: visibility tracking and debouncing
  private treeView?: TreeView<ILogTreeItem>;
  private refreshTimeout?: NodeJS.Timeout;
  private readonly DEBOUNCE_MS = 1000;

  private evictOldestLogEntry(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    for (const [key, entry] of this.logCache.entries()) {
      // Skip user-added repos from eviction
      if (entry.persisted.userAdded) {
        continue;
      }
      const accessTime = entry.lastAccessed ?? 0;
      if (accessTime < oldestTime) {
        oldestTime = accessTime;
        oldestKey = key;
      }
    }
    if (oldestKey !== null) {
      this.logCache.delete(oldestKey);
    }
  }

  private getCached(maybeItem?: ILogTreeItem): ICachedLog | undefined {
    // With flat structure, commits are at root level
    // Walk up to find root, then return first cache entry
    if (!maybeItem) {
      // Return first repo in cache (should only be one workspace repo)
      const first = this.logCache.values().next().value;
      if (first) {
        first.lastAccessed = Date.now();
      }
      return first;
    }

    if (maybeItem.data instanceof SvnPath) {
      const cached = this.logCache.get(maybeItem.data.toString());
      if (cached) {
        cached.lastAccessed = Date.now();
      }
      return cached;
    }

    // For commits at root level, return first cache entry
    if (!maybeItem.parent) {
      const first = this.logCache.values().next().value;
      if (first) {
        first.lastAccessed = Date.now();
      }
      return first;
    }

    return this.getCached(maybeItem.parent);
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
      commands.registerCommand(
        "svn.repolog.refresh",
        () => this._onDidChangeTreeData.fire(undefined),
        this
      ),
      commands.registerCommand("svn.repolog.goToBase", this.goToBase, this),
      commands.registerCommand(
        "svn.repolog.fetch",
        this.explicitRefreshCmd,
        this
      ),
      commands.registerCommand(
        "svn.repolog.revealInExplorer",
        this.revealInExplorerCmd,
        this
      ),
      commands.registerCommand(
        "svn.repolog.diffWithExternalTool",
        this.diffWithExternalToolCmd,
        this
      ),
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
      ),
      // Fix: Refresh when repositories are opened/closed (startup timing issue)
      // SourceControlManager discovers repos asynchronously after providers are created,
      // so we must listen for repo open/close events to update tree data
      this.sourceControlManager.onDidOpenRepository(() => {
        this.refresh();
      }),
      this.sourceControlManager.onDidCloseRepository(() => {
        this.refresh();
      })
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

  public async openFileRemoteCmd(element: ILogTreeItem) {
    const commit = element.data as ISvnLogEntryPath;
    const item = this.getCached(element);
    if (!item) {
      return;
    }
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
    if (!item) {
      return;
    }
    const ri = item.repo.getPathNormalizer().parse(commit._);
    if (!checkIfFile(ri, true)) {
      return;
    }
    if (ri.localFullPath) {
      commands.executeCommand("vscode.open", ri.localFullPath);
    }
  }

  public async openDiffCmd(element: ILogTreeItem) {
    const commit = element.data as ISvnLogEntryPath;
    const item = this.getCached(element);
    if (!item) {
      return;
    }
    const parent = (element.parent as ILogTreeItem).data as ISvnLogEntry;
    const remotePath = item.repo
      .getPathNormalizer()
      .parse(commit._).remoteFullPath;

    // Handle added files - no previous revision exists
    if (commit.action === "A") {
      return openDiff(item.repo, remotePath, undefined, parent.revision);
    }

    let prevRev: ISvnLogEntry;
    try {
      // Use peg revision to handle files renamed/moved/deleted after this revision
      // Fix: Pass peg revision separately to avoid double-@ escaping bug
      const revs = await item.repo.log(
        parent.revision,
        "1",
        2,
        remotePath,
        parent.revision
      );

      if (revs.length === 2) {
        prevRev = revs[1]!;
      } else {
        window.showWarningMessage("Cannot find previous commit");
        return;
      }
    } catch (error) {
      // File may not exist at the queried path (renamed, moved, etc.)
      window.showWarningMessage("Cannot find previous revision for this file");
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
      if (!item) {
        return;
      }
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
      if (!item) {
        return;
      }
      const parent = (element.parent as ILogTreeItem).data as ISvnLogEntry;
      const remotePath = item.repo
        .getPathNormalizer()
        .parse(commit._).remoteFullPath;

      // Handle added files - no previous revision exists
      if (commit.action === "A") {
        window.showWarningMessage(
          "This is the first revision of this file - no previous version to diff"
        );
        return;
      }

      // Use peg revision to handle files renamed/moved/deleted after this revision
      // Fix: Pass peg revision separately to avoid double-@ escaping bug
      const revs = await item.repo.log(
        parent.revision,
        "1",
        2,
        remotePath,
        parent.revision
      );

      if (revs.length < 2) {
        window.showWarningMessage("Cannot find previous commit for diff");
        return;
      }

      const prevRev = revs[1]!;

      // Diff between previous and current revision
      // Use workspaceRoot if available (Repository), otherwise empty string (RemoteRepository)
      // Empty string is handled by svn.exec - uses current process working directory
      const workspaceRoot =
        item.repo instanceof Repository ? item.repo.workspaceRoot : "";

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
  public async explicitRefreshCmd(
    element?: ILogTreeItem,
    fetchMoreClick?: boolean
  ) {
    return this.refresh(element, fetchMoreClick, true);
  }

  // Navigate to the BASE revision in the tree view
  public async goToBase() {
    if (!this.treeView) {
      return;
    }
    const cached = this.getCached();
    if (!cached) {
      return;
    }
    const baseRev = cached.persisted.baseRevision;
    if (!baseRev) {
      return;
    }
    // Find the BASE commit in the entries
    for (const entry of cached.entries) {
      if (parseInt(entry.revision, 10) === baseRev) {
        // Create the tree item to reveal
        const item: ILogTreeItem = {
          kind: LogTreeItemKind.Commit,
          data: entry,
          isBase: true
        };
        await this.treeView.reveal(item, {
          select: true,
          focus: true,
          expand: false
        });
        return;
      }
    }
  }

  public async refresh(
    element?: ILogTreeItem,
    fetchMoreClick?: boolean,
    explicitRefresh?: boolean
  ) {
    if (fetchMoreClick) {
      // Fetch more commits for current repo
      const cached = this.getCached(element);
      if (cached) {
        await fetchMore(cached);
      }
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
        const currentRevision = parseInt(repo.repository.info.revision, 10);
        const prev = this.logCache.get(repoUrl);

        // Detect if working copy revision changed (e.g., after svn update)
        // If so, cache is stale and should be cleared
        const revisionChanged =
          prev?.persisted.baseRevision !== undefined &&
          prev.persisted.baseRevision !== currentRevision;

        let persisted: ICachedLog["persisted"] = {
          commitFrom: "HEAD",
          baseRevision: currentRevision
        };
        if (prev && !revisionChanged) {
          persisted = prev.persisted;
        }

        // Clear entries if explicit refresh OR revision changed
        const clearEntries = shouldClearCache || revisionChanged;
        const entries = clearEntries ? [] : savedEntries.get(repoUrl) || [];
        // Preserve isComplete if we're keeping entries
        const isComplete = clearEntries ? false : (prev?.isComplete ?? false);

        // LRU eviction before adding (if not updating existing)
        if (
          !this.logCache.has(repoUrl) &&
          this.logCache.size >= RepoLogProvider.MAX_LOG_CACHE_SIZE
        ) {
          this.evictOldestLogEntry();
        }
        const newCached: ICachedLog = {
          entries,
          isComplete,
          repo,
          svnTarget: remoteRoot,
          persisted,
          order: this.logCache.size,
          lastAccessed: Date.now()
        };
        this.logCache.set(repoUrl, newCached);

        // If cache was cleared, fetch new commits immediately
        // Don't rely on getChildren - VS Code may not call it if tree is hidden
        if (clearEntries) {
          await fetchMore(newCached);
        }
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
      ti.tooltip = element.isBase
        ? `${getCommitToolTip(commit)}\n\n📍 This is your working copy's BASE revision`
        : getCommitToolTip(commit);
      ti.iconPath = getCommitIcon(commit.author);
      ti.contextValue = "commit";
      // Use resourceUri to trigger FileDecorationProvider for BASE badge
      if (element.isBase) {
        ti.resourceUri = Uri.parse(
          `svn-commit:r${commit.revision}?isBase=true`
        );
      }
    } else if (element.kind === LogTreeItemKind.CommitDetail) {
      // TODO optional tree-view instead of flat
      const pathElem = element.data as ISvnLogEntryPath;
      const basename = path.basename(pathElem._);
      const dirname = path.dirname(pathElem._);
      const cached = this.getCached(element);
      if (!cached) {
        // Cache expired or element orphaned - return placeholder
        ti = new TreeItem(basename, TreeItemCollapsibleState.None);
        ti.description = dirname;
        return ti;
      }
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

  // Required for TreeView.reveal() to work
  public getParent(element: ILogTreeItem): ILogTreeItem | undefined {
    return element.parent;
  }

  public async getChildren(
    element: ILogTreeItem | undefined
  ): Promise<ILogTreeItem[]> {
    if (element === undefined) {
      // Show commits directly at root level (skip repo folder)
      const cached = this.getCached();
      // Return empty array if no repositories in cache yet
      if (!cached) {
        return [];
      }

      const limit = getLimit();
      const logentries = cached.entries;

      if (logentries.length === 0) {
        await fetchMore(cached);
      }
      const result = transform(logentries, LogTreeItemKind.Commit, undefined);
      insertBaseMarker(cached, logentries, result);

      // Check if we've reached r1 (no more revisions possible)
      const lastEntry = logentries[logentries.length - 1];
      const atFirstRevision =
        lastEntry && parseInt(lastEntry.revision, 10) <= 1;
      if (atFirstRevision) {
        cached.isComplete = true;
      }

      if (!cached.isComplete) {
        const ti = new TreeItem(`Load another ${limit} revisions`);
        ti.tooltip = "Paging size may be adjusted using log.length setting";
        ti.command = {
          command: "svn.repolog.fetch",
          arguments: [undefined, true],
          title: "fetch more"
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
