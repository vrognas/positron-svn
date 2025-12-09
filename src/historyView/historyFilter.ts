// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { Disposable, Event, EventEmitter } from "vscode";
import { ISvnLogEntry } from "../common/types";

/**
 * Action types for file changes in SVN commits
 * A = Added (new file, no history)
 * A+ = Added with history (rename/copy - has copyfromPath)
 * M = Modified
 * D = Deleted
 * R = Replaced (delete+add at same path, history broken)
 */
export type ActionType = "A" | "A+" | "M" | "D" | "R";

/**
 * Filter criteria for SVN history
 */
export interface IHistoryFilter {
  /** Filter by commit message text (SVN --search) */
  message?: string;
  /** Filter by file/folder path pattern (SVN --search) */
  path?: string;
  /** Filter by author name (SVN --search) */
  author?: string;
  /** Revision range start (inclusive) */
  revisionFrom?: number;
  /** Revision range end (inclusive) */
  revisionTo?: number;
  /** Date range start (inclusive) */
  dateFrom?: Date;
  /** Date range end (inclusive) */
  dateTo?: Date;
  /** Filter by action types - client-side only */
  actions?: ActionType[];
}

/**
 * Cache entry for filtered results
 */
interface FilterCacheEntry {
  key: string;
  entries: ISvnLogEntry[];
  accessTime: number;
}

const MAX_FILTER_CACHE_SIZE = 50;

/**
 * Service to manage history filter state and caching
 */
export class HistoryFilterService implements Disposable {
  private _filter?: IHistoryFilter;
  private _onDidChangeFilter = new EventEmitter<IHistoryFilter | undefined>();
  private _cache = new Map<string, FilterCacheEntry>();
  private _disposables: Disposable[] = [];

  public readonly onDidChangeFilter: Event<IHistoryFilter | undefined> =
    this._onDidChangeFilter.event;

  constructor() {
    this._disposables.push(this._onDidChangeFilter);
  }

  /**
   * Get the current filter
   */
  public getFilter(): IHistoryFilter | undefined {
    return this._filter;
  }

  /**
   * Set a new filter, replacing any existing filter
   */
  public setFilter(filter: IHistoryFilter): void {
    this._filter = filter;
    this.clearCache();
    this._onDidChangeFilter.fire(filter);
  }

  /**
   * Update specific fields of the current filter
   */
  public updateFilter(partial: Partial<IHistoryFilter>): void {
    this._filter = { ...this._filter, ...partial };
    this.clearCache();
    this._onDidChangeFilter.fire(this._filter);
  }

  /**
   * Clear the current filter
   */
  public clearFilter(): void {
    this._filter = undefined;
    this.clearCache();
    this._onDidChangeFilter.fire(undefined);
  }

  /**
   * Check if any filter is active
   */
  public hasActiveFilter(): boolean {
    if (!this._filter) return false;
    return Object.values(this._filter).some(
      v =>
        v !== undefined &&
        v !== null &&
        (Array.isArray(v) ? v.length > 0 : true)
    );
  }

  /**
   * Get a human-readable description of the active filter
   */
  public getFilterDescription(): string {
    if (!this._filter) return "";

    const parts: string[] = [];
    if (this._filter.message) parts.push(`message: "${this._filter.message}"`);
    if (this._filter.author) parts.push(`author: "${this._filter.author}"`);
    if (this._filter.path) parts.push(`path: "${this._filter.path}"`);
    if (this._filter.revisionFrom || this._filter.revisionTo) {
      const from = this._filter.revisionFrom ?? "1";
      const to = this._filter.revisionTo ?? "HEAD";
      parts.push(`revision: ${from}-${to}`);
    }
    if (this._filter.dateFrom || this._filter.dateTo) {
      const from = this._filter.dateFrom?.toLocaleDateString() ?? "...";
      const to = this._filter.dateTo?.toLocaleDateString() ?? "...";
      parts.push(`date: ${from} to ${to}`);
    }
    if (this._filter.actions?.length) {
      parts.push(`actions: ${this._filter.actions.join(", ")}`);
    }

    return parts.join(" | ");
  }

  /**
   * Get a short description for tree view title (concise format)
   */
  public getShortDescription(): string {
    if (!this._filter) return "";

    const parts: string[] = [];
    const truncate = (s: string, max: number) =>
      s.length > max ? s.slice(0, max - 3) + "..." : s;

    if (this._filter.message) {
      parts.push(`msg:${truncate(this._filter.message, 15)}`);
    }
    if (this._filter.author) {
      parts.push(`author:${truncate(this._filter.author, 12)}`);
    }
    if (this._filter.path) {
      parts.push(`path:${truncate(this._filter.path, 12)}`);
    }
    if (
      this._filter.revisionFrom !== undefined ||
      this._filter.revisionTo !== undefined
    ) {
      const from = this._filter.revisionFrom ?? 1;
      const to = this._filter.revisionTo ?? "HEAD";
      parts.push(`rev:${from}-${to}`);
    }
    if (this._filter.dateFrom || this._filter.dateTo) {
      const fmt = (d: Date) => d.toISOString().split("T")[0];
      const from = this._filter.dateFrom ? fmt(this._filter.dateFrom) : "...";
      const to = this._filter.dateTo ? fmt(this._filter.dateTo) : "...";
      parts.push(`date:${from}~${to}`);
    }
    if (this._filter.actions?.length) {
      parts.push(`actions:${this._filter.actions.join(",")}`);
    }

    return parts.join(" ");
  }

