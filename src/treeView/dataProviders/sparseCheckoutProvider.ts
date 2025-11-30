// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import * as path from "path";
import {
  commands,
  Disposable,
  Event,
  EventEmitter,
  ProgressLocation,
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,
  ThemeIcon,
  Uri,
  window
} from "vscode";
import { ISparseItem, SparseDepthKey } from "../../common/types";
import { checkoutDepthOptions } from "../../commands/setDepth";
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
    const treeItem = new TreeItem(repoName, TreeItemCollapsibleState.Collapsed);
    treeItem.iconPath = new ThemeIcon("repo");
    return treeItem;
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

/** Cache entry with TTL */
interface CacheEntry<T> {
  data: T;
  expires: number;
}

/** Cache TTL in milliseconds (5 minutes) */
const CACHE_TTL_MS = 5 * 60 * 1000;

/** Max cache entries before forced cleanup */
const MAX_CACHE_SIZE = 100;

export default class SparseCheckoutProvider
  implements TreeDataProvider<BaseNode>, Disposable
{
  private _onDidChangeTreeData = new EventEmitter<BaseNode | undefined>();
  private _disposables: Disposable[] = [];

  /** Cache for server list results to avoid repeated network calls */
  private serverListCache = new Map<
    string,
    CacheEntry<{ name: string; kind: "file" | "dir" }[]>
  >();

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
    // Clear cache on manual refresh
    this.serverListCache.clear();
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
    const relativeFolder = path.relative(repo.root, folderPath);

    // Fetch local items, depth, and server items in parallel for speed
    const [localItems, depth, serverResult] = await Promise.all([
      this.getLocalItems(repo, folderPath),
      this.getDepth(repo, folderPath),
      this.getServerItems(repo, folderPath).catch(err => {
        // Server list failed (offline, etc.) - log and continue
        logError("Failed to fetch server items for sparse view", err);
        return null;
      })
    ]);

    // If depth is infinity or server fetch failed, no ghosts
    if (depth === "infinity" || !serverResult) {
      return localItems;
    }

    const ghosts = this.computeGhosts(localItems, serverResult, relativeFolder);
    return this.mergeItems(localItems, ghosts);
  }

  private async getLocalItems(
    repo: Repository,
    folderPath: string
  ): Promise<ISparseItem[]> {
    const items: ISparseItem[] = [];
    const dirPaths: { index: number; fullPath: string }[] = [];

    try {
      const entries = await readdir(folderPath);
      for (const name of entries) {
        if (name === ".svn") continue;

        const fullPath = path.join(folderPath, name);
        const relativePath = path.relative(repo.root, fullPath);

        try {
          const stats = await stat(fullPath);
          const kind = stats.isDirectory() ? "dir" : "file";

          items.push({
            name,
            path: relativePath,
            kind,
            depth: undefined,
            isGhost: false
          });

          // Track directories for batch depth fetch
          if (kind === "dir") {
            dirPaths.push({ index: items.length - 1, fullPath });
          }
        } catch {
          // stat failed, skip
        }
      }

      // Batch fetch depths for all directories in parallel
      if (dirPaths.length > 0) {
        const depths = await Promise.all(
          dirPaths.map(d => this.getDepth(repo, d.fullPath))
        );
        dirPaths.forEach((d, i) => {
          items[d.index].depth = depths[i];
        });
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
    const cacheKey = `${repo.root}:${folderPath}`;
    const now = Date.now();

    // Check cache
    const cached = this.serverListCache.get(cacheKey);
    if (cached && cached.expires > now) {
      return cached.data;
    }

    // Evict expired entries if cache is large
    if (this.serverListCache.size >= MAX_CACHE_SIZE) {
      this.evictExpiredCacheEntries(now);
    }

    // Fetch from server
    const listItems = await repo.list(folderPath);
    const result = listItems.map(item => ({
      name: item.name,
      kind: (item.kind === "dir" ? "dir" : "file") as "file" | "dir"
    }));

    // Cache result
    this.serverListCache.set(cacheKey, {
      data: result,
      expires: now + CACHE_TTL_MS
    });

    return result;
  }

  /** Remove expired cache entries */
  private evictExpiredCacheEntries(now: number): void {
    for (const [key, entry] of this.serverListCache) {
      if (entry.expires <= now) {
        this.serverListCache.delete(key);
      }
    }
  }

  private computeGhosts(
    localItems: ISparseItem[],
    serverItems: { name: string; kind: "file" | "dir" }[],
    relativeFolder: string
  ): ISparseItem[] {
    const localNames = new Set(localItems.map(i => i.name));
    return serverItems
      .filter(s => !localNames.has(s.name))
      .map(s => ({
        name: s.name,
        path: relativeFolder ? path.join(relativeFolder, s.name) : s.name,
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
      const selected = await window.showQuickPick(checkoutDepthOptions, {
        placeHolder: "How much should be downloaded?"
      });

      if (!selected) return;
      depth = selected.depth;
    }

    const itemName = path.basename(fullPath);

    try {
      const result = await window.withProgress(
        {
          location: ProgressLocation.Notification,
          title: `Checking out "${itemName}"...`,
          cancellable: false
        },
        async () => repo.setDepth(fullPath, depth)
      );

      if (result.exitCode === 0) {
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
      const result = await window.withProgress(
        {
          location: ProgressLocation.Notification,
          title: `Excluding "${itemName}"...`,
          cancellable: false
        },
        async () => repo.setDepth(fullPath, "exclude")
      );

      if (result.exitCode === 0) {
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
