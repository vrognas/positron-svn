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
      // File not in changes list - check if it has needs-lock property
      return this.getNeedsLockDecoration(uri);
    }

    const status = resource.type;

    // Don't decorate external files
    if (status === Status.EXTERNAL) {
      return undefined;
    }

    let badge = this.getBadge(status, resource.renameResourceUri);
    const color = this.getColor(status);
    let tooltip = this.getTooltip(status, resource.renameResourceUri);

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
   * Get decoration for files with svn:needs-lock property (not locked)
   */
  private async getNeedsLockDecoration(
    uri: Uri
  ): Promise<FileDecoration | undefined> {
    // Only check file scheme
    if (uri.scheme !== "file") {
      return undefined;
    }

    // Check if file is in working copy
    if (!uri.fsPath.startsWith(this.repository.workspaceRoot)) {
      return undefined;
    }

    // Check if file has needs-lock property
    const hasNeedsLock = await this.repository.hasNeedsLock(uri.fsPath);
    if (!hasNeedsLock) {
      return undefined;
    }

    return {
      badge: "🔓", // Open lock icon
      tooltip: "Needs lock - file is read-only until locked",
      propagate: false // Don't propagate to parent folders
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

  private getBadge(status: string, renameUri?: Uri): string | undefined {
    // Renamed files (added with rename source) get R badge
    if (status === Status.ADDED && renameUri) {
      return "R";
    }

    switch (status) {
      case Status.ADDED:
        return "A";
      case Status.CONFLICTED:
        return "C";
      case Status.DELETED:
        return "D";
      case Status.MODIFIED:
        return "M";
      case Status.REPLACED:
        return "R";
      case Status.UNVERSIONED:
        return "U";
      case Status.MISSING:
        return "!";
      case Status.IGNORED:
        return "I";
      default:
        return undefined;
    }
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

  private getTooltip(status: string, renameUri?: Uri): string | undefined {
    if (status === Status.ADDED && renameUri) {
      return `Renamed from ${renameUri.fsPath}`;
    }

    switch (status) {
      case Status.ADDED:
        return "Added";
      case Status.CONFLICTED:
        return "Conflicted";
      case Status.DELETED:
        return "Deleted";
      case Status.MODIFIED:
        return "Modified";
      case Status.REPLACED:
        return "Replaced";
      case Status.UNVERSIONED:
        return "Unversioned";
      case Status.MISSING:
        return "Missing";
      case Status.IGNORED:
        return "Ignored";
      default:
        return undefined;
    }
  }
}
