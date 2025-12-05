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
import { SourceControlManager } from "../source_control_manager";
import { dispose } from "../util";
import {
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

  public dispose() {
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
      window.showWarningMessage("Cannot diff last commit");
      return;
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
    return this.refresh(undefined, te);
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
          try {
            // Clear low-level log cache on explicit refresh to force fresh SVN call
            if (explicitRefresh) {
              repo.clearLogCache();
            }
            const info = await repo.getInfo(uri.fsPath);
            this.currentItem = {
              isComplete: false,
              entries: [],
              repo,
              svnTarget: Uri.parse(info.url),
              persisted: {
                commitFrom: "HEAD",
                baseRevision: parseInt(info.revision, 10)
              },
              order: 0
            };
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
