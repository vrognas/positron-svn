// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { ISvnLogEntry } from "../common/types";

/**
 * Filter criteria for log entries.
 * - path: Server-side filter via SVN target argument
 * - author: Client-side filter (SVN --search is too broad)
 * - dateFrom/dateTo: Server-side via SVN -r {date}:{date}
 * - actions: Client-side filter by file action type (A/M/D/R)
 */
export interface ILogFilter {
  author?: string;
  dateFrom?: string; // ISO date string YYYY-MM-DD
  dateTo?: string; // ISO date string YYYY-MM-DD
  path?: string; // Path pattern (relative from repo root)
  actions?: string[]; // Action types: A=Added, M=Modified, D=Deleted, R=Replaced
}

/** Action type labels for UI */
export const ACTION_LABELS: Record<string, string> = {
  A: "Added",
  M: "Modified",
  D: "Deleted",
  R: "Replaced"
};

/**
 * Filter log entries client-side.
 * - Author filtering must be done client-side (SVN --search is too broad)
 * - Date/path filtering is done server-side but may need client verification
 */
export function filterLogEntries(
  entries: ISvnLogEntry[],
  filter: ILogFilter
): ISvnLogEntry[] {
  return entries.filter(entry => {
    // Author filter (case-insensitive)
    if (filter.author) {
      if (
        !entry.author ||
        entry.author.toLowerCase() !== filter.author.toLowerCase()
      ) {
        return false;
      }
    }

    // Date range filter (client-side verification after SVN fetch)
    if (filter.dateFrom) {
      if (!entry.date) return false;
      const entryDate = new Date(entry.date);
      if (isNaN(entryDate.getTime())) return false;
      const fromDate = new Date(filter.dateFrom);
      if (entryDate < fromDate) {
        return false;
      }
    }
    if (filter.dateTo) {
      if (!entry.date) return false;
      const entryDate = new Date(entry.date);
      if (isNaN(entryDate.getTime())) return false;
      // dateTo is inclusive - add 1 day to include full day
      const toDate = new Date(filter.dateTo);
      toDate.setDate(toDate.getDate() + 1);
      if (entryDate >= toDate) {
        return false;
      }
    }

    // Path filter - check if any path in commit matches pattern
    if (filter.path) {
      const pathPattern = filter.path.toLowerCase();
      const hasMatchingPath = entry.paths.some(
        p => p._ && p._.toLowerCase().includes(pathPattern)
      );
      if (!hasMatchingPath) {
        return false;
      }
    }

    // Action filter - check if any path in commit has matching action
    if (filter.actions && filter.actions.length > 0) {
      const hasMatchingAction = entry.paths.some(
        p => p.action && filter.actions!.includes(p.action)
      );
      if (!hasMatchingAction) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Check if any filter is active
 */
export function hasActiveFilter(filter?: ILogFilter): boolean {
  if (!filter) return false;
  return !!(
    filter.author ||
    filter.dateFrom ||
    filter.dateTo ||
    filter.path ||
    (filter.actions && filter.actions.length > 0)
  );
}

/**
 * Get a human-readable summary of active filters
 */
export function getFilterSummary(filter?: ILogFilter): string {
  if (!filter || !hasActiveFilter(filter)) {
    return "";
  }

  const parts: string[] = [];
  if (filter.author) {
    parts.push(`author:${filter.author}`);
  }
  if (filter.dateFrom && filter.dateTo) {
    parts.push(`${filter.dateFrom} to ${filter.dateTo}`);
  } else if (filter.dateFrom) {
    parts.push(`from ${filter.dateFrom}`);
  } else if (filter.dateTo) {
    parts.push(`until ${filter.dateTo}`);
  }
  if (filter.path) {
    parts.push(`path:${filter.path}`);
  }
  if (filter.actions && filter.actions.length > 0) {
    const labels = filter.actions.map(a => ACTION_LABELS[a] || a);
    parts.push(labels.join("+"));
  }
  return parts.join(" | ");
}
