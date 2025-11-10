import * as assert from "assert";
import { workspace, WorkspaceConfiguration } from "vscode";
import { StatusService } from "../../../services/StatusService";
import { Repository as BaseRepository } from "../../../svnRepository";
import { IFileStatus, Status } from "../../../common/types";

suite("StatusService Tests", () => {
  let mockRepository: Partial<BaseRepository>;
  let service: StatusService;
  let originalGetConfiguration: any;

  const workspaceRoot = "/workspace";
  const root = "/workspace";

  setup(() => {
    // Mock BaseRepository
    mockRepository = {
      getStatus: async () => [],
      getRepositoryUuid: async () => "test-uuid-123"
    };

    // Mock workspace configuration
    originalGetConfiguration = workspace.getConfiguration;
    workspace.getConfiguration = ((section?: string, _scope?: any) => {
      return {
        get: (key: string, defaultValue?: any) => {
          if (section === "files" && key === "exclude") {
            return {};
          }
          // SVN config defaults
          if (key === "sourceControl.combineExternalIfSameServer") return false;
          if (key === "sourceControl.hideUnversioned") return false;
          if (key === "sourceControl.ignore") return [];
          if (key === "sourceControl.ignoreOnStatusCount") return [];
          if (key === "sourceControl.countUnversioned") return false;
          return defaultValue;
        }
      } as WorkspaceConfiguration;
    }) as any;

    service = new StatusService(
      mockRepository as BaseRepository,
      workspaceRoot,
      root
    );
  });

  teardown(() => {
    workspace.getConfiguration = originalGetConfiguration;
  });

  test("Basic categorization - modified/added/deleted files", async () => {
    const statuses: IFileStatus[] = [
      {
        status: Status.MODIFIED,
        props: Status.NONE,
        path: "file1.txt",
        wcStatus: { locked: false, switched: false }
      },
      {
        status: Status.ADDED,
        props: Status.NONE,
        path: "file2.txt",
        wcStatus: { locked: false, switched: false }
      },
      {
        status: Status.DELETED,
        props: Status.NONE,
        path: "file3.txt",
        wcStatus: { locked: false, switched: false }
      },
      {
        status: Status.CONFLICTED,
        props: Status.NONE,
        path: "file4.txt",
        wcStatus: { locked: false, switched: false }
      },
      {
        status: Status.UNVERSIONED,
        props: Status.NONE,
        path: "file5.txt",
        wcStatus: { locked: false, switched: false }
      }
    ];

    mockRepository.getStatus = async () => statuses;

    const result = await service.updateStatus({ checkRemoteChanges: false });

    assert.strictEqual(result.changes.length, 3, "3 changes (modified/added/deleted)");
    assert.strictEqual(result.conflicts.length, 1, "1 conflict");
    assert.strictEqual(result.unversioned.length, 1, "1 unversioned");

    assert.strictEqual(result.changes[0].type, Status.MODIFIED);
    assert.strictEqual(result.changes[1].type, Status.ADDED);
    assert.strictEqual(result.changes[2].type, Status.DELETED);
    assert.strictEqual(result.conflicts[0].type, Status.CONFLICTED);
    assert.strictEqual(result.unversioned[0].type, Status.UNVERSIONED);
  });

  test("Changelist grouping - files grouped by changelist", async () => {
    const statuses: IFileStatus[] = [
      {
        status: Status.MODIFIED,
        props: Status.NONE,
        path: "file1.txt",
        changelist: "feature-x",
        wcStatus: { locked: false, switched: false }
      },
      {
        status: Status.MODIFIED,
        props: Status.NONE,
        path: "file2.txt",
        changelist: "feature-x",
        wcStatus: { locked: false, switched: false }
      },
      {
        status: Status.ADDED,
        props: Status.NONE,
        path: "file3.txt",
        changelist: "bugfix-y",
        wcStatus: { locked: false, switched: false }
      },
      {
        status: Status.MODIFIED,
        props: Status.NONE,
        path: "file4.txt",
        wcStatus: { locked: false, switched: false }
      }
    ];

    mockRepository.getStatus = async () => statuses;

    const result = await service.updateStatus({ checkRemoteChanges: false });

    assert.strictEqual(result.changelists.size, 2, "2 changelists");
    assert.ok(result.changelists.has("feature-x"), "Has feature-x changelist");
    assert.ok(result.changelists.has("bugfix-y"), "Has bugfix-y changelist");

    const featureX = result.changelists.get("feature-x");
    assert.strictEqual(featureX?.length, 2, "feature-x has 2 files");

    const bugfixY = result.changelists.get("bugfix-y");
    assert.strictEqual(bugfixY?.length, 1, "bugfix-y has 1 file");

    assert.strictEqual(result.changes.length, 1, "1 file not in changelist");
  });

  test("Filtering rules - ignore patterns and hide unversioned", async () => {
    // Override config to hide unversioned and set ignore patterns
    workspace.getConfiguration = ((section?: string, _scope?: any) => {
      return {
        get: (key: string, defaultValue?: any) => {
          if (section === "files" && key === "exclude") {
            return { "**/build/**": true, "**/*.log": true };
          }
          if (key === "sourceControl.hideUnversioned") return true;
          if (key === "sourceControl.ignore") return ["**/node_modules/**", "**/.DS_Store"];
          if (key === "sourceControl.combineExternalIfSameServer") return false;
          if (key === "sourceControl.ignoreOnStatusCount") return [];
          if (key === "sourceControl.countUnversioned") return false;
          return defaultValue;
        }
      } as WorkspaceConfiguration;
    }) as any;

    const statuses: IFileStatus[] = [
      {
        status: Status.MODIFIED,
        props: Status.NONE,
        path: "src/file.txt",
        wcStatus: { locked: false, switched: false }
      },
      {
        status: Status.MODIFIED,
        props: Status.NONE,
        path: "build/output.js",
        wcStatus: { locked: false, switched: false }
      },
      {
        status: Status.MODIFIED,
        props: Status.NONE,
        path: "app.log",
        wcStatus: { locked: false, switched: false }
      },
      {
        status: Status.UNVERSIONED,
        props: Status.NONE,
        path: "new-file.txt",
        wcStatus: { locked: false, switched: false }
      },
      {
        status: Status.UNVERSIONED,
        props: Status.NONE,
        path: "node_modules/package/index.js",
        wcStatus: { locked: false, switched: false }
      },
      {
        status: Status.UNVERSIONED,
        props: Status.NONE,
        path: ".DS_Store",
        wcStatus: { locked: false, switched: false }
      }
    ];

    mockRepository.getStatus = async () => statuses;

    const result = await service.updateStatus({ checkRemoteChanges: false });

    // All unversioned should be hidden
    assert.strictEqual(result.unversioned.length, 0, "Unversioned files hidden");

    // Files matching exclude patterns should be filtered
    const paths = result.changes.map(r => r.resourceUri.fsPath);
    assert.ok(
      paths.some(p => p.endsWith("src/file.txt")),
      "src/file.txt included"
    );
    assert.ok(
      !paths.some(p => p.includes("build")),
      "build files excluded"
    );
    assert.ok(
      !paths.some(p => p.endsWith(".log")),
      ".log files excluded"
    );
  });
});
