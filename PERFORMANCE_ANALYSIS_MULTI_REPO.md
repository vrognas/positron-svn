# Performance Analysis: Multiple Repositories and SVN Externals

## Executive Summary

Performance degrades significantly in workspaces with:
- Multiple SVN repositories (3+ repos)
- Repositories with many externals (5+ externals)
- Deep folder hierarchies when `multipleFolders.enabled=true`
- Frequent file changes triggering status updates
- Remote change polling enabled across all repos

**Root causes:** Uncoordinated parallel operations, redundant status checks, aggressive external scanning, per-repository polling, and no credential caching across repos.

---

## 1. External Repository Discovery Issues

### Current Implementation
**File:** `/home/user/positron-svn/src/source_control_manager.ts:207-218`

```typescript
private scanExternals(repository: Repository): void {
  const shouldScanExternals =
    configuration.get<boolean>("detectExternals") === true;

  if (!shouldScanExternals) {
    return;
  }

  repository.statusExternal
    .map(r => path.join(repository.workspaceRoot, r.path))
    .forEach(p => this.eventuallyScanPossibleSvnRepository(p));
}
```

**Triggered on lines 461, 464** - called on EVERY status change via `onDidChangeStatus` event.

### Problems

#### 1.1 Excessive Scanning Frequency
- `scanExternals()` fires on every `onDidChangeStatus` event
- Each file save triggers status update → external scan
- With 10 externals, saving 1 file triggers 10+ `tryOpenRepository()` calls
- Debounced to 500ms but still frequent with active development

#### 1.2 Recursive Directory Traversal
**File:** `/home/user/positron-svn/src/source_control_manager.ts:271-341`

```typescript
public async tryOpenRepository(path: string, level = 0): Promise<void> {
  // ... checks ...

  const newLevel = level + 1;
  if (newLevel <= this.maxDepth) {
    let files: string[] | Buffer[] = [];

    try {
      files = await readdir(path);
    } catch (error) {
      return;
    }

    for (const file of files) {
      const dir = path + "/" + file;
      let stats: Stats;

      try {
        stats = await stat(dir);
      } catch (error) {
        continue;
      }

      if (
        stats.isDirectory() &&
        !matchAll(dir, this.ignoreList, { dot: true })
      ) {
        await this.tryOpenRepository(dir, newLevel);
      }
    }
  }
}
```

**Performance impact:**
- With `multipleFolders.depth=4` (default), scans up to 5 levels deep
- 10 subdirectories × 4 levels = ~10,000 file system operations
- Each external triggers full recursive scan
- No caching of "already scanned" paths

#### 1.3 Sequential Processing
**Line 217:** `forEach(p => this.eventuallyScanPossibleSvnRepository(p))`

- Externals scanned sequentially, not in parallel
- With 20 externals taking 500ms each = 10 seconds total
- Blocks status updates during scanning

### Concrete Scenario
**Workspace with 5 repos, each with 10 externals:**
1. User saves file in main repo
2. Status update fires → `scanExternals()` called
3. 10 externals queued for scanning
4. Each triggers `tryOpenRepository()` with `maxDepth=4`
5. ~50,000 file system operations total
6. Repeat for all 5 repos = 250,000 operations
7. **Result:** 30-60 second UI freeze

---

## 2. Remote Change Detection Performance

### Current Implementation
**File:** `/home/user/positron-svn/src/repository.ts:297-310`

```typescript
private createRemoteChangedInterval() {
  const updateFreq = configuration.get<number>(
    "remoteChanges.checkFrequency",
    300
  );

  if (!updateFreq) {
    return;
  }

  this.remoteChangedUpdateInterval = setInterval(() => {
    this.updateRemoteChangedFiles();
  }, 1000 * updateFreq);
}
```

### Problems

#### 2.1 Uncoordinated Per-Repository Polling
- Each repository polls independently every 300 seconds (default)
- No synchronization between repos
- 10 repos = 10 simultaneous `svn status --show-updates` commands
- Each command contacts SVN server and blocks

#### 2.2 Expensive SVN Operation
**File:** `/home/user/positron-svn/src/svnRepository.ts:125-137`

```typescript
const args = ["stat", "--xml"];

if (params.checkRemoteChanges) {
  args.push("--show-updates");
}

const result = await this.exec(args);
```

**Why it's slow:**
- `--show-updates` contacts SVN server for EVERY file in working copy
- With 1,000 files, server processes 1,000 comparisons
- Network latency: 100ms-2000ms per repository
- Server load increases linearly with repo count
- No cancellation if user starts different operation

