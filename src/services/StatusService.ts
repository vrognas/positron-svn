import { Disposable, Uri, workspace } from "vscode";
import { IFileStatus, Status } from "../common/types";
import { configuration } from "../helpers/configuration";
import { Resource } from "../resource";
import { Repository as BaseRepository } from "../svnRepository";
import { isDescendant } from "../util";
import { matchAll } from "../util/globMatch";
import * as path from "path";

/**
 * Result from status update operation
 */
export type StatusResult = {
  readonly changes: Resource[];
  readonly conflicts: Resource[];
  readonly unversioned: Resource[];
  readonly changelists: ReadonlyMap<string, Resource[]>;
  readonly remoteChanges: Resource[];
  readonly statusExternal: readonly IFileStatus[];
  readonly statusIgnored: readonly IFileStatus[];
  readonly isIncomplete: boolean;
  readonly needCleanUp: boolean;
};

/**
 * Options for status update operation
 */
export type StatusUpdateOptions = {
  readonly checkRemoteChanges: boolean;
};

/**
 * Configuration values extracted for status processing
 */
type StatusConfig = {
  readonly combineExternal: boolean;
  readonly hideUnversioned: boolean;
  readonly ignoreList: readonly string[];
  readonly ignoreOnStatusCountList: readonly string[];
  readonly countUnversioned: boolean;
  readonly filesExclude: Record<string, boolean>;
};

/**
 * Service responsible for status parsing and resource categorization.
 * Extracts logic from Repository.updateModelState() (lines 451-711).
 *
 * Responsibilities:
 * - Execute SVN status command
 * - Parse status results
 * - Categorize resources into groups
 * - Apply filtering rules (ignore patterns, exclusions)
 * - Handle externals and remote changes
 *
 * Does NOT:
 * - Manage VS Code resource groups (UI concern)
 * - Emit events (Repository concern)
 * - Update status bar (UI concern)
 * - Handle authentication (Repository concern)
 */
export interface IStatusService {
  /**
   * Update repository status and categorize resources
   * @param options Options including whether to check remote changes
   * @returns Categorized resources and metadata
   */
  updateStatus(options: StatusUpdateOptions): Promise<StatusResult>;
}

/**
 * Implementation of status service
 */
export class StatusService implements IStatusService {
  private _configCache: StatusConfig | undefined;
  private readonly _configChangeDisposable: Disposable;

  constructor(
    private readonly repository: BaseRepository,
    private readonly workspaceRoot: string,
    private readonly root: string
  ) {
    // Subscribe to config changes to invalidate cache (Phase 8.1 perf fix)
    this._configChangeDisposable = configuration.onDidChange(() => {
      this._configCache = undefined;
    });
  }

  async updateStatus(options: StatusUpdateOptions): Promise<StatusResult> {
    const config = this.getConfiguration();

    // Fetch statuses from SVN
    const statuses = await this.fetchStatuses(
      config.combineExternal,
      options.checkRemoteChanges
    );

    // Get file exclusion patterns
    const excludeList = this.buildExcludeList(config.filesExclude);

    // Separate external statuses
    const { statusExternal, statusesRepository } = await this.separateExternals(
      statuses,
      config.combineExternal
    );

    // Categorize resources
    const categorized = this.categorizeStatuses(
      statusesRepository,
      excludeList,
      config
    );

    return {
      changes: categorized.changes,
      conflicts: categorized.conflicts,
      unversioned: categorized.unversioned,
      changelists: categorized.changelists,
      remoteChanges: categorized.remoteChanges,
      statusExternal,
      statusIgnored: categorized.statusIgnored,
      isIncomplete: categorized.isIncomplete,
      needCleanUp: categorized.needCleanUp
    };
  }

  /**
   * Get configuration values needed for status processing
   * Cached for performance (Phase 8.1 fix - prevents 1-10x/sec workspace.getConfiguration calls)
   */
  private getConfiguration(): StatusConfig {
    if (this._configCache) {
      return this._configCache;
    }

    const fileConfig = workspace.getConfiguration("files", Uri.file(this.root));
    const filesExclude = fileConfig.get<Record<string, boolean>>("exclude") ?? {};

    this._configCache = {
      combineExternal: configuration.get<boolean>(
        "sourceControl.combineExternalIfSameServer",
        false
      ),
      hideUnversioned: configuration.get<boolean>(
        "sourceControl.hideUnversioned",
        false
      ),
      ignoreList: configuration.get<string[]>("sourceControl.ignore", []),
      ignoreOnStatusCountList: configuration.get<string[]>(
        "sourceControl.ignoreOnStatusCount",
        []
      ),
      countUnversioned: configuration.get<boolean>(
        "sourceControl.countUnversioned",
        false
      ),
      filesExclude
    };

    return this._configCache;
  }

  /**
   * Fetch statuses from SVN repository
   */
  private async fetchStatuses(
    includeExternals: boolean,
    checkRemoteChanges: boolean
  ): Promise<IFileStatus[]> {
    return await this.repository.getStatus({
      includeIgnored: true,
      includeExternals,
      checkRemoteChanges
    });
  }

  /**
   * Build exclusion pattern list from files.exclude config
   */
  private buildExcludeList(filesExclude: Record<string, boolean>): string[] {
    const excludeList: string[] = [];

    for (const pattern in filesExclude) {
      if (filesExclude.hasOwnProperty(pattern)) {
        const negate = !filesExclude[pattern];
        excludeList.push((negate ? "!" : "") + pattern);
      }
    }

    return excludeList;
  }

