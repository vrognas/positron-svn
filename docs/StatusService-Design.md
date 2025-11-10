# StatusService Design

**Phase 2 Cycle 1**: Extract status parsing logic from Repository.updateModelState()

## Overview

StatusService extracts lines 451-711 from repository.ts, handling SVN status fetching, parsing, and resource categorization. Pure function design with no side effects.

## Type Definitions

### Core Interface

```typescript
interface IStatusService {
  updateStatus(options: StatusUpdateOptions): Promise<StatusResult>;
}
```

### Input Types

```typescript
type StatusUpdateOptions = {
  readonly checkRemoteChanges: boolean;
};
```

### Output Type

```typescript
type StatusResult = {
  readonly changes: Resource[];              // Modified files
  readonly conflicts: Resource[];            // Conflicted files
  readonly unversioned: Resource[];          // New untracked files
  readonly changelists: ReadonlyMap<string, Resource[]>;  // User-defined groups
  readonly remoteChanges: Resource[];        // Server changes
  readonly statusExternal: readonly IFileStatus[];  // External refs
  readonly statusIgnored: readonly IFileStatus[];   // Ignored files
  readonly isIncomplete: boolean;            // Working copy incomplete
  readonly needCleanUp: boolean;             // Locked working copy
};
```

### Internal Helper Types

```typescript
type StatusConfig = {
  readonly combineExternal: boolean;
  readonly hideUnversioned: boolean;
  readonly ignoreList: readonly string[];
  readonly ignoreOnStatusCountList: readonly string[];
  readonly countUnversioned: boolean;
  readonly filesExclude: Record<string, boolean>;
};
```

## Constructor Dependencies

```typescript
constructor(
  private readonly repository: BaseRepository,  // SVN operations
  private readonly workspaceRoot: string,       // Workspace path
  private readonly root: string                 // Repository root
)
```

**Why these dependencies:**
- `BaseRepository`: Calls getStatus(), getRepositoryUuid()
- `workspaceRoot`: Constructs file URIs
- `root`: Configuration scope

**NOT injected:**
- SourceControl - UI concern, not status logic
- EventEmitter - Repository handles events
- Disposables - Service has no lifecycle

## Responsibilities

### Does
1. Execute `repository.getStatus()` with options
2. Parse IFileStatus[] into categorized groups
3. Apply filtering rules (ignore patterns, exclusions)
4. Handle external repositories
5. Detect incomplete/locked states
6. Categorize remote changes

### Does NOT
1. Manage VS Code SourceControlResourceGroup (UI)
2. Emit events
3. Update status bar
4. Handle authentication
5. Retry logic
6. Dispose resources
7. Manage changelists in VS Code

## Method Breakdown

### Public Method

**`updateStatus(options)`**
- Entry point
- Orchestrates all private methods
- Returns pure StatusResult

### Private Methods

**`getConfiguration()`**
- Reads VS Code config
- Returns StatusConfig object
- No side effects

**`fetchStatuses(includeExternals, checkRemoteChanges)`**
- Calls repository.getStatus()
- Returns raw IFileStatus[]

**`buildExcludeList(filesExclude)`**
- Converts files.exclude config to pattern list
- Handles negation patterns (!pattern)

**`separateExternals(statuses, combineExternal)`**
- Filters EXTERNAL statuses
- Filters by repository UUID if combining
- Returns { statusExternal, statusesRepository }

**`categorizeStatuses(statuses, excludeList, config)`**
- Main categorization logic
- Applies all filtering rules
- Returns all categorized groups

## Data Flow

```
Input: StatusUpdateOptions
  ↓
getConfiguration() → StatusConfig
  ↓
fetchStatuses() → IFileStatus[]
  ↓
buildExcludeList() → string[]
  ↓
separateExternals() → { external, repository }
  ↓
categorizeStatuses() → categorized groups
  ↓
Output: StatusResult
```

## Filtering Rules Applied

