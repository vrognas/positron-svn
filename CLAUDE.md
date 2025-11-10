- In all interactions and commit messages, be extremely concise and sacrifice grammar for the sake of concision.
- Its important for each implementation to begin with writing and reviewing tests before moving on to implementation (TDD test-driven development).
  Write minimalist tests. Don't overdo it - about three general end-to-end tests per implementation is enough.
- Commit often, with small and focused commits.
- Update the version number and the changelog with every commit.
- For every commit, go over `CLAUDE.md`, `ARCHITECTURE_ANALYSIS.md`, `DEV_WORKFLOW.md`, and `LESSONS_LEARNED.md` to see if everything is up-to-date.
- For simple queries, use under five tool calls, but for more complex queries you can use up to 15 tool calls.

## Architecture

### Core Components

**Extension Entry Point (`src/extension.ts`)**

- Initializes SVN finder to locate SVN executable
- Creates `Svn` instance with path and version
- Instantiates `SourceControlManager` which manages all repositories
- Registers commands and providers

**SVN Wrapper (`src/svn.ts`)**

- Low-level wrapper around SVN command-line interface
- Executes SVN commands via child processes
- Handles encoding detection and conversion
- Manages authentication credentials

**Source Control Manager (`src/source_control_manager.ts`)**

- Central manager for all SVN repositories
- Discovers and opens repositories in workspace
- Handles multiple repositories and externals
- Manages repository lifecycle (open/close)

**Repository (`src/repository.ts`)** - 923 lines (Phase 2 refactored)

- Represents a single SVN working copy, coordinates operations
- Delegates to specialized services (StatusService, ResourceGroupManager, RemoteChangeService)
- Handles file watching, operation queue, auth credential caching
- VS Code SecretStorage API integration

**Status Service (`src/services/statusService.ts`)** - 355 lines (Phase 2)

- Stateless service for SVN status processing
- Converts status output to resource groups
- File decorations and changelist handling
- Zero Repository dependencies

**Resource Group Manager (`src/services/resourceGroupManager.ts`)** - 298 lines (Phase 2)

- Manages VS Code resource groups lifecycle
- Changelist creation/disposal, resource ordering
- Zero Repository dependencies

**Remote Change Service (`src/services/remoteChangeService.ts`)** - 107 lines (Phase 2)

- Remote change polling timer management
- Interval setup/teardown, minimal dependencies

**Base Repository (`src/svnRepository.ts`)** - 970 lines

- Lower-level SVN operations (status, commit, update, etc.)
- Command execution and output parsing

### Command Pattern

Commands are in `src/commands/` and registered via `src/commands.ts`:

- Each command extends base `Command` class
- Commands use `getSourceControlManager()` to access repositories
- Operations are wrapped in `repository.run()` for progress tracking

### Resource Groups

VS Code Source Control UI organizes files into groups:

- **changes** - Modified files
- **unversioned** - New files not tracked by SVN
- **conflicts** - Files with merge conflicts
- **changelists** - User-defined changelists (dynamic groups)
- **remotechanges** - Remote changes from server

### Parsers

XML and text parsers in `src/parser/`:

- `statusParser.ts` - Parse `svn status` output
- `logParser.ts` - Parse `svn log` output
- `infoParser.ts` - Parse `svn info --xml` output
- `diffParser.ts` - Parse `svn diff` output

### History Views

Tree view providers in `src/historyView/`:

- `repoLogProvider.ts` - Repository log viewer
- `itemLogProvider.ts` - File history viewer
- `branchChangesProvider.ts` - Branch changes viewer

## SVN Requirements

Extension requires SVN command-line tools:

- Windows: TortoiseSVN with "Command Line Tools" option
- Configurable via `svn.path` setting
- Minimum version checks via `isSvn18orGreater` and `isSvn19orGreater` contexts

## Authentication

Uses VS Code SecretStorage API (replaced keytar in v2.17.0):

- Credentials stored per repository root URL
- Multiple accounts supported per repository
- Auto-retry on authentication failure
- Prompts user when credentials needed

## Plans

- At the end of each plan, give me a list of unresolved questions to answer, if any.
  Make the questions extremely concise.
  Sacrifice grammar for the sake of concision.
