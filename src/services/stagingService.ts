// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { Disposable, Event, EventEmitter, Memento, Uri } from "vscode";

/**
 * Service to track staged files for commit.
 * Provides Git-like staging UX for SVN repositories.
 */
export class StagingService implements Disposable {
  private _stagedPaths = new Set<string>();
  private _onDidChange = new EventEmitter<void>();
  private _disposables: Disposable[] = [];

  readonly onDidChange: Event<void> = this._onDidChange.event;

  constructor(
    private readonly repoRoot: string,
    private readonly workspaceState?: Memento
  ) {
    // Restore staged files from workspace state
    if (workspaceState) {
      const stored = workspaceState.get<string[]>(`svn.staged.${repoRoot}`, []);
      this._stagedPaths = new Set(stored);
    }
    this._disposables.push(this._onDidChange);
  }

  /**
   * Check if a file is staged
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
   * Stage a file
   */
  stage(uri: Uri | string): void {
    const path = typeof uri === "string" ? uri : uri.fsPath;
    const normalized = this.normalizePath(path);
    if (!this._stagedPaths.has(normalized)) {
      this._stagedPaths.add(normalized);
      this.persist();
      this._onDidChange.fire();
    }
  }

  /**
   * Stage multiple files
   */
  stageAll(uris: (Uri | string)[]): void {
    let changed = false;
    for (const uri of uris) {
      const path = typeof uri === "string" ? uri : uri.fsPath;
      const normalized = this.normalizePath(path);
      if (!this._stagedPaths.has(normalized)) {
        this._stagedPaths.add(normalized);
        changed = true;
      }
    }
    if (changed) {
      this.persist();
      this._onDidChange.fire();
    }
  }

  /**
   * Unstage a file
   */
  unstage(uri: Uri | string): void {
    const path = typeof uri === "string" ? uri : uri.fsPath;
    const normalized = this.normalizePath(path);
    if (this._stagedPaths.has(normalized)) {
      this._stagedPaths.delete(normalized);
      this.persist();
      this._onDidChange.fire();
    }
  }

  /**
   * Unstage multiple files
   */
  unstageAll(uris?: (Uri | string)[]): void {
    if (!uris) {
      // Unstage everything
      if (this._stagedPaths.size > 0) {
        this._stagedPaths.clear();
        this.persist();
        this._onDidChange.fire();
      }
      return;
    }

    let changed = false;
    for (const uri of uris) {
      const path = typeof uri === "string" ? uri : uri.fsPath;
      const normalized = this.normalizePath(path);
      if (this._stagedPaths.has(normalized)) {
        this._stagedPaths.delete(normalized);
        changed = true;
      }
    }
    if (changed) {
      this.persist();
      this._onDidChange.fire();
    }
  }

  /**
   * Toggle staging for a file
   */
  toggle(uri: Uri | string): boolean {
    const path = typeof uri === "string" ? uri : uri.fsPath;
    const normalized = this.normalizePath(path);
    if (this._stagedPaths.has(normalized)) {
      this._stagedPaths.delete(normalized);
      this.persist();
      this._onDidChange.fire();
      return false;
    } else {
      this._stagedPaths.add(normalized);
      this.persist();
      this._onDidChange.fire();
      return true;
    }
  }

  /**
   * Remove paths that are no longer in the working copy
   * Called after status refresh to clean up stale staged paths
   */
  cleanupStalePaths(validPaths: Set<string>): void {
    let changed = false;
    for (const path of this._stagedPaths) {
      if (!validPaths.has(path)) {
        this._stagedPaths.delete(path);
        changed = true;
      }
    }
    if (changed) {
      this.persist();
      this._onDidChange.fire();
    }
  }

  /**
   * Clear all staged files (after commit)
   */
  clear(): void {
    if (this._stagedPaths.size > 0) {
      this._stagedPaths.clear();
      this.persist();
      this._onDidChange.fire();
    }
  }

  /**
   * Normalize path for consistent comparison
   */
  private normalizePath(path: string): string {
    return path.replace(/\\/g, "/");
  }

  /**
   * Persist to workspace state
   */
  private persist(): void {
    if (this.workspaceState) {
      this.workspaceState.update(
        `svn.staged.${this.repoRoot}`,
        Array.from(this._stagedPaths)
      );
    }
  }

  dispose(): void {
    this._disposables.forEach(d => d.dispose());
    this._disposables = [];
  }
}