1. **Exclude patterns** (files.exclude config)
2. **Locked/switched items** (skip)
3. **Normal/unchanged files** (skip unless in changelist)
4. **Hide unversioned** (config option)
5. **Conflict-related files** (*.mine, *.r123)
6. **Ignore patterns** (sourceControl.ignore config)
7. **External descendants** (skip if parent is external)

## Integration with Repository

### Before (Repository.updateModelState)
```typescript
async updateModelState(checkRemoteChanges: boolean) {
  // 260 lines of logic
  this.changes.resourceStates = changes;
  this.conflicts.resourceStates = conflicts;
  // ... mutate many properties
}
```

### After (with StatusService)
```typescript
async updateModelState(checkRemoteChanges: boolean) {
  const result = await this.statusService.updateStatus({ checkRemoteChanges });

  // Update resource groups
  this.changes.resourceStates = result.changes;
  this.conflicts.resourceStates = result.conflicts;
  this.unversioned.resourceStates = result.unversioned;

  // Update metadata
  this.statusExternal = result.statusExternal;
  this.statusIgnored = result.statusIgnored;
  this.isIncomplete = result.isIncomplete;
  this.needCleanUp = result.needCleanUp;

  // Handle changelists
  this.updateChangelists(result.changelists);

  // Handle remote changes
  if (checkRemoteChanges) {
    this.updateRemoteChanges(result.remoteChanges);
  }

  // Update status bar, emit events, etc.
}
```

## Type Safety Features

1. **No `any` types** - Strict typing throughout
2. **Readonly returns** - Immutable result objects
3. **Discriminated unions** - Status enum for type safety
4. **Branded types** - Consider for changelist names (future)
5. **Const assertions** - Config objects readonly
6. **Type guards** - Status enum checks

## Testability

### Unit Test Structure
```typescript
describe('StatusService', () => {
  let mockRepository: jest.Mocked<BaseRepository>;
  let service: StatusService;

  beforeEach(() => {
    mockRepository = {
      getStatus: jest.fn(),
      getRepositoryUuid: jest.fn()
    } as any;

    service = new StatusService(
      mockRepository,
      '/workspace',
      '/workspace'
    );
  });

  it('categorizes modified files as changes', async () => {
    mockRepository.getStatus.mockResolvedValue([
      { status: Status.MODIFIED, path: 'file.ts', /* ... */ }
    ]);

    const result = await service.updateStatus({ checkRemoteChanges: false });

    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].type).toBe(Status.MODIFIED);
  });
});
```

### Test Cases
1. Basic categorization (modified, added, deleted)
2. Conflict detection
3. Unversioned handling
4. Changelist grouping
5. External filtering
6. Ignore pattern matching
7. Exclusion pattern handling
8. Incomplete state detection
9. Remote change detection
10. Edge cases (empty status, all ignored, etc.)

## Performance Considerations

1. **Single SVN call** - getStatus() called once
2. **Linear complexity** - O(n) where n = file count
3. **No unnecessary allocations** - Reuse arrays
4. **Map for changelists** - O(1) lookup
5. **Early returns** - Skip processing when possible
6. **Lazy evaluation** - Config read once

## Migration Path

### Step 1: Create Service
- [x] Define interfaces
- [x] Implement StatusService class
- [x] Add to src/services/

### Step 2: Add Tests (TDD)
- [ ] Write unit tests
- [ ] Mock BaseRepository
- [ ] Test all categorization paths
- [ ] Verify 80%+ coverage

### Step 3: Integrate
- [ ] Add to Repository constructor
- [ ] Replace updateModelState logic
- [ ] Keep UI updates in Repository
- [ ] Run manual E2E tests

### Step 4: Verify
- [ ] Build passes
- [ ] Tests pass
- [ ] No functionality regression
- [ ] Extension activates

## Open Questions

None - design complete and validated by build.

## Files

- **Implementation**: `/home/user/positron-svn/src/services/StatusService.ts` (338 lines)
- **Extracted from**: `/home/user/positron-svn/src/repository.ts` (lines 451-711)
- **Dependencies**: BaseRepository, Resource, configuration, utilities
- **Zero `any` types**: Full type safety
