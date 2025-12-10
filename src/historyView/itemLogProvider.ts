// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import * as path from "path";
import {
  commands,
  Disposable,
  Event,
  EventEmitter,
  TextEditor,
  ThemeIcon,
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,
  Uri,
  window
} from "vscode";
import { ISvnLogEntry } from "../common/types";
import { confirmRollback } from "../input/rollback";
import { SourceControlManager } from "../source_control_manager";
import { dispose } from "../util";
import {
  copyCommitToClipboard,
  fetchMore,
  getCommitIcon,
  getCommitLabel,
  getCommitToolTip,
  getLimit,
  hasContentChanges,
  ICachedLog,
  ILogTreeItem,
  insertBaseMarker,
  LogTreeItemKind,
  openDiff,
  openFileRemote,
  openPatch,
  transform,
  getCommitDescription
} from "./common";

export class ItemLogProvider
  implements TreeDataProvider<ILogTreeItem>, Disposable
{
  private _onDidChangeTreeData: EventEmitter<ILogTreeItem | undefined> =
    new EventEmitter<ILogTreeItem | undefined>();
  public readonly onDidChangeTreeData: Event<ILogTreeItem | undefined> =
    this._onDidChangeTreeData.event;

  private currentItem?: ICachedLog;
  private _dispose: Disposable[] = [];
  private isRollingBack = false;
  private refreshDebounceTimer?: ReturnType<typeof setTimeout>;

  constructor(private sourceControlManager: SourceControlManager) {
    this._dispose.push(
      window.onDidChangeActiveTextEditor(this.editorChanged, this),
      window.registerTreeDataProvider("itemlog", this),
      // Refresh when repositories open/close (handles startup timing)
      sourceControlManager.onDidOpenRepository(() => this.refresh()),
      sourceControlManager.onDidCloseRepository(() => this.refresh()),
      commands.registerCommand(
        "svn.itemlog.copymsg",
        async (item: ILogTreeItem) => copyCommitToClipboard("msg", item)
      ),
      commands.registerCommand(
        "svn.itemlog.copyrevision",
        async (item: ILogTreeItem) => copyCommitToClipboard("revision", item)
      ),
      commands.registerCommand(
        "svn.itemlog.openFileRemote",
        this.openFileRemoteCmd,
        this
      ),
      commands.registerCommand("svn.itemlog.openDiff", this.openDiffCmd, this),
      commands.registerCommand(
        "svn.itemlog.openDiffBase",
        this.openDiffBaseCmd,
        this
      ),
      commands.registerCommand(
        "svn.itemlog.refresh",
        () => this.refresh(undefined, undefined, false, true),
        this
      ),
      commands.registerCommand(
        "svn.itemlog.gotoRepolog",
        this.gotoRepologCmd,
        this
      ),
      commands.registerCommand(
        "svn.itemlog.rollbackToRevision",
        this.rollbackToRevisionCmd,
        this
      )
    );
    this.refresh();
  }

  // Navigate to the same revision in repository history
  public async gotoRepologCmd(element: ILogTreeItem) {
    if (element.kind !== LogTreeItemKind.Commit) {
      return;
    }
    const commit = element.data as ISvnLogEntry;
    const revision = parseInt(commit.revision, 10);
    await commands.executeCommand("svn.repolog.goToRevision", revision);
  }

  // Rollback file to selected revision using reverse merge
  public async rollbackToRevisionCmd(element: ILogTreeItem) {
    if (!this.currentItem || !this.currentItem.localPath) {
      return;
    }
    if (element.kind !== LogTreeItemKind.Commit) {
      return;
    }

    const commit = element.data as ISvnLogEntry;
    const targetRevision = parseInt(commit.revision, 10);

    // Check if already at this revision (no-op)
    if (
      this.currentItem.persisted.baseRevision &&
      targetRevision === this.currentItem.persisted.baseRevision
    ) {
      window.showInformationMessage(
        `Already at revision ${commit.revision}. No rollback needed.`
      );
      return;
    }

    if (!(await confirmRollback(commit.revision))) {
      return;
    }

    this.isRollingBack = true;
    // Clear any pending refresh to prevent stale data flash
    if (this.refreshDebounceTimer) {
      clearTimeout(this.refreshDebounceTimer);
      this.refreshDebounceTimer = undefined;
    }
    try {
      const filePath = this.currentItem.localPath;
      const fileUri = Uri.file(filePath);

      // Get full Repository for grace period and cache refresh
      const repo = this.sourceControlManager.getRepository(fileUri);
      if (repo) {
        // Block file watcher status updates during SVN operations
        repo.setGracePeriod();
      }

      // Revert any local changes first to prevent merge conflicts
      await this.currentItem.repo.revert([filePath]);
      await this.currentItem.repo.rollbackToRevision(filePath, commit.revision);

      if (repo) {
        // Rebuild needs-lock cache from SVN for immediate L badge update
        await repo.refreshNeedsLockCache();
        // Refresh Explorer decorations (L badge, etc)
        repo.refreshExplorerDecorations([fileUri]);
      }

      window.showInformationMessage(
        `Rolled back to revision ${commit.revision}. Review changes and commit.`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      window.showErrorMessage(`Rollback failed: ${message}`);
    } finally {
      // Keep blocking refreshes briefly to let file change events settle.
      // Rollback doesn't change BASE revision, so no refresh is needed.
      setTimeout(() => {
        this.isRollingBack = false;
      }, 1000);
    }
  }

  public dispose() {
    if (this.refreshDebounceTimer) {
      clearTimeout(this.refreshDebounceTimer);
    }
    dispose(this._dispose);
  }

  public async openFileRemoteCmd(element: ILogTreeItem) {
    if (!this.currentItem) {
      return;
    }
    const commit = element.data as ISvnLogEntry;
    return openFileRemote(
      this.currentItem.repo,
      this.currentItem.svnTarget,
      commit.revision
    );
  }

  public async openDiffBaseCmd(element: ILogTreeItem) {
    if (!this.currentItem) {
      return;
    }
    const commit = element.data as ISvnLogEntry;
    return openDiff(
      this.currentItem.repo,
      this.currentItem.svnTarget,
      commit.revision,
      "BASE"
    );
  }

  public async openDiffCmd(element: ILogTreeItem) {
    if (!this.currentItem) {
      return;
    }
    const commit = element.data as ISvnLogEntry;
    const pos = this.currentItem.entries.findIndex(e => e === commit);
    if (pos === this.currentItem.entries.length - 1) {
      // First revision - no previous to diff against, show file content instead
      return openFileRemote(
        this.currentItem.repo,
        this.currentItem.svnTarget,
        commit.revision
      );
    }

    // Check if it's property-only change (no content changes)
    try {
      const patch = await this.currentItem.repo.patchRevision(
        commit.revision,
        this.currentItem.svnTarget
      );
      if (patch && !hasContentChanges(patch)) {
        // Property-only change - show patch instead of empty diff
        return openPatch(
          this.currentItem.repo,
          this.currentItem.svnTarget,
          commit.revision
        );
      }
    } catch {
      // Fall through to normal diff on error
    }

    const prevRev = this.currentItem.entries[pos + 1]!.revision;
    return openDiff(
      this.currentItem.repo,
      this.currentItem.svnTarget,
      prevRev,
      commit.revision
    );
  }

  public async editorChanged(te?: TextEditor) {
    // Skip refresh during rollback to prevent flashing
    if (this.isRollingBack) {
      return;
    }
    // Debounce rapid editor changes to prevent flashing
    if (this.refreshDebounceTimer) {
      clearTimeout(this.refreshDebounceTimer);
    }
    this.refreshDebounceTimer = setTimeout(() => {
      this.refreshDebounceTimer = undefined;
      // Re-check in case rollback started while waiting
      if (!this.isRollingBack) {
        this.refresh(undefined, te);
      }
    }, 100);
  }

  public async refresh(
    element?: ILogTreeItem,
    te?: TextEditor,
    loadMore?: boolean,
    explicitRefresh?: boolean
  ) {
    // TODO maybe make autorefresh optionable?
    if (loadMore && this.currentItem) {
      await fetchMore(this.currentItem);
      this._onDidChangeTreeData.fire(element);
      return;
    }

    if (te === undefined) {
      te = window.activeTextEditor;
    }
    if (te) {
      const uri = te.document.uri;
      if (uri.scheme === "file") {
        const repo = this.sourceControlManager.getRepository(uri);
        if (repo !== null) {
          // Skip unversioned/ignored/added files - they have no history
          const resource = repo.getResourceFromFile(uri);
          if (resource) {
            const { Status } = await import("../common/types");
            if (
              resource.type === Status.UNVERSIONED ||
              resource.type === Status.IGNORED ||
              resource.type === Status.ADDED
            ) {
              this._onDidChangeTreeData.fire(element);
              return;
            }
          }
          // Clean versioned files have no resource but still have history
          try {
            // Clear low-level log cache on explicit refresh to force fresh SVN call
            if (explicitRefresh) {
              repo.clearLogCache();
            }
            const info = await repo.getInfo(uri.fsPath);
            this.currentItem = {
              isComplete: false,
              entries: [],
              revisionSet: new Set(),
              repo,
              svnTarget: Uri.parse(info.url),
              localPath: uri.fsPath,
              persisted: {
                commitFrom: "HEAD",
                baseRevision: parseInt(info.revision, 10)
              },
              order: 0
            };
            // Pre-load entries before firing tree change to prevent flash
            await fetchMore(this.currentItem);
          } catch (e) {
            // doesn't belong to this repo
          }
        }
      }
      this._onDidChangeTreeData.fire(element);
    }
  }

  public async getTreeItem(element: ILogTreeItem): Promise<TreeItem> {
    let ti: TreeItem;
    if (element.kind === LogTreeItemKind.Commit) {
      const commit = element.data as ISvnLogEntry;
      ti = new TreeItem(getCommitLabel(commit), TreeItemCollapsibleState.None);
      ti.description = getCommitDescription(commit);
      ti.iconPath = getCommitIcon(commit.author);
      ti.tooltip = getCommitToolTip(commit);
      ti.contextValue = "diffable";
      ti.command = {
        command: "svn.itemlog.openDiff",
        title: "Open diff",
        arguments: [element]
      };
      // Use resourceUri to trigger FileDecorationProvider for BASE badge
      if (element.isBase) {
        ti.resourceUri = Uri.parse(
          `svn-commit:r${commit.revision}?isBase=true`
        );
      }
    } else if (element.kind === LogTreeItemKind.TItem) {
      ti = element.data as TreeItem;
    } else {
      throw new Error("Shouldn't happen");
    }
    return ti;
  }

  public async getChildren(
    element: ILogTreeItem | undefined
  ): Promise<ILogTreeItem[]> {
    if (this.currentItem === undefined) {
      return [];
    }
    if (element === undefined) {
      const fname = path.basename(this.currentItem.svnTarget.fsPath);
      const ti = new TreeItem(fname, TreeItemCollapsibleState.Expanded);
      ti.tooltip = path.dirname(this.currentItem.svnTarget.fsPath);
      ti.description = path.dirname(this.currentItem.svnTarget.fsPath);
      ti.iconPath = new ThemeIcon("history");
      const item = {
        kind: LogTreeItemKind.TItem,
        data: ti
      };
      return [item];
    } else {
      const entries = this.currentItem.entries;
      if (entries.length === 0) {
        await fetchMore(this.currentItem);
      }
      const result = transform(entries, LogTreeItemKind.Commit);
      insertBaseMarker(this.currentItem, entries, result);
      if (!this.currentItem.isComplete) {
        const ti = new TreeItem(`Load another ${getLimit()} revisions`);
        const ltItem: ILogTreeItem = {
          kind: LogTreeItemKind.TItem,
          data: ti
        };
        ti.tooltip = "Paging size may be adjusted using log.length setting";
        ti.command = {
          command: "svn.itemlog.refresh",
          arguments: [element, undefined, true],
          title: "refresh element"
        };
        ti.iconPath = new ThemeIcon("unfold");
        result.push(ltItem);
      }
      return result;
    }
  }
}
