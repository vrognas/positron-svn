// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import * as fs from "fs";
import * as path from "path";
import {
  CancellationToken,
  commands,
  ProgressLocation,
  QuickPickItem,
  Uri,
  window,
  workspace
} from "vscode";
import { SvnDepth } from "../common/types";
import { Command } from "./command";
import { SourceControlManager } from "../source_control_manager";

/** Default download timeout in minutes */
const DEFAULT_DOWNLOAD_TIMEOUT_MINUTES = 10;

/** Pre-scan timeout in seconds */
const PRE_SCAN_TIMEOUT_SECONDS = 30;

/** Progress poll interval in ms */
const POLL_INTERVAL_MS = 500;

/** Max recursion depth for file counting */
const MAX_RECURSION_DEPTH = 100;

/** Smoothing factor for ETA (0-1, higher = more responsive, lower = smoother) */
const ETA_SMOOTHING_FACTOR = 0.3;

/** Minimum elapsed seconds before showing ETA (avoids wild initial estimates) */
const MIN_ELAPSED_FOR_ETA = 2;

/** Format seconds into human-readable duration */
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/** Format bytes into human-readable size */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/** Format speed in human-readable form (bytes/sec) */
function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec < 1024) return `${Math.round(bytesPerSec)} B/s`;
  if (bytesPerSec < 1024 * 1024)
    return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
  if (bytesPerSec < 1024 * 1024 * 1024)
    return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
  return `${(bytesPerSec / (1024 * 1024 * 1024)).toFixed(1)} GB/s`;
}

/** Folder statistics returned by single traversal */
interface FolderStats {
  count: number;
  size: number;
}

/**
 * Get file count and total size in a single traversal.
 * @param folderPath Path to scan
 * @param recursive If true, scan subdirectories recursively (default: true)
 */