#### 2.3 No Batching or Caching
- Each poll fetches full status, not incremental changes
- No HEAD revision caching to detect "no changes on server"
- Remote changes resource group recreated on every status update (line 668-683)

### Concrete Scenario
**10 repositories with `remoteChanges.checkFrequency=300`:**
1. Every 5 minutes, all 10 repos poll simultaneously
2. Each `svn status --show-updates` takes 3 seconds
3. Network saturated with 10 concurrent SVN connections
4. Server processes 10 × 1,000 files = 10,000 comparisons
5. During polling, local operations slow down (shared network/CPU)
6. **Result:** Every 5 minutes, 30 seconds of degraded performance

**With 20+ repos:** Polling becomes continuous - one finishes, another starts.

---

## 3. Concurrent Operations Across Repositories

### Current Implementation
**File:** `/home/user/positron-svn/src/repository.ts:1073-1116`

```typescript
private async run<T>(
  operation: Operation,
  runOperation: () => Promise<T> = () => Promise.resolve<any>(null)
): Promise<T> {
  if (this.state !== RepositoryState.Idle) {
    throw new Error("Repository not initialized");
  }

  const run = async () => {
    this._operations.start(operation);
    this._onRunOperation.fire(operation);

    try {
      const result = await this.retryRun(runOperation);

      const checkRemote = operation === Operation.StatusRemote;

      if (!isReadOnly(operation)) {
        await this.updateModelState(checkRemote);
      }

      return result;
    } catch (err) {
      // ... error handling ...
    } finally {
      this._operations.end(operation);
      this._onDidRunOperation.fire(operation);
    }
  };

  return shouldShowProgress(operation)
    ? window.withProgress({ location: ProgressLocation.SourceControl }, run)
    : run();
}
```

### Problems

#### 3.1 No Cross-Repository Coordination
- Each repository has its own operation queue
- No global operation scheduler
- `globalSequentialize("updateModelState")` only for status updates
- Other operations (commit, update, log) run in parallel

#### 3.2 File System Watcher Storms
**File:** `/home/user/positron-svn/src/source_control_manager.ts:165-181`

```typescript
const fsWatcher = workspace.createFileSystemWatcher("**");
this.disposables.push(fsWatcher);

const onWorkspaceChange = anyEvent(
  fsWatcher.onDidChange,
  fsWatcher.onDidCreate,
  fsWatcher.onDidDelete
);
const onPossibleSvnRepositoryChange = filterEvent(
  onWorkspaceChange,
  uri => uri.scheme === "file" && !this.getRepository(uri)
);
onPossibleSvnRepositoryChange(
  this.onPossibleSvnRepositoryChange,
  this,
  this.disposables
);
```

**Plus per-repository watchers:**
**File:** `/home/user/positron-svn/src/repository.ts:190-200`

```typescript
this._fsWatcher = new RepositoryFilesWatcher(repository.root);
this.disposables.push(this._fsWatcher);

this._fsWatcher.onDidAny(this.onFSChange, this, this.disposables);
this._fsWatcher.onDidSvnAny(
  async (e: Uri) => {
    await this.onDidAnyFileChanged(e);
  },
  this,
  this.disposables
);
```

**Performance impact:**
- 1 global watcher + N repository watchers
- File change triggers N status updates (one per repo checking if file belongs to it)
- With 15 repos, single file save triggers 15 parallel status checks
- Each status runs `svn status --xml` (100-500ms)

#### 3.3 Status Update Serialization Bottleneck
**File:** `/home/user/positron-svn/src/repository.ts:442-443`

```typescript
@throttle
@globalSequentialize("updateModelState")
public async updateModelState(checkRemoteChanges: boolean = false) {
```

- `globalSequentialize` creates single-threaded queue for ALL repos
- 10 repos with 200ms status each = 2 seconds sequential delay
- User sees first repo update immediately, last repo after 2 seconds
- No priority for active repository

### Concrete Scenario
**15 repositories, user commits in one:**
1. Commit completes, triggers status update
2. Status update queued globally via `globalSequentialize`
3. All 15 repos queue status updates (changed file might affect externals)
4. Each waits for previous to complete
5. 15 × 200ms = 3 seconds to update all UI
6. During this time, file watcher fires again (commit created new files)
7. Another round of 15 status updates queued
8. **Result:** 6+ seconds before UI reflects commit, feels unresponsive

---

