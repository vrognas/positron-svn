// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import * as path from "path";
import {
  commands,
  Disposable,
  Event,
  EventEmitter,
  QuickPickItem,
  TreeDataProvider,
  TreeItem,
  Uri,
  window
} from "vscode";
import { ISparseItem, SparseDepthKey } from "../../common/types";
import { readdir, stat } from "../../fs";
import { SourceControlManager } from "../../source_control_manager";
import { Repository } from "../../repository";
import BaseNode from "../nodes/baseNode";
import SparseItemNode from "../nodes/sparseItemNode";
import { dispose } from "../../util";
import { logError } from "../../util/errorLogger";

class RepositoryRootNode extends BaseNode {
  constructor(
    private repo: Repository,
    private provider: SparseCheckoutProvider
  ) {
    super();
  }

  public getTreeItem(): TreeItem {
    const repoName = path.basename(this.repo.root);
    return new TreeItem(repoName);
  }

  public async getChildren(): Promise<BaseNode[]> {
    const items = await this.provider.getItems(this.repo, this.repo.root);
    return items.map(
      item =>
        new SparseItemNode(item, this.repo.root, p =>
          this.provider.getItems(this.repo, p)
        )
    );
  }
}

export default class SparseCheckoutProvider
  implements TreeDataProvider<BaseNode>, Disposable
{
  private _onDidChangeTreeData = new EventEmitter<BaseNode | undefined>();
  private _disposables: Disposable[] = [];

  public readonly onDidChangeTreeData: Event<BaseNode | undefined> =
    this._onDidChangeTreeData.event;

  constructor(private sourceControlManager: SourceControlManager) {
    this._disposables.push(
      window.registerTreeDataProvider("sparseCheckout", this),
      commands.registerCommand("svn.sparse.refresh", () => this.refresh()),
      commands.registerCommand("svn.sparse.checkout", (node: SparseItemNode) =>
        this.checkoutItem(node)
      ),
      commands.registerCommand("svn.sparse.exclude", (node: SparseItemNode) =>
        this.excludeItem(node)
      )
    );
  }

  public refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  public getTreeItem(element: BaseNode): TreeItem | Promise<TreeItem> {
    return element.getTreeItem();
  }

  public async getChildren(element?: BaseNode): Promise<BaseNode[]> {
    if (!this.sourceControlManager.openRepositories.length) {
      return [];
    }

    if (element) {
      return element.getChildren();
    }

    // Root: show one node per repository
    return this.sourceControlManager.openRepositories.map(
      openRepo => new RepositoryRootNode(openRepo.repository, this)
    );
  }

  /**
   * Get items for a folder: local items + ghost items from server
   */
  public async getItems(
    repo: Repository,
    folderPath: string
  ): Promise<ISparseItem[]> {
    const localItems = await this.getLocalItems(repo, folderPath);
    const depth = await this.getDepth(repo, folderPath);

    // If depth is infinity, no ghosts possible
    if (depth === "infinity") {
      return localItems;
    }

    // Fetch server items to find ghosts
    try {
      const serverItems = await this.getServerItems(repo, folderPath);
      const ghosts = this.computeGhosts(localItems, serverItems);
      return this.mergeItems(localItems, ghosts);
    } catch (err) {
      // Server list failed (offline, etc.) - just show local
      logError("Failed to fetch server items for sparse view", err);
      return localItems;
    }
  }

  private async getLocalItems(
    repo: Repository,
    folderPath: string
  ): Promise<ISparseItem[]> {
    const items: ISparseItem[] = [];

    try {
      const entries = await readdir(folderPath);
      for (const name of entries) {
        if (name === ".svn") continue;

        const fullPath = path.join(folderPath, name);
        const relativePath = path.relative(repo.root, fullPath);

        try {
          const stats = await stat(fullPath);
          const kind = stats.isDirectory() ? "dir" : "file";
          let depth: SparseDepthKey | undefined;

          if (kind === "dir") {
            depth = await this.getDepth(repo, fullPath);
          }

          items.push({
            name,
            path: relativePath,
            kind,
            depth,
            isGhost: false
          });
        } catch {
          // stat failed, skip
        }
      }
    } catch {
      // readdir failed
    }

    return items;
  }

  private async getDepth(
    repo: Repository,
    folderPath: string
  ): Promise<SparseDepthKey | undefined> {
    try {
      const info = await repo.getInfo(folderPath);
      return info.wcInfo?.depth as SparseDepthKey | undefined;
    } catch {
      return undefined;
    }
  }

  private async getServerItems(
    repo: Repository,
    folderPath: string
  ): Promise<{ name: string; kind: "file" | "dir" }[]> {
    const listItems = await repo.list(folderPath);
    return listItems.map(item => ({
      name: item.name,
      kind: item.kind === "dir" ? "dir" : "file"
    }));
  }

  private computeGhosts(
    localItems: ISparseItem[],
    serverItems: { name: string; kind: "file" | "dir" }[]
  ): ISparseItem[] {
    const localNames = new Set(localItems.map(i => i.name));
    return serverItems
      .filter(s => !localNames.has(s.name))
      .map(s => ({
        name: s.name,
        path: s.name,
        kind: s.kind,
        isGhost: true
      }));
  }

  private mergeItems(
    local: ISparseItem[],
    ghosts: ISparseItem[]
  ): ISparseItem[] {
    return [...local, ...ghosts].sort((a, b) => {
      // Dirs first, then alphabetical
      if (a.kind !== b.kind) {
        return a.kind === "dir" ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Checkout a ghost item (restore from server)
   */
  private async checkoutItem(node: SparseItemNode): Promise<void> {
    const fullPath = node.fullPath;
    const repo = this.sourceControlManager.getRepository(Uri.file(fullPath));
    if (!repo) {
      window.showErrorMessage("No SVN repository found for this path");
      return;
    }

    // For files, just checkout with infinity (download the file)
    // For dirs, ask for depth
    let depth: SparseDepthKey = "infinity";

    if (node.kind === "dir") {
      interface DepthQuickPickItem extends QuickPickItem {
        depth: SparseDepthKey;
      }
      const options: DepthQuickPickItem[] = [
        {
          label: "$(folder-opened) Full",
          description: "Download everything",
          depth: "infinity"
        },
        {
          label: "$(list-tree) Shallow",
          description: "Files + empty subfolders",
          depth: "immediates"
        },
        {
          label: "$(file) Files Only",
          description: "Skip subfolders",
          depth: "files"
        },
        {
          label: "$(folder) Folder Only",
          description: "Empty placeholder",
          depth: "empty"
        }
      ];

      const selected = await window.showQuickPick(options, {
        placeHolder: "How much should be downloaded?"
      });

      if (!selected) return;
      depth = selected.depth;
    }

    try {
      // For ghost items, we need to update the parent folder to include this item
      // SVN doesn't have a direct "add this excluded path" command
      // We use: svn update --set-depth <depth> <path>
      const result = await repo.setDepth(fullPath, depth);
      if (result.exitCode === 0) {
        const itemName = path.basename(fullPath);
        window.showInformationMessage(`"${itemName}" checked out`);
        this.refresh();
      } else {
        window.showErrorMessage(`Checkout failed: ${result.stderr}`);
      }
    } catch (err) {
      logError("Sparse checkout failed", err);
      window.showErrorMessage(`Checkout failed: ${err}`);
    }
  }

  /**
   * Exclude a local item (remove from working copy)
   */
  private async excludeItem(node: SparseItemNode): Promise<void> {
    const fullPath = node.fullPath;
    const repo = this.sourceControlManager.getRepository(Uri.file(fullPath));
    if (!repo) {
      window.showErrorMessage("No SVN repository found for this path");
      return;
    }

    const itemName = path.basename(fullPath);
    const confirm = await window.showWarningMessage(
      `Exclude "${itemName}"? This will remove it locally. Files remain on server.`,
      { modal: true },
      "Exclude",
      "Cancel"
    );

    if (confirm !== "Exclude") return;

    try {
      const result = await repo.setDepth(fullPath, "exclude");
      if (result.exitCode === 0) {
        window.showInformationMessage(`"${itemName}" excluded`);
        this.refresh();
      } else {
        window.showErrorMessage(`Exclude failed: ${result.stderr}`);
      }
    } catch (err) {
      logError("Sparse exclude failed", err);
      window.showErrorMessage(`Exclude failed: ${err}`);
    }
  }

  public dispose(): void {
    dispose(this._disposables);
  }
}
