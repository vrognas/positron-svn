// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import {
  FileSystemProvider,
  workspace,
  Disposable,
  FileStat,
  Uri,
  FileSystemError,
  FileType,
  FileChangeEvent,
  EventEmitter,
  Event,
  window,
  FileChangeType
} from "vscode";
import { SourceControlManager } from "./source_control_manager";
import { fromSvnUri } from "./uri";
import { SvnUriAction, RepositoryChangeEvent } from "./common/types";
import { debounce, throttle } from "./decorators";
import {
  filterEvent,
  eventToPromise,
  isDescendant,
  pathEquals,
  EmptyDisposable
} from "./util";
import { logError } from "./util/errorLogger";

const THREE_MINUTES = 1000 * 60 * 3;
const FIVE_MINUTES = 1000 * 60 * 5;

interface CacheRow {
  uri: Uri;
  timestamp: number;
}

export class SvnFileSystemProvider implements FileSystemProvider, Disposable {
  private disposables: Disposable[] = [];
  private cache = new Map<string, CacheRow>();
  private cleanupInterval?: ReturnType<typeof setInterval>;

  private _onDidChangeFile = new EventEmitter<FileChangeEvent[]>();
  readonly onDidChangeFile: Event<FileChangeEvent[]> =
    this._onDidChangeFile.event;

  private changedRepositoryRoots = new Set<string>();

  constructor(private sourceControlManager: SourceControlManager) {
    this.disposables.push(
      sourceControlManager.onDidChangeRepository(
        this.onDidChangeRepository,
        this
      ),
      workspace.registerFileSystemProvider("svn", this, {
        isReadonly: true,
        isCaseSensitive: true
      })
    );

    this.cleanupInterval = setInterval(() => this.cleanup(), FIVE_MINUTES);
  }

  private onDidChangeRepository({ repository }: RepositoryChangeEvent): void {
    this.changedRepositoryRoots.add(repository.root);
    this.eventuallyFireChangeEvents();
  }

  @debounce(1100)
  private eventuallyFireChangeEvents(): void {
    this.fireChangeEvents();
  }

  @throttle
  private async fireChangeEvents(): Promise<void> {
    if (!window.state.focused) {
      const onDidFocusWindow = filterEvent(
        window.onDidChangeWindowState,
        e => e.focused
      );
      await eventToPromise(onDidFocusWindow);
    }

    const events: FileChangeEvent[] = [];

    for (const { uri } of this.cache.values()) {
      const fsPath = uri.fsPath;

      for (const root of this.changedRepositoryRoots) {
        if (isDescendant(root, fsPath)) {
          events.push({ type: FileChangeType.Changed, uri });
          break;
        }
      }
    }

    if (events.length > 0) {
      this._onDidChangeFile.fire(events);
    }

    this.changedRepositoryRoots.clear();
  }

  watch(): Disposable {
    return EmptyDisposable;
  }

  async stat(uri: Uri): Promise<FileStat> {
    try {
      await this.sourceControlManager.isInitialized;

      const { fsPath } = fromSvnUri(uri);

      // For virtual SVN files, be lenient - return default stats if repository
      // not found yet. Let readFile() handle the actual error. This prevents
      // false FileNotFound during async repository discovery.
      const repository = this.sourceControlManager.getRepository(fsPath);

      let size = 0;
      let mtime = new Date().getTime();

      if (repository) {
        try {
          const listResults = await repository.list(fsPath);

          if (listResults.length) {
            size = Number(listResults[0]!.size) as number;
            mtime = Date.parse(listResults[0]!.commit.date);
          }
        } catch (error) {
          // Suppress "node not found" errors for untracked files (expected)
          const isUntrackedFile =
            typeof error === "object" &&
            error !== null &&
            "stderr" in error &&
            typeof error.stderr === "string" &&
            error.stderr.includes("W155010");
          if (!isUntrackedFile) {
            logError("Failed to list SVN file", error);
          }
        }
      }

      return { type: FileType.File, size, mtime, ctime: 0 };
    } catch (error) {
      // Re-throw FileSystemErrors as-is
      if (error instanceof FileSystemError) {
        throw error;
      }
      // Wrap other errors
      logError("stat failed", error);
      throw FileSystemError.Unavailable(
        error instanceof Error ? error.message : "Failed to stat file"
      );
    }
  }