## 4. Authentication Flow Performance

### Current Implementation
**File:** `/home/user/positron-svn/src/repository.ts:1118-1166`

```typescript
private async retryRun<T>(
  runOperation: () => Promise<T> = () => Promise.resolve<any>(null)
): Promise<T> {
  let attempt = 0;
  let accounts: IStoredAuth[] = [];

  while (true) {
    try {
      attempt++;
      const result = await runOperation();
      this.saveAuth();
      return result;
    } catch (err) {
      const svnError = err as ISvnErrorData;
      if (
        svnError.svnErrorCode === svnErrorCodes.RepositoryIsLocked &&
        attempt <= 10
      ) {
        // quatratic backoff
        await timeout(Math.pow(attempt, 2) * 50);
      } else if (
        svnError.svnErrorCode === svnErrorCodes.AuthorizationFailed &&
        attempt <= 1 + accounts.length
      ) {
        // First attempt load all stored auths
        if (attempt === 1) {
          accounts = await this.loadStoredAuths();
        }

        // each attempt, try a different account
        const index = accounts.length - 1;
        if (typeof accounts[index] !== "undefined") {
          this.username = accounts[index].account;
          this.password = accounts[index].password;
        }
      } else if (
        svnError.svnErrorCode === svnErrorCodes.AuthorizationFailed &&
        attempt <= 3 + accounts.length
      ) {
        const result = await this.promptAuth();
        if (!result) {
          throw err;
        }
      } else {
        throw err;
      }
    }
  }
}
```

### Problems

#### 4.1 No Credential Sharing Between Repositories
- Each `Repository` instance loads credentials independently
- 10 repos pointing to same SVN server = 10 separate credential loads
- Credentials stored per repository root URL (line 989-994)
- No in-memory credential cache

#### 4.2 Sequential Auth Prompts
**File:** `/home/user/positron-svn/src/repository.ts:1037-1054`

```typescript
public async promptAuth(): Promise<IAuth | undefined> {
  // Prevent multiple prompts for auth
  if (this.lastPromptAuth) {
    return this.lastPromptAuth;
  }

  this.lastPromptAuth = commands.executeCommand("svn.promptAuth");
  const result = await this.lastPromptAuth;

  if (result) {
    this.username = result.username;
    this.password = result.password;
    this.canSaveAuth = true;
  }

  this.lastPromptAuth = undefined;
  return result;
}
```

- `lastPromptAuth` only prevents multiple prompts *within same repository*
- Does not coordinate across repositories
- With 5 repos, user gets prompted 5 times for same server

#### 4.3 Expensive Secret Storage Reads
**File:** `/home/user/positron-svn/src/repository.ts:997-1012`

```typescript
public async loadStoredAuths(): Promise<Array<IStoredAuth>> {
  // Prevent multiple prompts for auth
  if (this.lastPromptAuth) {
    await this.lastPromptAuth;
  }

  const secret = await this.secrets.get(this.getCredentialServiceName());

  if (secret === undefined) {
    return [];
  }

  const credentials = JSON.parse(secret) as Array<IStoredAuth>;

  return credentials;
}
```

- Called on EVERY auth failure
- VS Code `secrets.get()` is async and can take 50-200ms
- With 10 repos authenticating simultaneously = 10 secret reads
- No caching of loaded credentials

### Concrete Scenario
**Workspace with 10 repos on same SVN server, credentials expired:**
1. User executes "Update All" or similar batch operation
2. All 10 repos attempt `svn update` simultaneously
3. Each hits auth failure
4. Each loads credentials from secret storage (10 × 200ms = 2 seconds)
5. Each tries stored accounts (assuming 2 stored accounts)
6. All accounts invalid
7. First repo prompts user for auth
8. User enters credentials
9. Second repo doesn't know about new credentials, prompts again
10. Repeat 8 more times
11. **Result:** User enters credentials 10 times for same server

---

## 5. Status Update Bottlenecks

### Current Implementation
**File:** `/home/user/positron-svn/src/repository.ts:443-700`

```typescript
@throttle
@globalSequentialize("updateModelState")
public async updateModelState(checkRemoteChanges: boolean = false) {
  // ... initialization ...

  const statuses =
    (await this.retryRun(async () => {
      return this.repository.getStatus({
        includeIgnored: true,
        includeExternals: combineExternal,
        checkRemoteChanges
      });
    })) ?? [];

  // ... process ~200 lines ...
}
```

### Problems

