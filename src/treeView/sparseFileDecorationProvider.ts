// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import {
  Disposable,
  FileDecoration,
  FileDecorationProvider,
  ThemeColor,
  Uri,
  window
} from "vscode";
import { LockStatus } from "../common/types";

/**
 * Provides file decorations for selective download tree items.
 * - Ghost items (not checked out) are visually de-emphasized
 * - Outdated items (local < server revision) show update indicator
 * - Locked items show lock badge (K/O/B/T) like explorer view
 *
 * Uses svn-sparse:// scheme to prevent VS Code SCM decorations from appearing.
 */
export class SparseFileDecorationProvider
  implements FileDecorationProvider, Disposable
{
  private disposable: Disposable;

  constructor() {
    this.disposable = window.registerFileDecorationProvider(this);
  }

  dispose(): void {
    this.disposable.dispose();
  }

  provideFileDecoration(uri: Uri): FileDecoration | undefined {
    // Only handle svn-sparse scheme (prevents SCM decoration conflicts)
    if (uri.scheme !== "svn-sparse") {
      return undefined;
    }

    // Parse query params: sparse=ghost, outdated=true, lock=K/O/B/T
    const params = new URLSearchParams(uri.query);
    const isGhost = params.get("sparse") === "ghost";
    const isOutdated = params.get("outdated") === "true";
    const lockStatus = params.get("lock") as LockStatus | null;
    const lockOwner = params.get("lockOwner");

    // No decoration needed
    if (!isGhost && !isOutdated && !lockStatus) {
      return undefined;
    }

    const decoration: FileDecoration = {};

    // Ghost items: de-emphasized color
    if (isGhost) {
      decoration.color = new ThemeColor("list.deemphasizedForeground");
      decoration.tooltip = "Not downloaded (on server only)";
    }

    // Outdated items: update available indicator
    // Priority: lock badge > outdated badge (both can't be shown)
    if (isOutdated && !lockStatus) {
      decoration.badge = "↓";
      decoration.color = new ThemeColor(
        "gitDecoration.modifiedResourceForeground"
      );
      const outdatedTooltip = "Update available (server has newer revision)";
      decoration.tooltip = decoration.tooltip
        ? `${decoration.tooltip} - ${outdatedTooltip}`
        : outdatedTooltip;
    }

    // Lock badge (K/O/B/T) - same as explorer view
    if (lockStatus) {
      decoration.badge = lockStatus;
      const lockTooltip = this.getLockTooltip(lockStatus, lockOwner);
      decoration.tooltip = decoration.tooltip
        ? `${decoration.tooltip} - ${lockTooltip}`
        : lockTooltip;
    }

    return decoration;
  }

  private getLockTooltip(
    lockStatus: LockStatus,
    lockOwner: string | null
  ): string {
    switch (lockStatus) {
      case LockStatus.K:
        return "Locked by you";
      case LockStatus.O:
        return lockOwner ? `Locked by ${lockOwner}` : "Locked by others";
      case LockStatus.B:
        return "Lock broken";
      case LockStatus.T:
        return lockOwner ? `Lock stolen by ${lockOwner}` : "Lock stolen";
      default:
        return "Locked";
    }
  }
}
