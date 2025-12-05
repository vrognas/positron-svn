// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

/**
 * SourceControlHistoryProvider implementation for native VS Code Graph view.
 *
 * IMPORTANT: This uses a PROPOSED API (scmHistoryProvider).
 * - May break in future VS Code versions
 * - Requires enabledApiProposals in package.json
 * - Coexists with existing TreeView (repolog) - user can use either
 *
 * SVN history is linear (each commit has exactly one parent),
 * so the graph will show a single lane with author badges.
 */

import {
  CancellationToken,
  Disposable,
  Event,
  EventEmitter,
  Uri
} from "vscode";
import { ISvnLogEntry, ISvnLogEntryPath } from "../common/types";

// ============================================================================
// Proposed API Types (not in @types/vscode)
// These match vscode.proposed.scmHistoryProvider.d.ts
// ============================================================================

/** Reference to a branch/tag/author badge */
export interface SourceControlHistoryItemRef {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly revision?: string;
  readonly category?: string;
}

/** Statistics for a history item (files changed) */
export interface SourceControlHistoryItemStatistics {
  readonly files: number;
  readonly insertions?: number;
  readonly deletions?: number;
}

/** A single history item (commit) */
export interface SourceControlHistoryItem {
  readonly id: string;
  readonly parentIds: string[];
  readonly subject: string;
  readonly message: string;
  readonly displayId?: string;
  readonly author?: string;
  readonly timestamp?: number;
  readonly statistics?: SourceControlHistoryItemStatistics;
  readonly references?: SourceControlHistoryItemRef[];
}

/** A file change within a history item */
export interface SourceControlHistoryItemChange {
  readonly uri: Uri;
  readonly originalUri?: Uri;
  readonly modifiedUri?: Uri;
  readonly renameUri?: Uri;
}

/** Options for querying history */
export interface SourceControlHistoryOptions {
  readonly skip?: number;
  readonly limit?: number | { id?: string };
  readonly historyItemRefs?: readonly string[];
}

/** The provider interface (proposed API) */
export interface SourceControlHistoryProvider {
  readonly currentHistoryItemRef?: SourceControlHistoryItemRef;
  readonly currentHistoryItemRemoteRef?: SourceControlHistoryItemRef;
  readonly currentHistoryItemBaseRef?: SourceControlHistoryItemRef;
  readonly onDidChangeCurrentHistoryItemRefs?: Event<void>;
  // VS Code requires this event for the Graph view to work
  readonly onDidChangeHistoryItemRefs?: Event<SourceControlHistoryItemRefsChangeEvent>;

  provideHistoryItems(
    options: SourceControlHistoryOptions,
    token: CancellationToken
  ): Promise<SourceControlHistoryItem[]>;

  provideHistoryItemChanges?(
    historyItemId: string,
    historyItemParentId: string | undefined,
    token: CancellationToken
  ): Promise<SourceControlHistoryItemChange[]>;
}

/** Event for history item refs changes */
export interface SourceControlHistoryItemRefsChangeEvent {
  readonly added: readonly SourceControlHistoryItemRef[];
  readonly removed: readonly SourceControlHistoryItemRef[];
  readonly modified: readonly SourceControlHistoryItemRef[];
  readonly silent?: boolean;
}

// ============================================================================
// Mapping Functions (exported for testing)
// ============================================================================

/**
 * Create an author reference badge for display in the graph.
 */
export function createAuthorReference(
  author: string
): SourceControlHistoryItemRef {
  return {
    id: `author/${author}`,
    name: author,
    category: "authors"
  };
}

/**
 * Calculate file statistics from path changes.
 */
export function calculateStatistics(
  paths: ISvnLogEntryPath[] | undefined
): SourceControlHistoryItemStatistics {
  if (!paths) {
    return { files: 0 };
  }
  return { files: paths.length };
}

/**
 * Extract subject (first line) from commit message.
 */
function extractSubject(message: string): string {
  if (!message) {
    return "";
  }
  return message.split(/\r?\n/, 1)[0] || "";
}

/**
 * Map an SVN log entry to a SourceControlHistoryItem.
 */
export function mapLogEntryToHistoryItem(
  entry: ISvnLogEntry,
  parentIds: string[]
): SourceControlHistoryItem {
  const subject = extractSubject(entry.msg);
  const timestamp = entry.date ? new Date(entry.date).getTime() : undefined;
  const statistics = calculateStatistics(entry.paths);
  const references: SourceControlHistoryItemRef[] = [];

  // Add author as reference badge
  if (entry.author) {
    references.push(createAuthorReference(entry.author));
  }

  return {
    id: `r${entry.revision}`,
    displayId: `r${entry.revision}`,
    parentIds,
    subject,
    message: entry.msg || "",
    author: entry.author,
    timestamp,
    statistics,
    references: references.length > 0 ? references : undefined
  };
}

// ============================================================================
// Repository Interface (minimal, to avoid circular deps)
// ============================================================================

interface IHistoryRepository {
  readonly branchRoot: Uri;
  log(
    rfrom: string,
    rto: string,
    limit: number,
    target?: string | Uri
  ): Promise<ISvnLogEntry[]>;
}

// ============================================================================
// SvnHistoryProvider Implementation
// ============================================================================

