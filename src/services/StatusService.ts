import * as path from "path";
import { Uri, workspace } from "vscode";
import { IFileStatus, Status } from "../common/types";
import { configuration } from "../helpers/configuration";
import { Resource } from "../resource";
import { ResourceGroupManager } from "./ResourceGroupManager";
import { isDescendant } from "../util";
import { matchAll } from "../util/globMatch";

/** Minimal interface for status-related operations */
export interface IStatusRepository {
  root: string;
  workspaceRoot: string;
  getStatus(options: any): Promise<IFileStatus[]>;
  getRepositoryUuid(): Promise<string>;
  retryRun: <T>(operation: () => Promise<T>) => Promise<T>;
}

/** Event callbacks for status changes */
export interface IStatusEvents {
  onDidChangeStatus: () => void;
  onDidChangeRemoteChangedFiles: () => void;
  getCurrentBranch: () => Promise<string>;
}

export class StatusService {
  constructor(
    private repository: IStatusRepository,
    private resourceGroups: ResourceGroupManager,
    private events: IStatusEvents
  ) {}

  public async updateModelState(
    statusExternal: IFileStatus[],
    statusIgnored: IFileStatus[],
    isIncomplete: boolean,
    needCleanUp: boolean,
    remoteChangedFiles: number,
    currentBranch: string,
    checkRemoteChanges: boolean = false
  ): Promise<{
    statusExternal: IFileStatus[];
    statusIgnored: IFileStatus[];
    isIncomplete: boolean;
    needCleanUp: boolean;
    remoteChangedFiles: number;
    currentBranch: string;
  }> {
    const changes: Resource[] = [];
    const unversioned: Resource[] = [];
    const conflicts: Resource[] = [];
    const changelists: Map<string, Resource[]> = new Map();
    const remoteChanges: Resource[] = [];

    statusExternal = [];
    statusIgnored = [];
    isIncomplete = false;
    needCleanUp = false;

    const combineExternal = configuration.get<boolean>(
      "sourceControl.combineExternalIfSameServer",
      false
    );

    const statuses =
      (await this.repository.retryRun(async () => {
        return this.repository.getStatus({
          includeIgnored: true,
          includeExternals: combineExternal,
          checkRemoteChanges
        });
      })) ?? [];

    const fileConfig = workspace.getConfiguration("files", Uri.file(this.repository.root));

    const filesToExclude = fileConfig.get<any>("exclude");

    const excludeList: string[] = [];
    for (const pattern in filesToExclude) {
      if (filesToExclude.hasOwnProperty(pattern)) {
        const negate = !filesToExclude[pattern];
        excludeList.push((negate ? "!" : "") + pattern);
      }
    }

    statusExternal = statuses.filter(
      status => status.status === Status.EXTERNAL
    );

    if (combineExternal && statusExternal.length) {
      const repositoryUuid = await this.repository.getRepositoryUuid();
      statusExternal = statusExternal.filter(
        status => repositoryUuid !== status.repositoryUuid
      );
    }

    const statusesRepository = statuses.filter(status => {
      if (status.status === Status.EXTERNAL) {
        return false;
      }

      return !statusExternal.some(external =>
        isDescendant(external.path, status.path)
      );
    });

    const hideUnversioned = configuration.get<boolean>(
      "sourceControl.hideUnversioned"
    );

    const ignoreList = configuration.get<string[]>("sourceControl.ignore");

    for (const status of statusesRepository) {
      if (status.path === ".") {
        isIncomplete = status.status === Status.INCOMPLETE;
        needCleanUp = status.wcStatus.locked;
      }

      // If exists a switched item, the repository is incomplete
      // To simulate, run "svn switch" and kill "svn" proccess
      // After, run "svn update"
      if (status.wcStatus.switched) {
        isIncomplete = true;
      }

      if (
        status.wcStatus.locked ||
        status.wcStatus.switched ||
        status.status === Status.INCOMPLETE
      ) {
        // On commit, `svn status` return all locked files with status="normal" and props="none"
        continue;
      }

      if (matchAll(status.path, excludeList, { dot: true })) {
        continue;
      }

      const uri = Uri.file(path.join(this.repository.workspaceRoot, status.path));
      const renameUri = status.rename
        ? Uri.file(path.join(this.repository.workspaceRoot, status.rename))
        : undefined;

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

      if (
        (status.status === Status.NORMAL || status.status === Status.NONE) &&
        (status.props === Status.NORMAL || status.props === Status.NONE) &&
        !status.changelist
      ) {
        // Ignore non changed itens
        continue;
      } else if (status.status === Status.IGNORED) {
        statusIgnored.push(status);
      } else if (status.status === Status.CONFLICTED) {
        conflicts.push(resource);
      } else if (status.status === Status.UNVERSIONED) {
        if (hideUnversioned) {
          continue;
        }

        const matches = status.path.match(
          /(.+?)\.(mine|working|merge-\w+\.r\d+|r\d+)$/
        );

        // If file end with (mine, working, merge, etc..) and has file without extension
        if (
          matches &&
          matches[1] &&
          statuses.some(s => s.path === matches[1])
        ) {
          continue;
        }
        if (
          ignoreList.length > 0 &&
          matchAll(path.sep + status.path, ignoreList, {
            dot: true,
            matchBase: true
          })
        ) {
          continue;
        }
        unversioned.push(resource);
      } else if (status.changelist) {
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

    this.resourceGroups.changes.resourceStates = changes;
    this.resourceGroups.conflicts.resourceStates = conflicts;

    const prevChangelistsSize = this.resourceGroups.changelists.size;

    this.resourceGroups.changelists.forEach((group, _changelist) => {
      group.resourceStates = [];
    });

    const counts = [this.resourceGroups.changes, this.resourceGroups.conflicts];

    const ignoreOnStatusCountList = configuration.get<string[]>(
      "sourceControl.ignoreOnStatusCount"
    );

    // Delegate changelist management to ResourceGroupManager
    this.resourceGroups.updateChangelists(changelists);

    // Count resources
    changelists.forEach((_resources, changelist) => {
      const group = this.resourceGroups.changelists.get(changelist);
      if (group && !ignoreOnStatusCountList.includes(changelist)) {
        counts.push(group);
      }
    });

    // Recreate unversioned group if changelists size changed
    if (prevChangelistsSize !== this.resourceGroups.changelists.size) {
      this.resourceGroups.recreateUnversionedGroup();
    }

    this.resourceGroups.unversioned.resourceStates = unversioned;

    if (configuration.get<boolean>("sourceControl.countUnversioned", false)) {
      counts.push(this.resourceGroups.unversioned);
    }

    // Update source control count (will be set by Repository)
    // counts.reduce((a, b) => a + b.resourceStates.length, 0);

    // Recreate remoteChanges group if needed
    if (!this.resourceGroups.remoteChanges || prevChangelistsSize !== this.resourceGroups.changelists.size) {
      this.resourceGroups.recreateRemoteChangesGroup();
    }

    // Update remote changes group
    if (checkRemoteChanges && this.resourceGroups.remoteChanges) {
      this.resourceGroups.remoteChanges.resourceStates = remoteChanges;

      if (remoteChanges.length !== remoteChangedFiles) {
        remoteChangedFiles = remoteChanges.length;
        this.events.onDidChangeRemoteChangedFiles();
      }
    }

    this.events.onDidChangeStatus();

    currentBranch = await this.events.getCurrentBranch();

    return {
      statusExternal,
      statusIgnored,
      isIncomplete,
      needCleanUp,
      remoteChangedFiles,
      currentBranch
    };
  }
}