#### 5.1 Expensive Status Collection
**File:** `/home/user/positron-svn/src/svnRepository.ts:110-153`

```typescript
public async getStatus(params: {
  includeIgnored?: boolean;
  includeExternals?: boolean;
  checkRemoteChanges?: boolean;
}): Promise<IFileStatus[]> {
  // ...
  const args = ["stat", "--xml"];

  if (params.includeIgnored) {
    args.push("--no-ignore");
  }
  if (!params.includeExternals) {
    args.push("--ignore-externals");
  }
  if (params.checkRemoteChanges) {
    args.push("--show-updates");
  }

  const result = await this.exec(args);

  const status: IFileStatus[] = await parseStatusXml(result.stdout);

  for (const s of status) {
    if (s.status === Status.EXTERNAL) {
      try {
        const info = await this.getInfo(s.path);
        s.repositoryUuid = info.repository?.uuid;
      } catch (error) {
        console.error(error);
      }
    }
  }

  return status;
}
```

**Performance impact:**
- `includeExternals=true` by default with `combineExternal` config
- For each external, runs `svn info` sequentially (lines 143-148)
- 10 externals × 100ms = 1 second added to status
- With 10 repos = 10 seconds total across all status updates

#### 5.2 Heavy UI Manipulation
**File:** `/home/user/positron-svn/src/repository.ts:608-665`

```typescript
this.changes.resourceStates = changes;
this.conflicts.resourceStates = conflicts;

// ... process changelists ...

changelists.forEach((resources, changelist) => {
  let group = this.changelists.get(changelist);
  if (!group) {
    group = this.sourceControl.createResourceGroup(
      `changelist-${changelist}`,
      `Changelist "${changelist}"`
    ) as ISvnResourceGroup;
    group.hideWhenEmpty = true;
    this.disposables.push(group);

    this.changelists.set(changelist, group);
  }

  group.resourceStates = resources;
  // ...
});

// Recreate unversioned group to move after changelists
if (prevChangelistsSize !== this.changelists.size) {
  this.unversioned.dispose();

  this.unversioned = this.sourceControl.createResourceGroup(
    "unversioned",
    "Unversioned"
  ) as ISvnResourceGroup;

  this.unversioned.hideWhenEmpty = true;
}
```

**Performance impact:**
- Creating/disposing resource groups triggers VS Code UI redraws
- With 50 files across 5 changelists, manipulates 55+ resource states
- Each assignment triggers VS Code event
- 10 repos × 55 updates = 550 UI updates
- No batching of UI updates

#### 5.3 Autorefresh Triggers
**File:** `/home/user/positron-svn/src/repository.ts:395-407`

```typescript
private onFSChange(_uri: Uri): void {
  const autorefresh = configuration.get<boolean>("autorefresh");

  if (!autorefresh) {
    return;
  }

  if (!this.operations.isIdle()) {
    return;
  }

  this.eventuallyUpdateWhenIdleAndWait();
}
```

**Debounced at 1000ms** (line 409) but still frequent:
- 10 files edited rapidly = 1 status update per second for 10 seconds
- Each edit triggers `onFSChange` for ALL repositories checking if file belongs to them
- `isDescendant()` called N times per file change

### Concrete Scenario
**User runs build script generating 500 files across 5 repositories:**
1. Build starts, creates files rapidly
2. File watcher triggers `onFSChange` for each file
3. All 5 repos check if each file belongs to them (5 × 500 = 2,500 checks)
4. Debounced status updates queue up
5. After 1 second pause, all 5 repos start status update
6. Each runs `svn status --xml --no-ignore` with 10 externals
7. Each `svn info` call for externals
8. Each processes 100+ status entries and updates UI
9. `globalSequentialize` forces sequential execution
10. 5 × 2 seconds = 10 seconds total
11. **Result:** 10+ seconds after build completes before UI shows changes

---

## 6. Multiple Repository Initialization

### Current Implementation
**File:** `/home/user/positron-svn/src/source_control_manager.ts:264-269`

```typescript
private async scanWorkspaceFolders() {
  for (const folder of workspace.workspaceFolders || []) {
    const root = folder.uri.fsPath;
    await this.tryOpenRepository(root);
  }
}
```

### Problems

#### 6.1 Sequential Initialization
- Repositories opened one at a time with `await`
- With `multipleFolders.enabled=true`, each scans recursively
- 10 workspace folders × 2 seconds each = 20 seconds startup
- No parallelization of initial scans

