// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { ISvnLogEntry } from "../common/types";

/**
 * Persistent cache for SVN revision history.
 * Since SVN history is immutable and linear, entries never need invalidation.
 * This cache grows as user loads more history and persists across filter changes.
 */
export class RevisionCache {
  // Map<repoUrl, Map<revision, entry>>
  private _cache = new Map<string, Map<string, ISvnLogEntry>>();

  /**
   * Add entries to cache. Existing entries are not overwritten.
   */
  public addEntries(repoUrl: string, entries: ISvnLogEntry[]): void {
    let repoCache = this._cache.get(repoUrl);
    if (!repoCache) {
      repoCache = new Map();
      this._cache.set(repoUrl, repoCache);
    }

    for (const entry of entries) {
      if (!repoCache.has(entry.revision)) {
        repoCache.set(entry.revision, entry);
      }
    }
  }

  /**
   * Check if revision exists in cache
   */
  public hasRevision(repoUrl: string, revision: string): boolean {
    return this._cache.get(repoUrl)?.has(revision) ?? false;
  }

  /**
   * Get single entry by revision
   */
  public getEntry(repoUrl: string, revision: string): ISvnLogEntry | undefined {
    return this._cache.get(repoUrl)?.get(revision);
  }

  /**
   * Get all cached entries for repo, sorted by revision descending
   */
  public getAllEntries(repoUrl: string): ISvnLogEntry[] {
    const repoCache = this._cache.get(repoUrl);
    if (!repoCache) return [];

    return Array.from(repoCache.values()).sort(
      (a, b) => parseInt(b.revision, 10) - parseInt(a.revision, 10)
    );
  }

  /**
   * Get entries within revision range (inclusive), sorted descending
   */
  public getEntriesInRange(
    repoUrl: string,
    fromRev: number,
    toRev: number
  ): ISvnLogEntry[] {
    const all = this.getAllEntries(repoUrl);
    return all.filter(e => {
      const rev = parseInt(e.revision, 10);
      return rev >= toRev && rev <= fromRev;
    });
  }

  /**
   * Get unique authors from cached entries
   */
  public getAuthors(repoUrl: string): string[] {
    const repoCache = this._cache.get(repoUrl);
    if (!repoCache) return [];

    const authors = new Set<string>();
    for (const entry of repoCache.values()) {
      if (entry.author) {
        authors.add(entry.author);
      }
    }
    return Array.from(authors);
  }

  /**
   * Get highest cached revision number
   */
  public getHighestRevision(repoUrl: string): number | undefined {
    const repoCache = this._cache.get(repoUrl);
    if (!repoCache || repoCache.size === 0) return undefined;

    let max = 0;
    for (const rev of repoCache.keys()) {
      const n = parseInt(rev, 10);
      if (n > max) max = n;
    }
    return max;
  }

  /**
   * Get lowest cached revision number
   */
  public getLowestRevision(repoUrl: string): number | undefined {
    const repoCache = this._cache.get(repoUrl);
    if (!repoCache || repoCache.size === 0) return undefined;

    let min = Number.MAX_SAFE_INTEGER;
    for (const rev of repoCache.keys()) {
      const n = parseInt(rev, 10);
      if (n < min) min = n;
    }
    return min;
  }

  /**
   * Get count of cached entries for repo
   */
  public getCount(repoUrl: string): number {
    return this._cache.get(repoUrl)?.size ?? 0;
  }

  /**
   * Clear cache for specific repo (rarely needed)
   */
  public clearRepo(repoUrl: string): void {
    this._cache.delete(repoUrl);
  }

  /**
   * Clear entire cache (rarely needed)
   */
  public clearAll(): void {
    this._cache.clear();
  }
}