function getFolderStats(
  folderPath: string,
  recursive = true,
  visited = new Set<string>(),
  depth = 0
): FolderStats {
  if (depth > MAX_RECURSION_DEPTH) return { count: 0, size: 0 };

  let count = 0;
  let size = 0;
  try {
    const folderStat = fs.statSync(folderPath);
    const inode = `${folderStat.dev}:${folderStat.ino}`;
    if (visited.has(inode)) return { count: 0, size: 0 };
    visited.add(inode);

    const entries = fs.readdirSync(folderPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === ".svn") continue;
      if (entry.isSymbolicLink()) continue;

      const fullPath = path.join(folderPath, entry.name);
      if (entry.isDirectory() && recursive) {
        const sub = getFolderStats(fullPath, recursive, visited, depth + 1);
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
  } catch {
    // Folder may not exist yet
  }
  return { count, size };
}

export interface DepthQuickPickItem extends QuickPickItem {
  depth: keyof typeof SvnDepth;
}

/** Checkout depth options (for restoring ghost items - no exclude option) */
export const checkoutDepthOptions: DepthQuickPickItem[] = [
  {
    label: "$(folder-opened) Full",
    description: "Download everything",
    detail: "Downloads the folder and all its contents recursively.",
    depth: "infinity"
  },
  {
    label: "$(list-tree) Shallow",
    description: "Files + empty subfolders",
    detail:
      "Downloads files and shows subfolders as empty. Good for exploring structure.",
    depth: "immediates"
  },
  {
    label: "$(file) Files Only",
    description: "Skip subfolders",
    detail: "Downloads files in this folder, but skips all subfolders.",
    depth: "files"
  },
  {
    label: "$(folder) Folder Only",
    description: "Empty placeholder",
    detail: "Keeps the folder as a placeholder but downloads no files.",
    depth: "empty"
  }
];

/** Full depth options including exclude (for setDepth command on local items) */
export const depthPickerOptions: DepthQuickPickItem[] = [
  {
    label: "$(eye-closed) Exclude",
    description: "Don't download this folder",
    detail:
      "Removes the folder and all contents locally. Use for large folders you don't need.",
    depth: "exclude"
  },
  ...checkoutDepthOptions
];

export class SetDepth extends Command {
  constructor() {
    super("svn.setDepth");
  }

  public async execute(arg?: Uri | { fullPath: string }): Promise<void> {
    // Get URI from argument (Uri from explorer, or SparseItemNode from tree)
    let uri: Uri | undefined;

    if (arg instanceof Uri) {
      uri = arg;
    } else if (arg && typeof arg === "object" && "fullPath" in arg) {
      // SparseItemNode from sparse checkout tree view
      uri = Uri.file(arg.fullPath);
    }

    if (!uri) {
      return;
    }

    // Get repository for this path
    const sourceControlManager = (await commands.executeCommand(
      "svn.getSourceControlManager",
      ""
    )) as SourceControlManager;

    const repository = sourceControlManager.getRepository(uri);
    if (!repository) {
      window.showErrorMessage("No SVN repository found for this folder");
      return;
    }

    // Get folder name for display
    const folderName = uri.fsPath.split(/[\\/]/).pop() || "folder";

    // Show QuickPick for depth selection
    const selected = await window.showQuickPick(depthPickerOptions, {
      placeHolder: "What should be downloaded for this folder?",
      title: `SVN: Sparse Checkout - ${folderName}`
    });

    if (!selected) {
      return; // User cancelled
    }

    // Confirm for destructive operations (all except infinity add content)
    if (selected.depth !== "infinity") {
      const warningMessages: Record<string, string> = {
        exclude:
          "This will remove the folder and all its contents locally. " +
          "The files still exist on the server and can be restored later.",
        empty:
          "This will remove all files and subfolders inside this folder. " +
          "The folder itself will remain as an empty placeholder.",
        files:
          "This will remove all subfolders (but keep files). " +
          "Subfolder contents can be restored later.",
        immediates:
          "This will remove contents of subfolders (keeping them as empty). " +
          "Deeper contents can be restored later."
      };

      const confirm = await window.showWarningMessage(
        warningMessages[selected.depth] ||
          "This operation may remove local files.",
        { modal: true },
        "Continue",
        "Cancel"
      );
      if (confirm !== "Continue") {
        return;
      }
    }

    // Get configurable timeout
    const timeoutMinutes = workspace
      .getConfiguration("svn.sparse")
      .get<number>("downloadTimeoutMinutes", DEFAULT_DOWNLOAD_TIMEOUT_MINUTES);
    const downloadTimeoutMs = timeoutMinutes * 60 * 1000;

    // Suppress status updates during download (prevents WC lock conflicts)
    repository.sparseDownloadInProgress = true;

    try {
      // Detect ghost folder (not locally present) - these are downloads regardless of depth
      const isGhostFolder = !fs.existsSync(uri.fsPath);

      // Download mode: ghost folder with any download depth, or infinity on local folder
      // Depths that download content: infinity, immediates, files
      // Depths that don't download: empty (placeholder only), exclude (removal)
      const downloadDepths = ["infinity", "immediates", "files"] as const;
      const isDownload = isGhostFolder
        ? downloadDepths.includes(
            selected.depth as (typeof downloadDepths)[number]
          )
        : selected.depth === "infinity";

      const result = await window.withProgress(
        {
          location: ProgressLocation.Notification,
          title: isDownload
            ? `Downloading "${folderName}"...`
            : `Setting depth for "${folderName}"...`,
          cancellable: isDownload
        },
        async (progress, token: CancellationToken) => {
          // Immediate feedback
          progress.report({
            message: isDownload ? "Starting download..." : "Preparing..."
          });

          // Check for cancellation before starting
          if (token.isCancellationRequested) {
            return { exitCode: -1, cancelled: true, stderr: "" };
          }

          let pollInterval: ReturnType<typeof setInterval> | undefined;
          let expectedFileCount = 0;
          let expectedTotalSize = 0;
          let initialFileCount = 0;
          let initialTotalSize = 0;

          try {
            if (isDownload) {
              // For downloads, pre-scan server to get expected file count and size
              // Use depth-aware listing: recursive for infinity, non-recursive for immediates/files
              progress.report({ message: `Scanning ${folderName}...` });

              try {
                const relativePath = repository.repository.removeAbsolutePath(
                  uri.fsPath
                );

                // Depth-aware pre-scan:
                // - infinity: list all files recursively
                // - immediates/files: list only direct children (non-recursive)
                const items =
                  selected.depth === "infinity"
                    ? await repository.listRecursive(
                        relativePath,
                        PRE_SCAN_TIMEOUT_SECONDS * 1000
                      )
                    : await repository.list(uri.fsPath);

                const files = items.filter(i => i.kind === "file");
                expectedFileCount = files.length;
                expectedTotalSize = files.reduce(
                  (sum, f) => sum + parseInt(f.size, 10),
                  0
                );

                if (token.isCancellationRequested) {
                  return { exitCode: -1, cancelled: true, stderr: "" };
                }

                progress.report({
                  message: `Found ${expectedFileCount} files (${formatBytes(expectedTotalSize)}) in ${folderName}`
                });
              } catch {
                expectedFileCount = 0;
                expectedTotalSize = 0;
              }

              // Start progress polling for downloads
              if (expectedFileCount > 0) {
                const startTime = Date.now();
                let smoothedSpeed = 0; // Exponential moving average
                let lastSize = 0;
                let lastTime = startTime;

                // Depth-aware polling: recursive for infinity, non-recursive for immediates/files
                const pollRecursive = selected.depth === "infinity";

                progress.report({
                  message: `Downloading ${folderName} (0/${expectedFileCount} files)...`
                });

                pollInterval = setInterval(() => {
                  if (token.isCancellationRequested) return;
                  const stats = getFolderStats(uri.fsPath, pollRecursive);
                  const pct = Math.round(
                    (stats.size / expectedTotalSize) * 100
                  );

                  // Calculate smoothed speed with exponential moving average
                  const now = Date.now();
                  const elapsed = (now - startTime) / 1000;
                  const deltaTime = (now - lastTime) / 1000;
                  const deltaSize = stats.size - lastSize;

                  if (deltaTime > 0 && deltaSize > 0) {
                    const instantSpeed = deltaSize / deltaTime;
                    smoothedSpeed =
                      smoothedSpeed === 0
                        ? instantSpeed
                        : ETA_SMOOTHING_FACTOR * instantSpeed +
                          (1 - ETA_SMOOTHING_FACTOR) * smoothedSpeed;
                  }
                  lastSize = stats.size;
                  lastTime = now;

                  // Build progress message with speed and ETA
                  let speedEtaLabel = "";
                  if (smoothedSpeed > 0) {
                    speedEtaLabel = ` ${formatSpeed(smoothedSpeed)}`;
                    // Only show ETA after minimum elapsed time
                    if (elapsed >= MIN_ELAPSED_FOR_ETA) {
                      const remaining = expectedTotalSize - stats.size;
                      if (remaining > 0) {
                        const eta = remaining / smoothedSpeed;
                        speedEtaLabel += ` ~${formatDuration(eta)}`;
                      }
                    }
                  }

                  progress.report({
                    message: `${folderName}: ${formatBytes(stats.size)}/${formatBytes(expectedTotalSize)} (${pct}%)${speedEtaLabel}`
                  });
                }, POLL_INTERVAL_MS);
              } else {
                progress.report({ message: `Downloading ${folderName}...` });
              }
            } else {
              // For removals (exclude, empty, files, immediates), count existing files
              const initialStats = getFolderStats(uri.fsPath);
              initialFileCount = initialStats.count;
              initialTotalSize = initialStats.size;

              if (initialFileCount > 0) {
                const startTime = Date.now();
                let smoothedSpeed = 0;
                let lastRemovedSize = 0;
                let lastTime = startTime;

                const actionLabel =
                  selected.depth === "exclude" ? "Excluding" : "Removing files";
                progress.report({
                  message: `${actionLabel} ${initialFileCount} files (${formatBytes(initialTotalSize)})...`
                });

                pollInterval = setInterval(() => {
                  const stats = getFolderStats(uri.fsPath);
                  const removedSize = initialTotalSize - stats.size;
                  const pct = Math.round(
                    (removedSize / initialTotalSize) * 100
                  );

                  // Calculate smoothed speed with exponential moving average
                  const now = Date.now();
                  const elapsed = (now - startTime) / 1000;
                  const deltaTime = (now - lastTime) / 1000;
                  const deltaRemoved = removedSize - lastRemovedSize;

                  if (deltaTime > 0 && deltaRemoved > 0) {
                    const instantSpeed = deltaRemoved / deltaTime;
                    smoothedSpeed =
                      smoothedSpeed === 0
                        ? instantSpeed
                        : ETA_SMOOTHING_FACTOR * instantSpeed +
                          (1 - ETA_SMOOTHING_FACTOR) * smoothedSpeed;
                  }
                  lastRemovedSize = removedSize;
                  lastTime = now;

                  if (removedSize > 0) {
                    // Build progress message with speed and ETA
                    let speedEtaLabel = "";
                    if (smoothedSpeed > 0) {
                      speedEtaLabel = ` ${formatSpeed(smoothedSpeed)}`;
                      // Only show ETA after minimum elapsed time
                      if (elapsed >= MIN_ELAPSED_FOR_ETA && stats.size > 0) {
                        const eta = stats.size / smoothedSpeed;
                        speedEtaLabel += ` ~${formatDuration(eta)}`;
                      }
                    }

                    progress.report({
                      message: `${actionLabel}: ${formatBytes(removedSize)}/${formatBytes(initialTotalSize)} (${pct}%)${speedEtaLabel}`
                    });
                  }
                }, POLL_INTERVAL_MS);
              } else {
                progress.report({ message: "Applying changes..." });
              }
            }

            const res = await repository.setDepth(uri.fsPath, selected.depth, {
              parents: true,
              timeout: downloadTimeoutMs
            });

            if (token.isCancellationRequested) {
              return { ...res, cancelled: true };
            }

            return { ...res, cancelled: false };
          } catch (err) {
            return {
              exitCode: 1,
              cancelled: token.isCancellationRequested,
              stderr: String(err)
            };
          } finally {
            if (pollInterval) {
              clearInterval(pollInterval);
            }
          }
        }
      );

      if (result.cancelled) {
        window.showInformationMessage(`Operation cancelled`);
        return;
      }

      if (result.exitCode === 0) {
        const successMessages: Record<string, string> = {
          exclude: `"${folderName}" excluded`,
          empty: `"${folderName}" contents removed (folder kept)`,
          files: `"${folderName}" set to files only`,
          immediates: `"${folderName}" set to shallow`,
          infinity: `"${folderName}" fully restored`
        };
        window.showInformationMessage(
          successMessages[selected.depth] || `Checkout depth changed`
        );
        // Refresh sparse checkout tree to reflect changes
        commands.executeCommand("svn.sparse.refresh");
      } else {
        window.showErrorMessage(
          `Failed to change checkout: ${result.stderr || "Unknown error"}`
        );
      }
    } catch (error) {
      window.showErrorMessage(`Failed to change checkout: ${error}`);
    } finally {
      // Re-enable status updates
      repository.sparseDownloadInProgress = false;
    }
  }
}
