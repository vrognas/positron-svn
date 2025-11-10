import * as path from "path";
import { Uri, workspace } from "vscode";
import { IFileStatus, ISvnResourceGroup, Status } from "../common/types";
import { throttle, globalSequentialize } from "../decorators";
import { configuration } from "../helpers/configuration";
import { Resource } from "../resource";
import { Repository as BaseRepository } from "../svnRepository";
import { isDescendant } from "../util";
import { matchAll } from "../util/globMatch";

export interface IStatusContext {
  root: string;
  workspaceRoot: string;
  changes: ISvnResourceGroup;
  unversioned: ISvnResourceGroup;
  conflicts: ISvnResourceGroup;
  changelists: Map<string, ISvnResourceGroup>;
  remoteChanges?: ISvnResourceGroup;
  sourceControl: {
    createResourceGroup: (id: string, label: string) => ISvnResourceGroup;
    count: number;
  };
  onDidChangeStatus: () => void;
  onDidChangeRemoteChangedFiles: () => void;
  getCurrentBranch: () => Promise<string>;
  retryRun: <T>(operation: () => Promise<T>) => Promise<T>;
  disposables: { push: (disposable: any) => void };
}

export class StatusService {
  constructor(
    private repository: BaseRepository,
    private context: IStatusContext
  ) {}

  @throttle
  @globalSequentialize("updateModelState")
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
      (await this.context.retryRun(async () => {
        return this.repository.getStatus({
          includeIgnored: true,
          includeExternals: combineExternal,
          checkRemoteChanges
        });
      })) ?? [];

    const fileConfig = workspace.getConfiguration("files", Uri.file(this.context.root));

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

      const uri = Uri.file(path.join(this.context.workspaceRoot, status.path));
      const renameUri = status.rename
        ? Uri.file(path.join(this.context.workspaceRoot, status.rename))
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

    this.context.changes.resourceStates = changes;
    this.context.conflicts.resourceStates = conflicts;

    const prevChangelistsSize = this.context.changelists.size;

    this.context.changelists.forEach((group, _changelist) => {
      group.resourceStates = [];
    });

    const counts = [this.context.changes, this.context.conflicts];

    const ignoreOnStatusCountList = configuration.get<string[]>(
      "sourceControl.ignoreOnStatusCount"
    );

    changelists.forEach((resources, changelist) => {
      let group = this.context.changelists.get(changelist);
      if (!group) {
        // Prefix 'changelist-' to prevent double id with 'change' or 'external'
        group = this.context.sourceControl.createResourceGroup(
          `changelist-${changelist}`,
          `Changelist "${changelist}"`
        ) as ISvnResourceGroup;
        group.hideWhenEmpty = true;
        this.context.disposables.push(group);

        this.context.changelists.set(changelist, group);
      }

      group.resourceStates = resources;

      if (!ignoreOnStatusCountList.includes(changelist)) {
        counts.push(group);
      }
    });

    // Recreate unversioned group to move after changelists
    if (prevChangelistsSize !== this.context.changelists.size) {
      this.context.unversioned.dispose();

      this.context.unversioned = this.context.sourceControl.createResourceGroup(
        "unversioned",
        "Unversioned"
      ) as ISvnResourceGroup;

      this.context.unversioned.hideWhenEmpty = true;
    }

    this.context.unversioned.resourceStates = unversioned;

    if (configuration.get<boolean>("sourceControl.countUnversioned", false)) {
      counts.push(this.context.unversioned);
    }

    this.context.sourceControl.count = counts.reduce(
      (a, b) => a + b.resourceStates.length,
      0
    );

    // Recreate remoteChanges group to move after unversioned
    if (!this.context.remoteChanges || prevChangelistsSize !== this.context.changelists.size) {
      /**
       * Destroy and create for keep at last position
       */
      const tempResourceStates: Resource[] = this.context.remoteChanges?.resourceStates ?? [];
      this.context.remoteChanges?.dispose();

      this.context.remoteChanges = this.context.sourceControl.createResourceGroup(
        "remotechanges",
        "Remote Changes"
      ) as ISvnResourceGroup;

      this.context.remoteChanges.repository = undefined; // Will be set by Repository
      this.context.remoteChanges.hideWhenEmpty = true;
      this.context.remoteChanges.resourceStates = tempResourceStates;
    }

    // Update remote changes group
    if (checkRemoteChanges) {
      this.context.remoteChanges.resourceStates = remoteChanges;

      if (remoteChanges.length !== remoteChangedFiles) {
        remoteChangedFiles = remoteChanges.length;
        this.context.onDidChangeRemoteChangedFiles();
      }
    }

    this.context.onDidChangeStatus();

    currentBranch = await this.context.getCurrentBranch();

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
