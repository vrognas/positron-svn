// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { Disposable, Uri } from "vscode";

/**
 * Reserved SVN changelist name for staging.
 * Using double underscore prefix to avoid collision with user changelists.
 */
export const STAGING_CHANGELIST = "__staged__";

/**
 * Service to track staged files for commit.
 * Uses SVN changelists under the hood for persistence.
 *
 * The actual staging is done via SVN changelist commands in Repository:
 * - Stage: repository.addChangelist(files, STAGING_CHANGELIST)
 * - Unstage: repository.removeChangelist(files) or addChangelist(files, originalChangelist)
 *
 * This service maintains a cache of staged paths from status results
 * for fast UI lookups without needing SVN queries.
 *
 * Also tracks original changelists so files can be restored on unstage.
 */
export class StagingService implements Disposable {
  private _stagedPaths = new Set<string>();
  /** Maps file path → original changelist name (before staging) */
  private _originalChangelists = new Map<string, string>();

  constructor() {}

  /**
   * Sync staged paths from SVN status result.
   * Called by ResourceGroupManager after status refresh.
   * @param paths File paths from the __staged__ changelist
   */
  syncFromChangelist(paths: string[]): void {
    this._stagedPaths.clear();
    for (const path of paths) {
      this._stagedPaths.add(this.normalizePath(path));
    }
  }

  /**
   * Check if a file is staged (from cache)
   */
  isStaged(uri: Uri | string): boolean {
    const path = typeof uri === "string" ? uri : uri.fsPath;
    return this._stagedPaths.has(this.normalizePath(path));
  }

  /**
   * Get all staged file paths
   */
  getStagedPaths(): string[] {
    return Array.from(this._stagedPaths);
  }

  /**
   * Get count of staged files
   */
  get stagedCount(): number {
    return this._stagedPaths.size;
  }

  /**
   * Save original changelist before staging.
   * Called by stage command when file has existing changelist.
   */
  saveOriginalChangelist(path: string, changelist: string): void {
    this._originalChangelists.set(this.normalizePath(path), changelist);
  }

  /**
   * Get original changelist for a staged file.
   * Returns undefined if file had no changelist before staging.
   */
  getOriginalChangelist(path: string): string | undefined {
    return this._originalChangelists.get(this.normalizePath(path));
  }

  /**
   * Clear original changelist tracking for paths.
   * Called after unstage or commit.
   */
  clearOriginalChangelists(paths: string[]): void {
    for (const path of paths) {
      this._originalChangelists.delete(this.normalizePath(path));
    }
  }

  /**
   * Normalize path for consistent comparison
   */
  private normalizePath(path: string): string {
    return path.replace(/\\/g, "/");
  }

  dispose(): void {
    this._stagedPaths.clear();
    this._originalChangelists.clear();
  }
}
