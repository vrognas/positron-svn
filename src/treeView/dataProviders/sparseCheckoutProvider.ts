// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import * as fs from "fs";
import * as path from "path";
import {
  CancellationToken,
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
  window,
  workspace
} from "vscode";
import {
  ISparseItem,
  ISvnListItem,
  LockStatus,
  SparseDepthKey
} from "../../common/types";
import { checkoutDepthOptions } from "../../commands/setDepth";
import { readdir, stat } from "../../fs";
import { SourceControlManager } from "../../source_control_manager";
import { Repository } from "../../repository";
import BaseNode from "../nodes/baseNode";
import SparseItemNode from "../nodes/sparseItemNode";
import { SparseFileDecorationProvider } from "../sparseFileDecorationProvider";
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
          node => this.provider.triggerRefresh(node)
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

/** Default large file warning threshold in MB (configurable via svn.sparse.largeFileWarningMb) */
const DEFAULT_LARGE_FILE_WARNING_MB = 10;

/** Default download timeout in minutes (configurable via svn.sparse.downloadTimeoutMinutes) */
const DEFAULT_DOWNLOAD_TIMEOUT_MINUTES = 10;

/** Default download speed estimate (bytes/sec) - conservative 1 MB/s */
const DEFAULT_SPEED_BPS = 1 * 1024 * 1024;

/** Max speed samples to keep for averaging */
const MAX_SPEED_SAMPLES = 5;