/**
 * Provides SVN history to VS Code's native Graph view.
 *
 * This is a PROPOSED API and may change in future VS Code versions.
 * The extension gracefully degrades if the API is not available.
 */
export class SvnHistoryProvider
  implements SourceControlHistoryProvider, Disposable
{
  private _onDidChangeCurrentHistoryItemRefs = new EventEmitter<void>();
  readonly onDidChangeCurrentHistoryItemRefs =
    this._onDidChangeCurrentHistoryItemRefs.event;

  // VS Code requires this event for the Graph view to refresh
  private _onDidChangeHistoryItemRefs =
    new EventEmitter<SourceControlHistoryItemRefsChangeEvent>();
  readonly onDidChangeHistoryItemRefs = this._onDidChangeHistoryItemRefs.event;

  private disposables: Disposable[] = [];

  // Current ref points to HEAD
  readonly currentHistoryItemRef: SourceControlHistoryItemRef = {
    id: "HEAD",
    name: "HEAD",
    description: "Latest revision"
  };

  constructor(private repository: IHistoryRepository) {
    this.disposables.push(this._onDidChangeCurrentHistoryItemRefs);
    this.disposables.push(this._onDidChangeHistoryItemRefs);
  }

  /**
   * Provide history items for the graph view.
   */
  async provideHistoryItems(
    options: SourceControlHistoryOptions,
    token: CancellationToken
  ): Promise<SourceControlHistoryItem[]> {
    const limit = typeof options.limit === "number" ? options.limit : 50;
    const skip = options.skip ?? 0;

    try {
      // Fetch one extra entry to determine the parent of the last displayed entry
      const entries = await this.repository.log(
        "HEAD",
        "1",
        limit + skip + 1,
        this.repository.branchRoot
      );

      if (token.isCancellationRequested) {
        return [];
      }

      // Apply skip, keep limit+1 to have parent info for last entry
      const withExtra = entries.slice(skip, skip + limit + 1);

      // Map to history items (only return `limit` items, use extra for parent)
      const result: SourceControlHistoryItem[] = [];
      for (let i = 0; i < Math.min(withExtra.length, limit); i++) {
        const entry = withExtra[i]!;
        const nextEntry = withExtra[i + 1];
        // Parent is the next entry in the log (older revision)
        // because SVN log only contains revisions that touched this path
        const parentIds = nextEntry ? [`r${nextEntry.revision}`] : [];
        result.push(mapLogEntryToHistoryItem(entry, parentIds));
      }
      return result;
    } catch (error) {
      // Log error but don't throw - return empty array
      console.error("SvnHistoryProvider.provideHistoryItems failed:", error);
      return [];
    }
  }

  /**
   * Provide file changes for a specific history item.
   * Optional - VS Code will show the commit without file details if not provided.
   */
  async provideHistoryItemChanges(
    historyItemId: string,
    _historyItemParentId: string | undefined,
    token: CancellationToken
  ): Promise<SourceControlHistoryItemChange[]> {
    // Extract revision number from id (e.g., "r123" -> "123")
    const revMatch = historyItemId.match(/^r(\d+)$/);
    if (!revMatch) {
      return [];
    }
    const revision = revMatch[1]!;

    try {
      // Fetch single log entry with verbose paths
      const entries = await this.repository.log(
        revision,
        revision,
        1,
        this.repository.branchRoot
      );

      if (token.isCancellationRequested || entries.length === 0) {
        return [];
      }

      const entry = entries[0]!;
      if (!entry.paths) {
        return [];
      }

      // Map paths to changes
      // Use proper URI construction with svn scheme and encoded path
      return entry.paths.map(pathEntry => ({
        uri: Uri.from({
          scheme: "svn",
          path: pathEntry._,
          query: `ref=${revision}`
        })
      }));
    } catch (error) {
      console.error(
        "SvnHistoryProvider.provideHistoryItemChanges failed:",
        error
      );
      return [];
    }
  }

  /**
   * Signal that history has changed (e.g., after commit).
   */
  refresh(): void {
    this._onDidChangeCurrentHistoryItemRefs.fire();
    // Fire refs change event to trigger Graph view refresh
    this._onDidChangeHistoryItemRefs.fire({
      added: [],
      removed: [],
      modified: [],
      silent: false
    });
  }

  dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }
}

// ============================================================================
// Registration Helper
// ============================================================================

/**
 * Attempt to register the history provider with the source control.
 * Returns true if successful, false if the API is not available.
 *
 * @param sourceControl - The VS Code SourceControl instance
 * @param repository - The repository to provide history for
 * @returns The provider instance if registered, undefined otherwise
 */
export function tryRegisterHistoryProvider(
  sourceControl: unknown,
  repository: IHistoryRepository
): SvnHistoryProvider | undefined {
  try {
    // Runtime check: does sourceControl have historyProvider property?
    const sc = sourceControl as { historyProvider?: unknown };
    if (!("historyProvider" in sc)) {
      // API not available in this VS Code version
      return undefined;
    }

    const provider = new SvnHistoryProvider(repository);

    // Register the provider
    sc.historyProvider = provider;

    return provider;
  } catch (error) {
    // Silently fail - proposed API may not be available
    console.debug("SvnHistoryProvider registration failed:", error);
    return undefined;
  }
}
