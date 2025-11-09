# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Its important for each implementation to begin with writing and reviewing tests before moving on to implementation (TDD test-driven development).
Write minimalist, general, and end-to-end tests. Don't overdo it. About three tests per implementation is enough.
Commit often, with small and focused commits. Its great that you keep updating the version number with every commit, and don't forget to update the changelog.

## Build and Development Commands

### Build

- `yarn build` - Full build (TypeScript + CSS)
- `yarn build:ts` - Build TypeScript using tsc (direct compilation)
- `yarn build:css` - Build SCSS to CSS

### Development

- `yarn compile` - Watch TypeScript changes (development mode)
- `yarn watch:css` - Watch CSS changes
- `yarn test-compile` - Compile TypeScript for tests

### Testing

- `yarn test` - Run tests (requires compiled code)

### Code Quality

- `yarn lint` - Run ESLint
- `yarn lint:fix` - Fix ESLint issues
- `yarn style-check` - Check code formatting
- `yarn style-fix` - Fix code formatting

### Release

- `yarn semantic-release` - Create semantic release

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

**Repository (`src/repository.ts`)**

- Represents a single SVN working copy
- Manages resource groups (changes, unversioned, conflicts, changelists)
- Coordinates operations through `run()` method
- Handles remote change detection and status bar
- Stores authentication using VS Code SecretStorage API

**Base Repository (`src/svnRepository.ts`)**

- Lower-level repository operations
- Direct SVN command execution (status, commit, update, etc.)
- Parses SVN output (status, log, info)

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