  /**
   * Filter entries with caching (client-side filtering for cached data)
   */
  public filterEntries(
    entries: ISvnLogEntry[],
    filter: IHistoryFilter
  ): ISvnLogEntry[] {
    const cacheKey = this.createCacheKey(filter);

    // Check cache
    const cached = this._cache.get(cacheKey);
    if (cached) {
      cached.accessTime = Date.now();
      return cached.entries;
    }

    // Apply client-side filtering
    let result = entries;

    // Filter by author (case-insensitive)
    if (filter.author) {
      const authorLower = filter.author.toLowerCase();
      result = result.filter(e =>
        e.author?.toLowerCase().includes(authorLower)
      );
    }

    // Filter by message (case-insensitive)
    if (filter.message) {
      const msgLower = filter.message.toLowerCase();
      result = result.filter(e => e.msg?.toLowerCase().includes(msgLower));
    }

    // Filter by path (case-insensitive)
    if (filter.path) {
      const pathLower = filter.path.toLowerCase();
      result = result.filter(e =>
        e.paths?.some(p => p._?.toLowerCase().includes(pathLower))
      );
    }

    // Filter by revision range
    if (filter.revisionFrom !== undefined || filter.revisionTo !== undefined) {
      const from = filter.revisionFrom ?? 1;
      const to = filter.revisionTo ?? Number.MAX_SAFE_INTEGER;
      result = result.filter(e => {
        const rev = parseInt(e.revision, 10);
        return rev >= from && rev <= to;
      });
    }

    // Filter by date range
    if (filter.dateFrom || filter.dateTo) {
      const fromTime = filter.dateFrom?.getTime() ?? 0;
      const toTime = filter.dateTo?.getTime() ?? Date.now();
      result = result.filter(e => {
        const entryTime = new Date(e.date).getTime();
        return entryTime >= fromTime && entryTime <= toTime;
      });
    }

    // Filter by action types
    if (filter.actions?.length) {
      result = filterEntriesByAction(result, filter.actions);
    }

    // Store in cache
    this.addToCache(cacheKey, result);

    return result;
  }

  /**
   * Get current cache size
   */
  public getCacheSize(): number {
    return this._cache.size;
  }

  private createCacheKey(filter: IHistoryFilter): string {
    return JSON.stringify(filter, (_, v) =>
      v instanceof Date ? v.toISOString() : v
    );
  }

  private addToCache(key: string, entries: ISvnLogEntry[]): void {
    // Evict oldest if cache is full
    if (this._cache.size >= MAX_FILTER_CACHE_SIZE) {
      this.evictOldest();
    }

    this._cache.set(key, {
      key,
      entries,
      accessTime: Date.now()
    });
  }

  private evictOldest(): void {
    let oldestKey: string | undefined;
    let oldestTime = Infinity;

    for (const [key, entry] of this._cache) {
      if (entry.accessTime < oldestTime) {
        oldestTime = entry.accessTime;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this._cache.delete(oldestKey);
    }
  }

  private clearCache(): void {
    this._cache.clear();
  }

  public dispose(): void {
    this._disposables.forEach(d => d.dispose());
    this._cache.clear();
  }
}

/**
 * Build SVN log command arguments from filter criteria
 * Returns only server-side filterable args (not action filter)
 */
export function buildSvnLogArgs(filter: IHistoryFilter): string[] {
  const args: string[] = [];

  // Text search filters (message, author, path)
  // SVN --search searches in log message, author, and paths
  if (filter.message) {
    args.push("--search", filter.message);
  }
  if (filter.author) {
    args.push("--search", filter.author);
  }
  if (filter.path) {
    args.push("--search", filter.path);
  }

  // Revision range
  if (filter.revisionFrom !== undefined || filter.revisionTo !== undefined) {
    const from = filter.revisionTo ?? "HEAD";
    const to = filter.revisionFrom ?? 1;
    args.push("-r", `${from}:${to}`);
  }

  // Date range (uses SVN {DATE} syntax)
  if (filter.dateFrom || filter.dateTo) {
    const fromDate = filter.dateFrom
      ? `{${formatSvnDate(filter.dateFrom)}}`
      : "{1970-01-01}";
    const toDate = filter.dateTo
      ? `{${formatSvnDate(filter.dateTo)}}`
      : "{" + formatSvnDate(new Date()) + "}";
    args.push("-r", `${toDate}:${fromDate}`);
  }

  // Note: actions filter is client-side only, not included here

  return args;
}

/**
 * Format date for SVN -r {DATE} syntax
 */
function formatSvnDate(date: Date): string {
  return date.toISOString().split("T")[0]!;
}

/**
 * Filter log entries by action type (client-side filtering)
 * Handles special case: A+ = Added with copyfromPath (rename/copy)
 */
export function filterEntriesByAction(
  entries: ISvnLogEntry[],
  actions: ActionType[] | undefined
): ISvnLogEntry[] {
  if (!actions || actions.length === 0) {
    return entries;
  }

  const actionSet = new Set(actions);
  const wantAddedWithHistory = actionSet.has("A+");
  const wantAddedPlain = actionSet.has("A");

  return entries.filter(entry => {
    // Keep entry if any of its paths match the action filter
    return entry.paths?.some(p => {
      const action = p.action;

      // Handle A vs A+ distinction
      if (action === "A") {
        const hasHistory = !!p.copyfromPath;
        if (hasHistory) {
          return wantAddedWithHistory; // A+ filter
        } else {
          return wantAddedPlain; // A filter
        }
      }

      // Other actions (M, D, R) - direct match
      return actionSet.has(action as ActionType);
    });
  });
}