  readDirectory(): Thenable<[string, FileType][]> {
    throw new Error("readDirectory is not implemented");
  }

  createDirectory(): void {
    throw new Error("createDirectory is not implemented");
  }

  async readFile(uri: Uri): Promise<Uint8Array> {
    try {
      await this.sourceControlManager.isInitialized;

      const { fsPath, extra, action } = fromSvnUri(uri);

      // Try multiple methods to find the repository
      let repository = this.sourceControlManager.getRepository(fsPath);

      // Fallback: try getRepositoryFromUri which may use different lookup
      if (!repository && fsPath) {
        repository = await this.sourceControlManager.getRepositoryFromUri(
          Uri.file(fsPath)
        );
      }

      if (!repository) {
        // Debug: show URI and parsed data for diagnosis
        const repos = this.sourceControlManager.repositories;
        const roots = repos.map(r => r.workspaceRoot).join("; ");
        throw FileSystemError.Unavailable(
          `fsPath: ${fsPath || "(empty)"} | query: ${uri.query?.slice(0, 100) || "(none)"} | roots: ${roots || "(none)"}`
        );
      }

      const cacheKey = uri.toString();
      const timestamp = new Date().getTime();
      const cacheValue: CacheRow = { uri: uri, timestamp };

      this.cache.set(cacheKey, cacheValue);

      if (action === SvnUriAction.SHOW) {
        return await repository.showBuffer(fsPath, extra.ref);
      }
      if (action === SvnUriAction.LOG) {
        return await repository.plainLogBuffer();
      }
      if (action === SvnUriAction.LOG_REVISION && extra.revision) {
        return await repository.plainLogByRevisionBuffer(extra.revision);
      }
      if (action === SvnUriAction.LOG_SEARCH && extra.search) {
        return await repository.plainLogByTextBuffer(extra.search);
      }
      if (action === SvnUriAction.PATCH) {
        return await repository.patchBuffer([fsPath]);
      }

      return new Uint8Array(0);
    } catch (error) {
      // Re-throw FileSystemErrors as-is (already properly formatted)
      if (error instanceof FileSystemError) {
        throw error;
      }

      // Extract SVN error details for proper VS Code error display
      let svnErrorCode: string | undefined;
      let errorDetails = "";

      if (error && typeof error === "object" && "svnErrorCode" in error) {
        // SvnError object - get the specific error code and stderr
        const svnError = error as {
          svnErrorCode?: string;
          stderr?: string;
          stderrFormated?: string;
          message?: string;
        };
        svnErrorCode = svnError.svnErrorCode;
        errorDetails =
          svnError.stderrFormated || svnError.stderr || svnError.message || "";
      } else if (error instanceof Error) {
        errorDetails = error.message;
        const errorCodeMatch = errorDetails.match(/E\d+|W\d+/);
        if (errorCodeMatch) {
          svnErrorCode = errorCodeMatch[0];
        }
      } else {
        errorDetails = String(error);
      }

      // Check for "not found" error patterns
      if (
        svnErrorCode === "E160013" || // Path not found
        svnErrorCode === "E200009" || // Could not cat
        svnErrorCode === "W160013" || // URL not found
        errorDetails.includes("E160013") ||
        errorDetails.includes("E200009") ||
        errorDetails.includes("W160013")
      ) {
        throw FileSystemError.FileNotFound(uri);
      }

      // Log and re-throw with detailed message (never empty)
      logError("Failed to read SVN file", error);
      const message = errorDetails || "SVN operation failed";
      throw FileSystemError.Unavailable(message);
    }
  }

  writeFile(): void {
    throw new Error("writeFile is not implemented");
  }

  delete(): void {
    throw new Error("delete is not implemented");
  }

  rename(): void {
    throw new Error("rename is not implemented");
  }

  private cleanup(): void {
    const now = new Date().getTime();
    const cache = new Map<string, CacheRow>();

    for (const row of this.cache.values()) {
      const { fsPath } = fromSvnUri(row.uri);
      const isOpen = workspace.textDocuments
        .filter(d => d.uri.scheme === "file")
        .some(d => pathEquals(d.uri.fsPath, fsPath));

      if (isOpen || now - row.timestamp < THREE_MINUTES) {
        cache.set(row.uri.toString(), row);
      } else {
        // TODO: should fire delete events?
      }
    }

    this.cache = cache;
  }

  dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    this.disposables.forEach(d => d.dispose());
  }
}