  /**
   * Separate external statuses from repository statuses
   */
  private async separateExternals(
    statuses: IFileStatus[],
    combineExternal: boolean
  ): Promise<{
    statusExternal: IFileStatus[];
    statusesRepository: IFileStatus[];
  }> {
    let statusExternal = statuses.filter(
      status => status.status === Status.EXTERNAL
    );

    // Filter externals by repository UUID if combining
    if (combineExternal && statusExternal.length) {
      const repositoryUuid = await this.repository.getRepositoryUuid();
      statusExternal = statusExternal.filter(
        status => repositoryUuid !== status.repositoryUuid
      );
    }

    // Phase 21.B fix - O(e×n) → O(n) single-pass descendant lookup
    // Build Set of external paths for O(1) membership check
    const externalPaths = new Set<string>();
    for (const external of statusExternal) {
      externalPaths.add(external.path);
    }

    // Single pass through statuses, check against all externals
    const descendantPaths = new Set<string>();
    for (const status of statuses) {
      if (status.status === Status.EXTERNAL) {
        continue;
      }

      // Check if this status is descendant of ANY external
      for (const externalPath of externalPaths) {
        if (isDescendant(externalPath, status.path)) {
          descendantPaths.add(status.path);
          break; // No need to check other externals
        }
      }
    }

    // Filter out external paths and their descendants
    const statusesRepository = statuses.filter(status => {
      if (status.status === Status.EXTERNAL) {
        return false;
      }
      return !descendantPaths.has(status.path);
    });

    return { statusExternal, statusesRepository };
  }

  /**
   * Categorize statuses into resource groups
   */
  private categorizeStatuses(
    statuses: IFileStatus[],
    excludeList: string[],
    config: StatusConfig
  ): {
    changes: Resource[];
    conflicts: Resource[];
    unversioned: Resource[];
    changelists: Map<string, Resource[]>;
    remoteChanges: Resource[];
    statusIgnored: IFileStatus[];
    isIncomplete: boolean;
    needCleanUp: boolean;
  } {
    const changes: Resource[] = [];
    const conflicts: Resource[] = [];
    const unversioned: Resource[] = [];
    const changelists = new Map<string, Resource[]>();
    const remoteChanges: Resource[] = [];
    const statusIgnored: IFileStatus[] = [];
    let isIncomplete = false;
    let needCleanUp = false;

    // Phase 13 perf fix - O(n) → O(1) conflict path lookup
    const conflictPaths = new Set<string>();
    for (const status of statuses) {
      if (status.status === Status.CONFLICTED) {
        conflictPaths.add(status.path);
      }
    }

    for (const status of statuses) {
      // Check for incomplete/locked status on root
      if (status.path === ".") {
        isIncomplete = status.status === Status.INCOMPLETE;
        needCleanUp = status.wcStatus.locked;
      }

      // If exists a switched item, the repository is incomplete
      if (status.wcStatus.switched) {
        isIncomplete = true;
      }

      // Skip locked/switched/incomplete items
      if (
        status.wcStatus.locked ||
        status.wcStatus.switched ||
        status.status === Status.INCOMPLETE
      ) {
        continue;
      }

      // Skip excluded files
      if (matchAll(status.path, excludeList, { dot: true })) {
        continue;
      }

      const uri = Uri.file(path.join(this.workspaceRoot, status.path));
      const renameUri = status.rename
        ? Uri.file(path.join(this.workspaceRoot, status.rename))
        : undefined;

      // Handle remote changes
      if (status.reposStatus) {
        remoteChanges.push(
          new Resource(
            uri,
            status.reposStatus.item,
            undefined,
            status.reposStatus.props,
            true
          )
        );
      }

      const resource = new Resource(
        uri,
        status.status,
        renameUri,
        status.props
      );

      // Skip normal/unchanged items
      if (
        (status.status === Status.NORMAL || status.status === Status.NONE) &&
        (status.props === Status.NORMAL || status.props === Status.NONE) &&
        !status.changelist
      ) {
        continue;
      } else if (status.status === Status.IGNORED) {
        statusIgnored.push(status);
      } else if (status.status === Status.CONFLICTED) {
        conflicts.push(resource);
      } else if (status.status === Status.UNVERSIONED) {
        if (config.hideUnversioned) {
          continue;
        }

        // Skip conflict-related files (*.mine, *.r123, etc) - Phase 13 perf fix
        const matches = status.path.match(
          /(.+?)\.(mine|working|merge-\w+\.r\d+|r\d+)$/
        );
        if (
          matches &&
          matches[1] &&
          conflictPaths.has(matches[1])
        ) {
          continue;
        }

        // Check against ignore list
        if (
          config.ignoreList.length > 0 &&
          matchAll(path.sep + status.path, config.ignoreList, {
            dot: true,
            matchBase: true
          })
        ) {
          continue;
        }

        unversioned.push(resource);
      } else if (status.changelist) {
        // Add to changelist group
        let changelist = changelists.get(status.changelist);
        if (!changelist) {
          changelist = [];
        }
        changelist.push(resource);
        changelists.set(status.changelist, changelist);
      } else {
        changes.push(resource);
      }
    }

    return {
      changes,
      conflicts,
      unversioned,
      changelists,
      remoteChanges,
      statusIgnored,
      isIncomplete,
      needCleanUp
    };
  }

  /**
   * Dispose resources (config change listener)
   */
  dispose(): void {
    this._configChangeDisposable.dispose();
  }
}