/** Format duration in human-readable form */
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`;
}

/** Parse size string to bytes */
function parseSizeToBytes(size?: string): number {
  if (!size) return 0;
  const n = parseInt(size, 10);
  return isNaN(n) ? 0 : n;
}

/** Format bytes as human-readable string */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/** Polling interval for file size monitoring (ms) */
const FILE_POLL_INTERVAL_MS = 500;

/** Speed decay factor when no growth detected (0.5 = halve each poll) */
const SPEED_DECAY_FACTOR = 0.5;

/** Max recursion depth for folder counting (prevents stack overflow) */
const MAX_RECURSION_DEPTH = 100;

/** Default pre-scan timeout in seconds (configurable via svn.sparse.preScanTimeoutSeconds) */
const DEFAULT_PRESCAN_TIMEOUT_SECONDS = 30;

/**
 * Monitor file size growth during download.
 * Returns cleanup function and getters for speed/size.
 *
 * NOTE: SVN may download to .svn/tmp/ first then rename, so real-time
 * monitoring may not show progress for all files. Works best when SVN
 * writes directly to the target path.
 */
function createFileSizeMonitor(filePath: string): {
  stop: () => void;
  getSpeed: () => number;
  getSize: () => number;
  isStopped: () => boolean;
} {
  let lastSize = 0;
  let lastTime = Date.now();
  let currentSpeed = 0;
  let currentSize = 0;
  let isFirstPoll = true;
  let stopped = false;

  const poll = () => {
    // Race condition fix: don't poll after stop
    if (stopped) return;

    try {
      const stats = fs.statSync(filePath);
      const now = Date.now();
      const sizeDelta = stats.size - lastSize;
      const timeDelta = (now - lastTime) / 1000;

      if (isFirstPoll) {
        // Skip first measurement to avoid spike when file appears with data
        isFirstPoll = false;
        lastSize = stats.size;
        lastTime = now;
        currentSize = stats.size;
        return;
      }

      if (timeDelta > 0) {
        if (sizeDelta > 0) {
          // File is growing - calculate speed
          currentSpeed = sizeDelta / timeDelta;
        } else {
          // No growth - decay speed toward 0 (indicates stall)
          currentSpeed *= SPEED_DECAY_FACTOR;
          if (currentSpeed < 1024) currentSpeed = 0; // Below 1KB/s = 0
        }
      }

      currentSize = stats.size;
      lastSize = stats.size;
      lastTime = now;
    } catch {
      // File may not exist yet or be locked - ignore
    }
  };

  // Poll immediately (Bug fix: setInterval doesn't run immediately)
  poll();
  const interval = setInterval(poll, FILE_POLL_INTERVAL_MS);

  return {
    stop: () => {
      stopped = true;
      clearInterval(interval);
    },
    getSpeed: () => currentSpeed,
    getSize: () => currentSize,
    isStopped: () => stopped
  };
}

/**
 * Count files recursively in a directory (for tracking folder download progress).
 * Returns count of files that exist on disk.
 *
 * Safety features:
 * - Symlink loop detection via visited inode tracking
 * - Max recursion depth limit
 * - Skips symbolic links entirely
 */
/** Folder statistics for progress tracking */
interface FolderStats {
  count: number;
  size: number;
}

/**
 * Get file count and total size in a single traversal.
 * Used for size-based progress tracking.
 */
function getFolderStats(
  folderPath: string,
  visited = new Set<string>(),
  depth = 0
): FolderStats {
  if (depth > MAX_RECURSION_DEPTH) {
    return { count: 0, size: 0 };
  }

  let count = 0;
  let size = 0;
  try {
    const folderStat = fs.statSync(folderPath);
    const inode = `${folderStat.dev}:${folderStat.ino}`;
    if (visited.has(inode)) {
      return { count: 0, size: 0 };
    }
    visited.add(inode);

    const entries = fs.readdirSync(folderPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === ".svn") continue;
      if (entry.isSymbolicLink()) continue;

      const fullPath = path.join(folderPath, entry.name);
      if (entry.isDirectory()) {
        const sub = getFolderStats(fullPath, visited, depth + 1);
        count += sub.count;
        size += sub.size;
      } else if (entry.isFile()) {
        try {
          size += fs.statSync(fullPath).size;
          count++;
        } catch {
          // File may have been deleted
        }
      }
    }
  } catch (err) {
    if (err instanceof Error && !err.message.includes("ENOENT")) {
      logError("getFolderStats error", err);
    }
  }
  return { count, size };
}

/**
 * Monitor folder download progress by tracking file size.
 * Size-based tracking is more accurate than file count for progress/ETA.
 */
function createFolderMonitor(
  folderPath: string,
  expectedTotalSize: number,
  expectedFileCount: number
): {
  stop: () => void;
  getProgress: () => number;
  getSize: () => number;
  getFileCount: () => number;
  getSpeed: () => number;
  isStopped: () => boolean;
} {
  let currentStats = { count: 0, size: 0 };
  let stopped = false;
  let lastSize = 0;
  let lastTime = Date.now();
  let smoothedSpeed = 0;

  const poll = () => {
    if (stopped) return;
    currentStats = getFolderStats(folderPath);

    // Calculate smoothed speed
    const now = Date.now();
    const deltaTime = (now - lastTime) / 1000;
    const deltaSize = currentStats.size - lastSize;
    if (deltaTime > 0 && deltaSize > 0) {
      const instantSpeed = deltaSize / deltaTime;
      smoothedSpeed =
        smoothedSpeed === 0
          ? instantSpeed
          : 0.3 * instantSpeed + 0.7 * smoothedSpeed;
    }
    lastSize = currentStats.size;
    lastTime = now;
  };

  // Poll immediately
  poll();
  const interval = setInterval(poll, FILE_POLL_INTERVAL_MS);

  return {
    stop: () => {
      stopped = true;
      clearInterval(interval);
    },
    getProgress: () =>
      expectedTotalSize > 0
        ? Math.min(currentStats.size / expectedTotalSize, 1)
        : expectedFileCount > 0
          ? Math.min(currentStats.count / expectedFileCount, 1)
          : 0,
    getSize: () => currentStats.size,
    getFileCount: () => currentStats.count,
    getSpeed: () => smoothedSpeed,
    isStopped: () => stopped
  };
}

export default class SparseCheckoutProvider
  implements TreeDataProvider<BaseNode>, Disposable
{
  private _onDidChangeTreeData = new EventEmitter<BaseNode | undefined>();
  private _disposables: Disposable[] = [];

  /** Cache for server list results to avoid repeated network calls */
  private serverListCache = new Map<string, CacheEntry<ISvnListItem[]>>();

  /** Cache for folder depth to avoid repeated svn info calls */
  private depthCache = new Map<
    string,
    CacheEntry<SparseDepthKey | undefined>
  >();

  /** Pending debounced refresh timeout */
  private refreshTimeout: ReturnType<typeof setTimeout> | undefined;

  /** Recent download speeds (bytes/sec) for ETA estimation */
  private speedSamples: number[] = [];

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
      new SparseFileDecorationProvider(),
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

  /** Trigger tree refresh without clearing caches (for visual updates) */
  public triggerRefresh(node?: BaseNode): void {
    // Targeted refresh: immediate, no debounce needed
    if (node) {
      this._onDidChangeTreeData.fire(node);
      return;
    }

    // Full refresh: debounce to avoid multiple rapid refreshes
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

    // Add lock status from repository status (fast, uses existing data)
    this.populateLockStatus(repo, trackedLocalItems);

    // Fetch local revisions for outdated detection
    await this.populateLocalRevisions(repo, trackedLocalItems);

    // Always compute ghosts - even with infinity depth, individual items may be excluded
    const ghosts = this.computeGhosts(
      trackedLocalItems,
      serverResult,
      relativeFolder
    );

    // Fetch lock status for ghost files (batch SVN info call)
    await this.populateGhostLockStatus(repo, ghosts);

    return this.mergeItems(trackedLocalItems, ghosts);
  }

  /**
   * Filter local filesystem items to only include tracked items (on server).
   * This excludes untracked items like .vscode, .idea, node_modules, etc.
   * Uses case-insensitive comparison for Windows/macOS compatibility.
   */
  private filterToTrackedItems(
    localItems: ISparseItem[],
    serverItems: ISvnListItem[]
  ): ISparseItem[] {
    // Build lookup for server metadata (case-insensitive)
    const serverByName = new Map<string, ISvnListItem>();
    for (const s of serverItems) {
      serverByName.set(s.name.toLowerCase(), s);
    }

    // Single pass: filter + enrich (avoid 2× toLowerCase per item)
    const result: ISparseItem[] = [];
    for (const item of localItems) {
      const lowerName = item.name.toLowerCase();
      const serverData = serverByName.get(lowerName);
      if (!serverData) continue;

      if (serverData.commit) {
        result.push({
          ...item,
          revision: serverData.commit.revision,
          author: serverData.commit.author,
          date: serverData.commit.date,
          size: serverData.size
        });
      } else {
        result.push(item);
      }
    }
    return result;
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

  /**
   * Enrich local items with lock status from repository status.
   * Only items that appear in SCM status will have lock info.
   */
  private populateLockStatus(repo: Repository, items: ISparseItem[]): void {
    for (const item of items) {
      if (item.isGhost) continue; // Ghosts don't have local lock status

      const fullPath = path.join(repo.root, item.path);
      const resource = repo.getResourceFromFile(fullPath);
      if (resource?.lockStatus) {
        item.lockStatus = resource.lockStatus;
        item.lockOwner = resource.lockOwner;
        // Note: lockComment not available from status, would need svn info
      }
    }
  }

  /**
   * Populate local revision for tracked items (non-ghost).
   * Used to detect outdated files (localRevision < serverRevision).
   */
  private async populateLocalRevisions(
    repo: Repository,
    items: ISparseItem[]
  ): Promise<void> {
    const localItems = items.filter(i => !i.isGhost);
    if (localItems.length === 0) return;

    // Batch fetch info for all local items in parallel
    const infos = await Promise.all(
      localItems.map(async item => {
        try {
          const fullPath = path.join(repo.root, item.path);
          const info = await repo.getInfo(fullPath);
          return info.commit?.revision;
        } catch {
          return undefined;
        }
      })
    );

    // Apply local revisions
    localItems.forEach((item, i) => {
      item.localRevision = infos[i];
    });
  }

  /**
   * Fetch lock status for ghost files via batch svn info.
   * Only fetches for files (directories don't have locks).
   */
  private async populateGhostLockStatus(
    repo: Repository,
    ghosts: ISparseItem[]
  ): Promise<void> {
    // Filter to ghost files only (dirs don't have locks)
    const ghostFiles = ghosts.filter(g => g.isGhost && g.kind === "file");
    if (ghostFiles.length === 0) return;

    try {
      // Get repo URL from info
      const info = await repo.getInfo(repo.root);
      const baseUrl = info.url;
      if (!baseUrl) return;

      // Build URLs for each ghost file
      const urls = ghostFiles.map(g => {
        // Convert Windows backslashes to forward slashes
        const urlPath = g.path.replace(/\\/g, "/");
        return `${baseUrl}/${urlPath}`;
      });

      // Batch fetch lock info
      const lockInfoMap = await repo.getBatchLockInfo(urls);

      // Get current username to determine K vs O status
      const currentUser = repo.username;

      // Apply lock info to ghost items
      for (let i = 0; i < ghostFiles.length; i++) {
        const url = urls[i];
        const lockInfo = lockInfoMap.get(url);
        if (lockInfo) {
          ghostFiles[i].lockOwner = lockInfo.owner;
          ghostFiles[i].lockComment = lockInfo.comment;
          // K if locked by current user, O if locked by others
          ghostFiles[i].lockStatus =
            currentUser && lockInfo.owner === currentUser
              ? LockStatus.K
              : LockStatus.O;
        }
      }
    } catch (err) {
      // Lock fetch failed - not critical, just log
      logError("Failed to fetch ghost lock status", err);
    }
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
  ): Promise<ISvnListItem[]> {
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

    // Fetch from server (returns full ISvnListItem with commit metadata)
    const listItems = await repo.list(folderPath);

    // Cache result
    this.serverListCache.set(cacheKey, {
      data: listItems,
      expires: now + CACHE_TTL_MS
    });

    return listItems;
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
    serverItems: ISvnListItem[],
    relativeFolder: string
  ): ISparseItem[] {
    // Case-insensitive Set for Windows/macOS compatibility
    const localNamesLower = new Set(localItems.map(i => i.name.toLowerCase()));
    return serverItems
      .filter(s => !localNamesLower.has(s.name.toLowerCase()))
      .map(s => ({
        name: s.name,
        path: relativeFolder ? path.join(relativeFolder, s.name) : s.name,
        kind: (s.kind === "dir" ? "dir" : "file") as "file" | "dir",
        isGhost: true,
        // Include commit metadata from server
        revision: s.commit?.revision,
        author: s.commit?.author,
        date: s.commit?.date,
        size: s.size
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
    const items = [...local, ...ghosts];

    // Pre-compute extensions once O(n) instead of O(n log n) in comparator
    const extensions = new Map<ISparseItem, string>();
    for (const item of items) {
      if (item.kind === "file") {
        extensions.set(item, this.getExtension(item.name));
      }
    }

    return items.sort((a, b) => {
      // Dirs first
      if (a.kind !== b.kind) {
        return a.kind === "dir" ? -1 : 1;
      }
      // For files: sort by extension, then alphabetical
      if (a.kind === "file") {
        const extA = extensions.get(a) ?? "";
        const extB = extensions.get(b) ?? "";
        if (extA !== extB) {
          return extA.localeCompare(extB);
        }
      }
      // Within same kind/extension: alphabetical
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Download items from server (sparse checkout)
   * - Shows progress with cancellation support
   * - Warns about large files (configurable threshold)
   */
  private async checkoutItems(nodes: SparseItemNode[]): Promise<void> {
    // Filter valid nodes and pre-fetch repositories (single lookup per node)
    const validNodes = nodes.filter(n => n?.fullPath);
    if (validNodes.length === 0) {
      window.showErrorMessage("No valid items selected. Please try again.");
      return;
    }

    // Pre-fetch all repositories once (O(n) instead of O(2n))
    const nodeRepos = validNodes.map(n => ({
      node: n,
      repo: this.sourceControlManager.getRepository(Uri.file(n.fullPath))
    }));

    // Validate all nodes have repositories
    const invalidCount = nodeRepos.filter(nr => !nr.repo).length;
    if (invalidCount === validNodes.length) {
      window.showErrorMessage("No SVN repository found for selected items");
      return;
    }

    // Get configurable threshold for large file warning
    const thresholdMb = workspace
      .getConfiguration("svn.sparse")
      .get<number>("largeFileWarningMb", DEFAULT_LARGE_FILE_WARNING_MB);
    const thresholdBytes = thresholdMb * 1024 * 1024;

    // Get configurable timeout for downloads (in minutes, convert to ms)
    const timeoutMinutes = workspace
      .getConfiguration("svn.sparse")
      .get<number>("downloadTimeoutMinutes", DEFAULT_DOWNLOAD_TIMEOUT_MINUTES);
    const downloadTimeoutMs = timeoutMinutes * 60 * 1000;

    // Build file size map for O(1) lookups (fixes basename collision + O(n²))
    const fileSizeMap = this.getFileSizeMap(validNodes);

    // Calculate total size from map values
    let totalSize = 0;
    for (const size of fileSizeMap.values()) {
      totalSize += size;
    }

    // Check for large files and warn user (if threshold > 0)
    if (thresholdMb > 0) {
      // Filter large files from map
      const largeFiles: { name: string; size: number }[] = [];
      for (const [fullPath, size] of fileSizeMap) {
        if (size > thresholdBytes) {
          largeFiles.push({ name: path.basename(fullPath), size });
        }
      }
      if (largeFiles.length > 0) {
        const largeTotal = largeFiles.reduce((sum, f) => sum + f.size, 0);
        // Show up to 5 large files for better visibility
        const fileList = largeFiles
          .slice(0, 5)
          .map(f => `• ${f.name} (${formatBytes(f.size)})`)
          .join("\n");
        const more =
          largeFiles.length > 5
            ? `\n... and ${largeFiles.length - 5} more`
            : "";

        // Lead with total download size (most important info first)
        const totalLabel =
          totalSize > largeTotal
            ? `Total download: ${formatBytes(totalSize)}\n\n`
            : "";

        const proceed = await window.showWarningMessage(
          `Download ${formatBytes(largeTotal)} of large files?\n\n` +
            `${totalLabel}` +
            `Large files (>${thresholdMb} MB):\n${fileList}${more}`,
          { modal: true },
          "Download",
          "Cancel"
        );

        if (proceed !== "Download") return;
      }
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

    // Include size and ETA estimate in title if known
    const avgSpeed = this.getAverageSpeed();
    const etaSeconds = totalSize > 0 ? totalSize / avgSpeed : 0;
    const etaLabel =
      totalSize > 0 && etaSeconds > 5 ? ` ~${formatDuration(etaSeconds)}` : "";
    const sizeLabel =
      totalSize > 0 ? ` (${formatBytes(totalSize)}${etaLabel})` : "";

    // Track start time for speed calculation
    const startTime = Date.now();

    // Collect unique repos for status suppression (prevents WC lock conflicts)
    const affectedRepos = new Set(
      nodeRepos
        .map(nr => nr.repo)
        .filter((r): r is Repository => r !== undefined)
    );

    // Suppress status updates during download (fixes svn info spam on Windows)
    for (const repo of affectedRepos) {
      repo.sparseDownloadInProgress = true;
    }

    try {
      // Use notification for cancellation support
      const isBatch = validNodes.length > 1;

      const result = await window.withProgress(
        {
          location: ProgressLocation.Notification,
          title: `Downloading ${label}${sizeLabel}`,
          cancellable: true
        },
        async (progress, token: CancellationToken) => {
          // Immediate feedback that download is starting
          progress.report({ message: "Starting download..." });

          let success = 0;
          let failed = 0;
          let cancelled = false;
          let bytesDownloaded = 0;

          // Active monitors for cleanup on cancellation
          let activeFileMonitor:
            | ReturnType<typeof createFileSizeMonitor>
            | undefined;
          let activeFolderMonitor:
            | ReturnType<typeof createFolderMonitor>
            | undefined;
          let activeInterval: ReturnType<typeof setInterval> | undefined;

          /** Cleanup current monitors and interval */
          const cleanup = () => {
            activeFileMonitor?.stop();
            activeFileMonitor = undefined;
            activeFolderMonitor?.stop();
            activeFolderMonitor = undefined;
            if (activeInterval) {
              clearInterval(activeInterval);
              activeInterval = undefined;
            }
          };

          for (let i = 0; i < nodeRepos.length; i++) {
            // Check cancellation before each item
            if (token.isCancellationRequested) {
              cleanup(); // Memory leak fix: cleanup on cancel
              cancelled = true;
              break;
            }

            const { node, repo } = nodeRepos[i];
            if (!repo) {
              failed++;
              continue;
            }

            // Calculate dynamic ETA based on current progress
            const elapsed = (Date.now() - startTime) / 1000;
            const currentSpeed =
              elapsed > 0 && bytesDownloaded > 0
                ? bytesDownloaded / elapsed
                : avgSpeed;
            const remainingBytes = totalSize - bytesDownloaded;
            const etaRemaining =
              remainingBytes > 0 && currentSpeed > 0
                ? remainingBytes / currentSpeed
                : 0;
            const etaText =
              etaRemaining > 3 ? ` ~${formatDuration(etaRemaining)} left` : "";

            progress.report({
              message: isBatch
                ? `(${i + 1}/${nodeRepos.length}) ${path.basename(node.fullPath)}${etaText}`
                : `${path.basename(node.fullPath)}${etaText}`,
              increment: 100 / nodeRepos.length
            });

            // Get file size using fullPath key (fixes basename collision)
            const expectedSize = fileSizeMap.get(node.fullPath) ?? 0;

            // For folders with infinity depth: pre-scan for file count and size
            let expectedFileCount = 0;
            let expectedFolderSize = 0;
            if (node.kind === "dir" && depth === "infinity") {
              // Check cancellation BEFORE pre-scan (can be slow for large folders)
              if (token.isCancellationRequested) {
                cleanup();
                cancelled = true;
                break;
              }

              // Get configurable pre-scan timeout
              const preScanTimeoutSeconds = workspace
                .getConfiguration("svn.sparse")
                .get<number>(
                  "preScanTimeoutSeconds",
                  DEFAULT_PRESCAN_TIMEOUT_SECONDS
                );
              const preScanTimeoutMs = preScanTimeoutSeconds * 1000;

              // Show scanning progress (user feedback that something is happening)
              const folderName = path.basename(node.fullPath);
              progress.report({
                message: `Scanning ${folderName}...`
              });

              try {
                // Pre-scan folder to get expected file count and total size
                const folderContents = await repo.listRecursive(
                  node.fullPath,
                  preScanTimeoutMs
                );
                const files = folderContents.filter(f => f.kind === "file");
                expectedFileCount = files.length;
                expectedFolderSize = files.reduce(
                  (sum, f) => sum + parseInt(f.size, 10),
                  0
                );

                // Show file count and size found
                progress.report({
                  message: `Found ${expectedFileCount} files (${formatBytes(expectedFolderSize)}) in ${folderName}`
                });
              } catch (err) {
                // Pre-scan failed - log error, continue without progress tracking
                logError("Pre-scan failed for folder progress", err);
              }

              // Check cancellation AFTER pre-scan (user may have cancelled during scan)
              if (token.isCancellationRequested) {
                cleanup();
                cancelled = true;
                break;
              }
            }

            // Start appropriate monitor based on item type
            if (node.kind === "file" && expectedSize > 1024 * 1024) {
              // File monitor for large files (>1MB)
              activeFileMonitor = createFileSizeMonitor(node.fullPath);
            } else if (node.kind === "dir" && expectedFolderSize > 0) {
              // Folder monitor only if we have size to track (skip empty folders)
              activeFolderMonitor = createFolderMonitor(
                node.fullPath,
                expectedFolderSize,
                expectedFileCount
              );
            }

            // Progress update interval during download
            // Clear any existing interval before creating new one (prevents leak)
            if (activeInterval) {
              clearInterval(activeInterval);
              activeInterval = undefined;
            }
            if (activeFileMonitor && expectedSize > 0) {
              const monitor = activeFileMonitor; // Capture for closure
              activeInterval = setInterval(() => {
                if (monitor.isStopped()) return;
                const realSpeed = monitor.getSpeed();
                const downloaded = Math.min(monitor.getSize(), expectedSize);
                if (realSpeed > 0) {
                  const remaining = expectedSize - downloaded;
                  const eta = remaining > 0 ? remaining / realSpeed : 0;
                  const speedLabel = `${formatBytes(realSpeed)}/s`;
                  const etaLabel = eta > 2 ? ` ~${formatDuration(eta)}` : "";
                  progress.report({
                    message: `${path.basename(node.fullPath)} ${speedLabel}${etaLabel}`
                  });
                }
              }, FILE_POLL_INTERVAL_MS);
            } else if (activeFolderMonitor && expectedFolderSize > 0) {
              const monitor = activeFolderMonitor; // Capture for closure
              const folderName = path.basename(node.fullPath);
              activeInterval = setInterval(() => {
                if (monitor.isStopped()) return;
                const currentSize = monitor.getSize();
                const pct = Math.round(monitor.getProgress() * 100);
                const speed = monitor.getSpeed();
                // Speed and ETA label
                let speedEtaLabel = "";
                if (speed > 0) {
                  speedEtaLabel = ` ${formatBytes(speed)}/s`;
                  const remaining = expectedFolderSize - currentSize;
                  if (remaining > 0) {
                    const eta = remaining / speed;
                    if (eta > 2) speedEtaLabel += ` ~${formatDuration(eta)}`;
                  }
                }
                progress.report({
                  message: `${folderName}: ${formatBytes(currentSize)}/${formatBytes(expectedFolderSize)} (${pct}%)${speedEtaLabel}`
                });
              }, FILE_POLL_INTERVAL_MS);
            }

            try {
              // Show that actual download is starting (after pre-scan)
              const itemName = path.basename(node.fullPath);
              if (node.kind === "dir" && expectedFolderSize > 0) {
                progress.report({
                  message: `Downloading ${itemName} (${formatBytes(expectedFolderSize)})...`
                });
              } else {
                progress.report({
                  message: `Downloading ${itemName}...`
                });
              }

              const res = await repo.setDepth(node.fullPath, depth, {
                parents: true,
                timeout: downloadTimeoutMs
              });

              cleanup();

              if (res.exitCode === 0) {
                success++;
                // Track bytes from file size or folder size (for ETA)
                bytesDownloaded +=
                  node.kind === "dir" ? expectedFolderSize : expectedSize;
              } else {
                failed++;
              }
            } catch {
              cleanup();
              failed++;
            }
          }

          return { success, failed, cancelled, bytesDownloaded };
        }
      );

      // Track download speed for future ETA estimates (only if we had size data)
      if (totalSize > 0 && result.success > 0 && !result.cancelled) {
        const elapsedMs = Date.now() - startTime;
        if (elapsedMs > 1000) {
          // Only track if >1s to avoid noise
          const speed = totalSize / (elapsedMs / 1000);
          this.recordDownloadSpeed(speed);
        }
      }

      this.refresh();

      // Show appropriate message based on outcome
      const totalItems = nodeRepos.length;
      const remaining = totalItems - result.success - result.failed;
      if (result.cancelled) {
        window.showInformationMessage(
          `Download cancelled. ${result.success} of ${totalItems} completed, ${remaining} not downloaded.`
        );
      } else if (result.failed > 0) {
        window
          .showWarningMessage(
            `Download completed with errors: ${result.success} succeeded, ${result.failed} failed`,
            "Show Output"
          )
          .then(choice => {
            if (choice === "Show Output") {
              commands.executeCommand("svn.showOutputChannel");
            }
          });
      } else if (result.success > 0) {
        // Success notification - users need positive feedback
        const sizeInfo = totalSize > 0 ? ` (${formatBytes(totalSize)})` : "";
        window.showInformationMessage(
          `Downloaded ${result.success} ${result.success === 1 ? "item" : "items"}${sizeInfo}`
        );
      }
    } catch (err) {
      logError("Sparse checkout failed", err);
      window
        .showErrorMessage(`Download failed: ${err}`, "Show Output")
        .then(choice => {
          if (choice === "Show Output") {
            commands.executeCommand("svn.showOutputChannel");
          }
        });
    } finally {
      // Re-enable status updates after download completes
      for (const repo of affectedRepos) {
        repo.sparseDownloadInProgress = false;
      }
    }
  }

  /**
   * Get file sizes for ghost files (server-only items with known size)
   * Returns Map<fullPath, size> for O(1) lookup (fixes O(n²) in download loop)
   */
  private getFileSizeMap(nodes: SparseItemNode[]): Map<string, number> {
    const sizeMap = new Map<string, number>();
    for (const n of nodes) {
      if (n.kind === "file" && n.isGhost) {
        const size = parseSizeToBytes(n.size);
        if (size > 0) {
          sizeMap.set(n.fullPath, size);
        }
      }
    }
    return sizeMap;
  }

  /**
   * Get average download speed from recent samples (bytes/sec)
   */
  private getAverageSpeed(): number {
    if (this.speedSamples.length === 0) {
      return DEFAULT_SPEED_BPS;
    }
    const sum = this.speedSamples.reduce((a, b) => a + b, 0);
    return sum / this.speedSamples.length;
  }

  /**
   * Record a download speed sample for future ETA estimates
   */
  private recordDownloadSpeed(bytesPerSec: number): void {
    this.speedSamples.push(bytesPerSec);
    // Keep only recent samples
    if (this.speedSamples.length > MAX_SPEED_SAMPLES) {
      this.speedSamples.shift();
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

    // Build label for messages
    const label =
      validNodes.length === 1
        ? `"${path.basename(validNodes[0].fullPath)}"`
        : `${validNodes.length} items`;

    // Check if confirmation is enabled
    const confirmEnabled = workspace
      .getConfiguration("svn.sparse")
      .get<boolean>("confirmExclude", true);

    if (confirmEnabled) {
      const confirm = await window.showWarningMessage(
        `Exclude ${label}? This will remove locally. Files remain on server.`,
        { modal: true },
        "Exclude",
        "Don't Ask Again"
      );

      if (!confirm) return;

      // If user chose "Don't Ask Again", disable the setting
      if (confirm === "Don't Ask Again") {
        await workspace
          .getConfiguration("svn.sparse")
          .update("confirmExclude", false, true);
      }
    }

    // Build repo map for status suppression
    const repoMap = new Map<string, Repository>();
    for (const node of validNodes) {
      const repo = this.sourceControlManager.getRepository(
        Uri.file(node.fullPath)
      );
      if (repo) {
        repoMap.set(node.fullPath, repo);
      }
    }

    // Suppress status updates during exclude (prevents WC lock conflicts)
    const affectedRepos = new Set(repoMap.values());
    for (const repo of affectedRepos) {
      repo.sparseDownloadInProgress = true;
    }

    try {
      // Use status bar for single items, notification for batches
      const isBatch = validNodes.length > 1;

      const result = await window.withProgress(
        {
          location: isBatch
            ? ProgressLocation.Notification
            : ProgressLocation.Window,
          title: `Excluding ${label}...`,
          cancellable: false
        },
        async progress => {
          let success = 0;
          let failed = 0;

          for (let i = 0; i < validNodes.length; i++) {
            const node = validNodes[i];
            const repo = repoMap.get(node.fullPath);
            if (!repo) {
              failed++;
              continue;
            }

            if (isBatch) {
              progress.report({
                message: `(${i + 1}/${validNodes.length}) ${path.basename(node.fullPath)}`,
                increment: 100 / validNodes.length
              });
            }

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
      window
        .showErrorMessage(`Exclude failed: ${err}`, "Show Output")
        .then(choice => {
          if (choice === "Show Output") {
            commands.executeCommand("svn.showOutputChannel");
          }
        });
    } finally {
      // Re-enable status updates after exclude completes
      for (const repo of affectedRepos) {
        repo.sparseDownloadInProgress = false;
      }
    }
  }

  public dispose(): void {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }
    dispose(this._disposables);
  }
}
