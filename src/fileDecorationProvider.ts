// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import {
  Disposable,
  EventEmitter,
  FileDecoration,
  FileDecorationProvider,
  ThemeColor,
  Uri
} from "vscode";
import { LockStatus, Status } from "./common/types";
import { Repository } from "./repository";

/**
 * Provides file decorations (badges and colors) for SVN-tracked files in Explorer view
 */
export class SvnFileDecorationProvider
  implements FileDecorationProvider, Disposable
{
  private _onDidChangeFileDecorations = new EventEmitter<
    Uri | Uri[] | undefined
  >();
  readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;
  private disposables: Disposable[] = [];

  constructor(private repository: Repository) {
    this.disposables.push(this._onDidChangeFileDecorations);
  }

  dispose(): void {
    this.disposables.forEach(d => d.dispose());
  }

  /**
   * Provide decoration for a file URI
   */
  async provideFileDecoration(uri: Uri): Promise<FileDecoration | undefined> {
    // Check for BASE commit decoration (from repo/item log)
    if (uri.scheme === "svn-commit") {
      const queryParams = new URLSearchParams(uri.query);
      if (queryParams.get("isBase") === "true") {
        return {
          badge: "B",
          tooltip: "Your working copy's BASE revision",
          color: new ThemeColor("charts.green")
        };
      }
      return undefined;
    }

    // Check if this is a historical file from repository log (has action query param)
    const queryParams = new URLSearchParams(uri.query);
    const action = queryParams.get("action");

    if (action) {
      // Historical file from repository log - use action directly
      const status = this.actionToStatus(action);
      if (!status) {
        return undefined;
      }

      const badge = this.getBadge(status, undefined);
      const color = this.getColor(status);
      const tooltip = this.getTooltip(status, undefined);

      if (!badge && !color) {
        return undefined;
      }

      return {
        badge,
        tooltip,
        color,
        propagate: true
      };
    }

    // Look up file status from repository (current working copy)
    const resource = this.repository.getResourceFromFile(uri.fsPath);

    if (!resource) {
      // File not in changes list - check if needs-lock (from batch cache)
      return this.getNeedsLockDecoration(uri);
    }

    const status = resource.type;

    // Don't decorate external files
    if (status === Status.EXTERNAL) {
      return undefined;
    }

    const isFolder = resource.kind === "dir";
    let badge = this.getBadge(status, resource.renameResourceUri, isFolder);
    const color = this.getColor(status);
    let tooltip = this.getTooltip(status, resource.renameResourceUri, isFolder);

    // Add lock info to tooltip and badge (K/O/B/T per SVN convention)
    if (resource.lockStatus) {
      const lockInfo = this.getLockTooltip(
        resource.lockStatus,
        resource.lockOwner
      );
      tooltip = tooltip ? `${tooltip} (${lockInfo})` : lockInfo;
      // Show lock badge if no other badge
      if (!badge) {
        badge = resource.lockStatus;
      }
    } else if (resource.locked) {
      // Fallback for legacy lock detection without lockStatus
      const lockInfo = resource.hasLockToken
        ? "Locked by you"
        : resource.lockOwner
          ? `Locked by ${resource.lockOwner}`
          : "Locked by others";
      tooltip = tooltip ? `${tooltip} (${lockInfo})` : lockInfo;
      if (!badge) {
        badge = resource.hasLockToken ? "K" : "O";
      }
    }

    if (!badge && !color) {
      // No status decoration - check if needs-lock
      return this.getNeedsLockDecoration(uri);
    }

    return {
      badge,
      tooltip,
      color,
      propagate: true // Show on parent folders like Git
    };
  }

  /**
   * Get decoration for files with svn:needs-lock property (not locked).
   * Uses batch-populated cache - no SVN calls.
   */
  private getNeedsLockDecoration(uri: Uri): FileDecoration | undefined {
    // Only check file scheme
    if (uri.scheme !== "file") {
      return undefined;
    }

    // Check if file is in working copy
    if (!uri.fsPath.startsWith(this.repository.workspaceRoot)) {
      return undefined;
    }

    // Check batch cache (sync, no SVN call)
    if (!this.repository.hasNeedsLockCached(uri.fsPath)) {
      return undefined;
    }

    return {
      badge: "🔓",
      tooltip: "Needs lock - file is read-only until locked",
      propagate: false
    };
  }

  /**
   * Refresh decorations for changed files
   */
  refresh(uris?: Uri | Uri[]): void {
    // Fire with undefined to refresh all, or specific URIs to refresh those
    // Note: empty array [] means refresh nothing, undefined means refresh all
    this._onDidChangeFileDecorations.fire(uris);
  }

  /**
   * Convert repository log action to Status constant
   */
  private actionToStatus(action: string): string | undefined {
    switch (action) {
      case "A":
        return Status.ADDED;
      case "M":
        return Status.MODIFIED;
      case "D":
        return Status.DELETED;
      case "R":
        return Status.REPLACED;
      default:
        return undefined;
    }
  }

  private getBadge(
    status: string,
    renameUri?: Uri,
    isFolder: boolean = false
  ): string | undefined {
    // Renamed files/folders (added with rename source) get R/📁R badge
    if (status === Status.ADDED && renameUri) {
      return isFolder ? "📁R" : "R";
    }

    let badge: string | undefined;
    switch (status) {
      case Status.ADDED:
        badge = "A";
        break;
      case Status.CONFLICTED:
        badge = "C";
        break;
      case Status.DELETED:
        badge = "D";
        break;
      case Status.MODIFIED:
        badge = "M";
        break;
      case Status.REPLACED:
        badge = "R";
        break;
      case Status.UNVERSIONED:
        badge = "U";
        break;
      case Status.MISSING:
        badge = "!";
        break;
      case Status.IGNORED:
        badge = "I";
        break;
      default:
        return undefined;
    }

    // Prefix with folder emoji for folders (📁A, 📁M, 📁D, etc.)
    return isFolder ? `📁${badge}` : badge;
  }

  private getColor(status: string): ThemeColor | undefined {
    switch (status) {
      case Status.MODIFIED:
      case Status.REPLACED:
        return new ThemeColor("gitDecoration.modifiedResourceForeground");
      case Status.DELETED:
      case Status.MISSING:
        return new ThemeColor("gitDecoration.deletedResourceForeground");
      case Status.ADDED:
      case Status.UNVERSIONED:
        return new ThemeColor("gitDecoration.untrackedResourceForeground");
      case Status.IGNORED:
        return new ThemeColor("gitDecoration.ignoredResourceForeground");
      case Status.CONFLICTED:
        return new ThemeColor("gitDecoration.conflictingResourceForeground");
      default:
        return undefined;
    }
  }

  private getLockTooltip(lockStatus: LockStatus, lockOwner?: string): string {
    switch (lockStatus) {
      case LockStatus.K:
        return "Locked by you";
      case LockStatus.O:
        return lockOwner ? `Locked by ${lockOwner}` : "Locked by others";
      case LockStatus.B:
        return "Lock broken (your lock was removed)";
      case LockStatus.T:
        return lockOwner
          ? `Lock stolen by ${lockOwner}`
          : "Lock stolen by another user";
    }
  }

  private getTooltip(
    status: string,
    renameUri?: Uri,
    isFolder: boolean = false
  ): string | undefined {
    const prefix = isFolder ? "Folder " : "";

    if (status === Status.ADDED && renameUri) {
      return `${prefix}Renamed from ${renameUri.fsPath}`;
    }

    switch (status) {
      case Status.ADDED:
        return `${prefix}Added`;
      case Status.CONFLICTED:
        return `${prefix}Conflicted`;
      case Status.DELETED:
        return `${prefix}Deleted`;
      case Status.MODIFIED:
        return `${prefix}Modified`;
      case Status.REPLACED:
        return `${prefix}Replaced`;
      case Status.UNVERSIONED:
        return `${prefix}Unversioned`;
      case Status.MISSING:
        return `${prefix}Missing`;
      case Status.IGNORED:
        return `${prefix}Ignored`;
      default:
        return undefined;
    }
  }
}
