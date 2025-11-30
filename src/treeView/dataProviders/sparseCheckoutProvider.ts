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
  TreeView,
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
        new SparseItemNode(
          item,
          this.repo.root,
          p => this.provider.getItems(this.repo, p),
          () => this.provider.triggerRefresh()
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

/** Debounce delay for visual refresh (ms) - longer to avoid race with context menu */
const REFRESH_DEBOUNCE_MS = 500;

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

  /** Cache for folder depth to avoid repeated svn info calls */
  private depthCache = new Map<
    string,
    CacheEntry<SparseDepthKey | undefined>
  >();

  /** Pending debounced refresh timeout */
  private refreshTimeout: ReturnType<typeof setTimeout> | undefined;

  public readonly onDidChangeTreeData: Event<BaseNode | undefined> =
    this._onDidChangeTreeData.event;

  /** Tree view instance for multi-select support */
  private treeView: TreeView<BaseNode> | undefined;

  constructor(private sourceControlManager: SourceControlManager) {
    // Use createTreeView for multi-select support
    this.treeView = window.createTreeView("sparseCheckout", {
      treeDataProvider: this,
      canSelectMany: true
    });

    this._disposables.push(
      this.treeView,
      commands.registerCommand("svn.sparse.refresh", () => this.refresh()),
      commands.registerCommand(
        "svn.sparse.checkout",
        (node: SparseItemNode, selected?: SparseItemNode[]) =>
          this.checkoutItems(
            selected && selected.length > 0 ? selected : [node]
          )
      ),
      commands.registerCommand(
        "svn.sparse.exclude",
        (node: SparseItemNode, selected?: SparseItemNode[]) =>
          this.excludeItems(selected && selected.length > 0 ? selected : [node])
      )
    );
  }

  public refresh(): void {
    // Clear caches on manual refresh
    this.serverListCache.clear();
    this.depthCache.clear();
    this._onDidChangeTreeData.fire(undefined);
  }

  /** Trigger tree refresh without clearing caches (for visual updates, debounced) */
  public triggerRefresh(): void {
    // Debounce to avoid multiple rapid refreshes when expanding folders
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }
    this.refreshTimeout = setTimeout(() => {
      this.refreshTimeout = undefined;
      this._onDidChangeTreeData.fire(undefined);
    }, REFRESH_DEBOUNCE_MS);
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
   * Get items for a folder: only server items, marked as local or ghost.
   * Untracked local items (like .vscode, .idea, .claude) are excluded when server is available.
   */
  public async getItems(
    repo: Repository,
    folderPath: string
  ): Promise<ISparseItem[]> {
    const relativeFolder = path.relative(repo.root, folderPath);

    // Fetch local items and server items in parallel
    const [localItemsRaw, serverResult] = await Promise.all([
      this.getLocalItemsRaw(repo, folderPath),
      this.getServerItems(repo, folderPath).catch(err => {
        // Server list failed (offline, etc.) - log and continue
        logError("Failed to fetch server items for sparse view", err);
        return null;
      })
    ]);

    // If server fetch failed, fall back to showing local items (no filtering)
    // Don't try to get depth for potentially untracked items
    if (!serverResult) {
      return this.mergeItems(localItemsRaw, []);
    }

    // Filter local items to only those on server (exclude untracked like .vscode, .claude)
    const trackedLocalItems = this.filterToTrackedItems(
      localItemsRaw,
      serverResult
    );

    // NOW get depth for tracked directories only (safe - they exist in SVN)
    await this.populateDepths(repo, trackedLocalItems);

    // Always compute ghosts - even with infinity depth, individual items may be excluded
    const ghosts = this.computeGhosts(
      trackedLocalItems,
      serverResult,
      relativeFolder
    );
    return this.mergeItems(trackedLocalItems, ghosts);
  }

  /**
   * Filter local filesystem items to only include tracked items (on server).
   * This excludes untracked items like .vscode, .idea, node_modules, etc.
   * Uses case-insensitive comparison for Windows/macOS compatibility.
   */
  private filterToTrackedItems(
    localItems: ISparseItem[],
    serverItems: { name: string; kind: "file" | "dir" }[]
  ): ISparseItem[] {
    // Case-insensitive Set for Windows/macOS compatibility
    const serverNamesLower = new Set(
      serverItems.map(s => s.name.toLowerCase())
    );
    return localItems.filter(item =>
      serverNamesLower.has(item.name.toLowerCase())
    );
  }

  /**
   * Get local items WITHOUT fetching depth (fast, pure filesystem)
   * Depth is populated later only for tracked items to avoid svn info on untracked folders
   */
  private async getLocalItemsRaw(
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

          items.push({
            name,
            path: relativePath,
            kind,
            depth: undefined,
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

  /**
   * Populate depth for tracked directory items only.
   * Called AFTER filtering to tracked items to avoid svn info on untracked folders.
   */
  private async populateDepths(
    repo: Repository,
    items: ISparseItem[]
  ): Promise<void> {
    const dirItems = items.filter(i => i.kind === "dir");
    if (dirItems.length === 0) return;

    const depths = await Promise.all(
      dirItems.map(d => this.getDepth(repo, path.join(repo.root, d.path)))
    );

    dirItems.forEach((item, i) => {
      item.depth = depths[i];
    });
  }

  private async getDepth(
    repo: Repository,
    folderPath: string
  ): Promise<SparseDepthKey | undefined> {
    // Include repo root in cache key for multi-repo safety
    const cacheKey = `${repo.root}:${folderPath}`;
    const now = Date.now();

    // Check cache
    const cached = this.depthCache.get(cacheKey);
    if (cached && cached.expires > now) {
      return cached.data;
    }

    // Evict expired entries if cache is large
    if (this.depthCache.size >= MAX_CACHE_SIZE) {
      this.evictExpiredDepthCacheEntries(now);
    }

    try {
      const info = await repo.getInfo(folderPath);
      const depth = info.wcInfo?.depth as SparseDepthKey | undefined;

      // Cache result
      this.depthCache.set(cacheKey, {
        data: depth,
        expires: now + CACHE_TTL_MS
      });

      return depth;
    } catch {
      return undefined;
    }
  }

  /** Remove expired depth cache entries */
  private evictExpiredDepthCacheEntries(now: number): void {
    for (const [key, entry] of this.depthCache) {
      if (entry.expires <= now) {
        this.depthCache.delete(key);
      }
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
    // Case-insensitive Set for Windows/macOS compatibility
    const localNamesLower = new Set(localItems.map(i => i.name.toLowerCase()));
    return serverItems
      .filter(s => !localNamesLower.has(s.name.toLowerCase()))
      .map(s => ({
        name: s.name,
        path: relativeFolder ? path.join(relativeFolder, s.name) : s.name,
        kind: s.kind,
        isGhost: true
      }));
  }

  /** Get file extension (lowercase, without dot) */
  private getExtension(name: string): string {
    const lastDot = name.lastIndexOf(".");
    if (lastDot === -1 || lastDot === 0) return "";
    return name.slice(lastDot + 1).toLowerCase();
  }

  private mergeItems(
    local: ISparseItem[],
    ghosts: ISparseItem[]
  ): ISparseItem[] {
    return [...local, ...ghosts].sort((a, b) => {
      // Dirs first
      if (a.kind !== b.kind) {
        return a.kind === "dir" ? -1 : 1;
      }
      // For files: sort by extension, then alphabetical
      if (a.kind === "file") {
        const extA = this.getExtension(a.name);
        const extB = this.getExtension(b.name);
        if (extA !== extB) {
          return extA.localeCompare(extB);
        }
      }
      // Within same kind/extension: alphabetical
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Checkout multiple items (restore from server)
   */
  private async checkoutItems(nodes: SparseItemNode[]): Promise<void> {
    // Filter valid nodes
    const validNodes = nodes.filter(n => n?.fullPath);
    if (validNodes.length === 0) {
      window.showErrorMessage("No valid items selected. Please try again.");
      return;
    }

    // Check all nodes have a repository
    const firstRepo = this.sourceControlManager.getRepository(
      Uri.file(validNodes[0].fullPath)
    );
    if (!firstRepo) {
      window.showErrorMessage("No SVN repository found for selected items");
      return;
    }

    // Determine if we need to ask for depth (any dirs selected?)
    const hasDirs = validNodes.some(n => n.kind === "dir");
    let depth: SparseDepthKey = "infinity";

    if (hasDirs) {
      const selected = await window.showQuickPick(checkoutDepthOptions, {
        placeHolder:
          validNodes.length > 1
            ? `How much should be downloaded? (${validNodes.length} items)`
            : "How much should be downloaded?"
      });

      if (!selected) return;
      depth = selected.depth;
    }

    const label =
      validNodes.length === 1
        ? `"${path.basename(validNodes[0].fullPath)}"`
        : `${validNodes.length} items`;

    try {
      const result = await window.withProgress(
        {
          location: ProgressLocation.Notification,
          title: `Checking out ${label}...`,
          cancellable: false
        },
        async progress => {
          let success = 0;
          let failed = 0;

          for (let i = 0; i < validNodes.length; i++) {
            const node = validNodes[i];
            const repo = this.sourceControlManager.getRepository(
              Uri.file(node.fullPath)
            );
            if (!repo) {
              failed++;
              continue;
            }

            progress.report({
              message: `(${i + 1}/${validNodes.length}) ${path.basename(node.fullPath)}`,
              increment: 100 / validNodes.length
            });

            try {
              const res = await repo.setDepth(node.fullPath, depth, {
                parents: true
              });
              if (res.exitCode === 0) {
                success++;
              } else {
                failed++;
              }
            } catch {
              failed++;
            }
          }

          return { success, failed };
        }
      );

      this.refresh();

      if (result.failed > 0) {
        window.showWarningMessage(
          `Checkout: ${result.success} succeeded, ${result.failed} failed`
        );
      }
    } catch (err) {
      logError("Sparse checkout failed", err);
      window.showErrorMessage(`Checkout failed: ${err}`);
    }
  }

  /**
   * Exclude multiple items (remove from working copy)
   */
  private async excludeItems(nodes: SparseItemNode[]): Promise<void> {
    // Filter valid nodes
    const validNodes = nodes.filter(n => n?.fullPath);
    if (validNodes.length === 0) {
      window.showErrorMessage("No valid items selected. Please try again.");
      return;
    }

    // Build confirmation message
    const label =
      validNodes.length === 1
        ? `"${path.basename(validNodes[0].fullPath)}"`
        : `${validNodes.length} items`;

    const confirm = await window.showWarningMessage(
      `Exclude ${label}? This will remove locally. Files remain on server.`,
      { modal: true },
      "Exclude",
      "Cancel"
    );

    if (confirm !== "Exclude") return;

    try {
      const result = await window.withProgress(
        {
          location: ProgressLocation.Notification,
          title: `Excluding ${label}...`,
          cancellable: false
        },
        async progress => {
          let success = 0;
          let failed = 0;

          for (let i = 0; i < validNodes.length; i++) {
            const node = validNodes[i];
            const repo = this.sourceControlManager.getRepository(
              Uri.file(node.fullPath)
            );
            if (!repo) {
              failed++;
              continue;
            }

            progress.report({
              message: `(${i + 1}/${validNodes.length}) ${path.basename(node.fullPath)}`,
              increment: 100 / validNodes.length
            });

            try {
              const res = await repo.setDepth(node.fullPath, "exclude");
              if (res.exitCode === 0) {
                success++;
              } else {
                failed++;
              }
            } catch {
              failed++;
            }
          }

          return { success, failed };
        }
      );

      this.refresh();

      if (result.failed > 0) {
        window.showWarningMessage(
          `Exclude: ${result.success} succeeded, ${result.failed} failed`
        );
      }
    } catch (err) {
      logError("Sparse exclude failed", err);
      window.showErrorMessage(`Exclude failed: ${err}`);
    }
  }

  public dispose(): void {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }
    dispose(this._disposables);
  }
}