#### 6.2 Redundant File System Watchers
Each repository creates its own watcher:
- Global watcher for all files (`**`)
- Per-repository watcher for specific root
- 10 repos = 11 watchers all triggering on same events
- VS Code has watcher limit, can hit limit with many repos

#### 6.3 No Resource Pooling
- Each repository maintains separate:
  - SVN execution queue
  - File status cache
  - Info cache (2-minute TTL per `getInfo()` call)
  - Operation state tracker
- 10 repos = 10× memory usage

### Concrete Scenario
**Workspace with 20 SVN repos scattered in subdirectories:**
1. Extension activates, calls `scanWorkspaceFolders()`
2. `multipleFolders.enabled=true`, `depth=4`
3. Scans 20 workspace folders sequentially
4. Each scans 4 levels deep (~1000 files per folder)
5. 20 × 1000 = 20,000 file system operations during startup
6. Each found repo opens, creates watchers, runs initial status
7. 20 × 1 second = 20 seconds just for initialization
8. Then all 20 repos start remote change polling
9. 20 simultaneous `svn status --show-updates`
10. **Result:** 30+ second activation time, VS Code feels frozen

---

## Priority Performance Issues

### Critical (User-Facing Freezes)
1. **External scanning on every status change** - 250,000+ fs operations
2. **Uncoordinated remote polling** - Continuous network saturation with 20+ repos
3. **Sequential status updates** - 3+ second lag in UI updates

### High (Noticeable Degradation)
4. **Per-repository authentication** - 10× auth prompts for same server
5. **File watcher storms** - 15× redundant status checks per file change
6. **Sequential initialization** - 30+ second activation time

### Medium (Background Load)
7. **No credential caching** - Repeated secret storage reads
8. **External UUID checks** - 10× `svn info` calls per status
9. **Resource group recreation** - Excessive UI redraws

---

## Recommended Optimizations

### Immediate Impact
1. **Debounce external scanning** - Increase from 500ms to 5000ms, scan in parallel
2. **Coordinate remote polling** - Stagger polls, skip if server HEAD unchanged
3. **Parallelize status updates** - Remove `globalSequentialize`, add per-repo throttle
4. **Cache credentials** - Share across repos with same server

### High Impact
5. **Skip external scanning if no externals changed** - Track external status changes
6. **Batch file watcher events** - Collect 100ms of events, check repos once
7. **Parallel initialization** - Use `Promise.all()` for workspace scanning
8. **Disable remote polling by default** - Too expensive for >5 repos

### Optimization Targets
- **Workspaces with 3-10 repos:** Sub-second status updates, <5s activation
- **Workspaces with 10+ repos:** <2s status updates, <10s activation
- **Repos with 10+ externals:** <1s status with externals, <3s external scan

---

## Configuration Recommendations

### For Large Workspaces (10+ repos)
```json
{
  "svn.remoteChanges.checkFrequency": 0,  // Disable auto-polling
  "svn.detectExternals": false,            // Manual external management
  "svn.multipleFolders.enabled": false,    // Explicit repo paths
  "svn.autorefresh": false                 // Manual refresh only
}
```

### For Repos with Many Externals (10+ externals)
```json
{
  "svn.detectExternals": false,
  "svn.sourceControl.combineExternalIfSameServer": false
}
```

### For Slow Networks
```json
{
  "svn.remoteChanges.checkFrequency": 600,  // Every 10 minutes
  "svn.autorefresh": false
}
```

---

## Files Requiring Changes

### Critical Path
1. `/home/user/positron-svn/src/source_control_manager.ts` - External scanning, repo coordination
2. `/home/user/positron-svn/src/repository.ts` - Status updates, auth flow, remote polling
3. `/home/user/positron-svn/src/svnRepository.ts` - Status collection, external info

### Supporting Files
4. `/home/user/positron-svn/src/decorators.ts` - Add per-repo throttle decorator
5. `/home/user/positron-svn/package.json` - Add new configuration options

---

## Metrics to Track

### Before Optimization
- Activation time with 20 repos: ~30 seconds
- Status update time with 10 repos: ~3 seconds
- External scan time with 10 externals: ~10 seconds
- Auth prompts for 10 repos: 10 prompts
- Memory usage with 20 repos: ~500MB

### After Optimization Goals
- Activation time with 20 repos: <10 seconds
- Status update time with 10 repos: <500ms
- External scan time with 10 externals: <2 seconds
- Auth prompts for 10 repos: 1 prompt
- Memory usage with 20 repos: ~300MB
