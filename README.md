# SVN Extension for Positron

Positron-optimized fork of the SVN extension with enhanced security, modern TypeScript, and performance improvements for data science workflows.

[![Version](https://img.shields.io/badge/version-2.18.1-blue.svg)](CHANGELOG.md)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

**Original extension:** [JohnstonCode/svn-scm](https://github.com/JohnstonCode/svn-scm) | **This fork:** [vrognas/positron-svn](https://github.com/vrognas/positron-svn)

## About Positron

[Positron](https://github.com/posit-dev/positron) is a next-generation data science IDE from Posit (creators of RStudio). This SVN extension has been enhanced specifically for Positron with:

- ✅ **Enhanced Security**: All input validators applied (Phase 4.5), credential protection via stdin
- ✅ **Modern TypeScript**: Strict type safety, reduced `any` types by 27%
- ✅ **Performance Optimized**: Factory pattern initialization, performance baselines documented
- ✅ **Well-Tested**: 30+ security tests, validator coverage, TOCTOU protection

## Compatibility

**VS Code & Positron:** This extension works identically in both VS Code and Positron without modification.

- Positron is built on [Code OSS](https://github.com/microsoft/vscode) (same foundation as VS Code)
- Uses 100% compatible Extension API (VS Code 1.74+)
- All features work: Source Control, Tree Views, Commands, Diff Viewer, Authentication
- No abstraction layer required

**Tested on:**
- ✅ VS Code 1.74+
- ✅ Positron 2025.6.x (expected - testing in progress)

**Installation:**
- VS Code: Install from [Microsoft Marketplace](https://marketplace.visualstudio.com)
- Positron: Install from [Open VSX Registry](https://open-vsx.org) or VSIX file

## Installation

### From Source
1. Clone this repository
2. Run `npm install`
3. Run `npm run build`
4. Package with `vsce package`
5. Install the `.vsix` file in Positron

## Prerequisites

> **Note**: This extension leverages your machine's SVN installation, so you need to [install SVN](https://subversion.apache.org) first.

### Windows
If you use [TortoiseSVN](https://tortoisesvn.net/), make sure the option **Command Line Tools** is checked during installation and `C:\Program Files\TortoiseSVN\bin` is available in PATH.

### SVN Version Support
- **Recommended**: SVN 1.9+ (secure password handling via stdin)
- **Minimum**: SVN 1.6+ (legacy password handling with documented limitations)

## Features

### Core SVN Operations
- **Source Control View** - Full integration with Positron's source control panel
- **Checkout** - Clone repositories with `SVN: Checkout` command
- **Quick Diffs** - Gutter indicators for changes
- **Changelists** - Organize changes into logical groups
- **Branching** - Create and switch branches
- **Commit** - Stage and commit changes with validation
- **Patches** - Create and apply patches
- **Status Bar** - Real-time repository status

### Security Features (Phase 4.5)
- Input validation on all user inputs (revision, file paths, URLs)
- SSRF protection on checkout (blocks private IPs, localhost, file://)
- Command injection prevention across all SVN operations
- Secure credential handling (passwords via stdin for SVN 1.9+)
- TOCTOU protection on temporary file operations

See [SECURITY.md](SECURITY.md) for details.

## Documentation

- 📖 [Security Policy](SECURITY.md) - Vulnerability reporting and security features
- 🤝 [Contributing Guide](CONTRIBUTING.md) - Development setup and workflow
- 📋 [Changelog](CHANGELOG.md) - Version history and changes
- 🏗️ [Architecture](ARCHITECTURE_ANALYSIS.md) - Codebase structure and design
- 🚀 [Implementation Plan](IMPLEMENTATION_PLAN.md) - Multi-phase modernization roadmap
- ⚡ [Performance Baselines](PERFORMANCE_BASELINE.md) - Performance metrics and targets

## Configuration

<details>
<summary>Click to expand all settings</summary>

<!--begin-settings-->
```js
{
  // Whether auto refreshing is enabled
  "svn.autorefresh": true,

  // Select all files when commit changes
  "svn.commit.changes.selectedAll": true,

  // Check empty message before commit
  "svn.commit.checkEmptyMessage": true,

  // Set file to status resolved after fix conflicts
  "svn.conflicts.autoResolve": null,

  // Encoding of svn output if the output is not utf-8
  "svn.default.encoding": null,

  // The default location to checkout a svn repository
  "svn.defaultCheckoutDirectory": null,

  // When a file is deleted, what SVN should do?
  "svn.delete.actionForDeletedFiles": "prompt",  // values: ["none","prompt","remove"]

  // Ignored files/rules for deleted files (Ex.: file.txt or **/*.txt)
  "svn.delete.ignoredRulesForDeletedFiles": [],

  // Controls whether to automatically detect svn externals
  "svn.detectExternals": true,

  // Controls whether to automatically detect svn on ignored folders
  "svn.detectIgnored": true,

  // Show diff changes using latest revision in the repository
  "svn.diff.withHead": true,

  // Whether svn is enabled
  "svn.enabled": true,

  // Try the experimental encoding detection
  "svn.experimental.detect_encoding": null,

  // Priority of encoding
  "svn.experimental.encoding_priority": [],

  // Url for the gravitar icon
  "svn.gravatar.icon_url": "https://www.gravatar.com/avatar/<AUTHOR_MD5>.jpg?s=<SIZE>&d=robohash",

  // Use garavatar icons in log viewers
  "svn.gravatars.enabled": true,

  // Ignores the warning when SVN is missing
  "svn.ignoreMissingSvnWarning": null,

  // List of SVN repositories to ignore
  "svn.ignoreRepositories": null,

  // Ignores the warning when working copy is too old
  "svn.ignoreWorkingCopyIsTooOld": null,

  // Regex to detect path for 'branches' in SVN URL
  "svn.layout.branchesRegex": "branches/([^/]+)(/.*)?",

  // Regex group position for name of branch
  "svn.layout.branchesRegexName": 1,

  // Show full branch names with 'branches/' prefix
  "svn.layout.showFullName": true,

  // Regex group position for name of tag
  "svn.layout.tagRegexName": 1,

  // Regex to detect path for 'tags' in SVN URL
  "svn.layout.tagsRegex": "tags/([^/]+)(/.*)?",

  // Regex to detect path for 'trunk' in SVN URL
  "svn.layout.trunkRegex": "(trunk)(/.*)?",

  // Regex group position for name of trunk
  "svn.layout.trunkRegexName": 1,

  // Number of commit messages to log
  "svn.log.length": 50,

  // Maximum depth to find subfolders using SVN
  "svn.multipleFolders.depth": 4,

  // Allow to find subfolders using SVN
  "svn.multipleFolders.enabled": null,

  // Folders to ignore using SVN
  "svn.multipleFolders.ignore": ["**/.git","**/.hg","**/vendor","**/node_modules"],

  // Path to the svn executable
  "svn.path": null,

  // Only show previous commits for a given user (requires svn >= 1.8)
  "svn.previousCommitsUser": null,

  // Refresh remote changes on refresh command
  "svn.refresh.remoteChanges": null,

  // Check remote changes interval in seconds (0 to disable)
  "svn.remoteChanges.checkFrequency": 300,

  // Show the output window when the extension starts
  "svn.showOutput": null,

  // Show the update message when update is run
  "svn.showUpdateMessage": true,

  // Set left click functionality on changes resource state
  "svn.sourceControl.changesLeftClick": "open diff",  // values: ["open","open diff"]

  // Combine the svn external in the main if is from the same server
  "svn.sourceControl.combineExternalIfSameServer": null,

  // Allow to count unversioned files in status count
  "svn.sourceControl.countUnversioned": true,

  // Hide unversioned files in Source Control UI
  "svn.sourceControl.hideUnversioned": null,

  // Ignore unversioned files like .gitignore
  "svn.sourceControl.ignore": [],

  // Changelists to ignore on commit
  "svn.sourceControl.ignoreOnCommit": ["ignore-on-commit"],

  // Changelists to ignore on status count
  "svn.sourceControl.ignoreOnStatusCount": ["ignore-on-commit"],

  // Ignore externals definitions on update
  "svn.update.ignoreExternals": true
}
```
<!--end-settings-->

</details>

## Blame Support

For SVN blame functionality, use a dedicated extension like [blamer-vs](https://marketplace.visualstudio.com/items?itemName=beaugust.blamer-vs).

## Feedback & Contributing

- 🐛 **Report bugs or request features**: [Issues](https://github.com/vrognas/positron-svn/issues)
- 🔧 **Submit improvements**: [Pull Requests](https://github.com/vrognas/positron-svn/pulls)
- 📖 **Development guide**: See [CONTRIBUTING.md](CONTRIBUTING.md)

## Project Status

**Current Version**: 2.17.28
- ✅ Phase 1: TypeScript Cleanup (COMPLETE)
- ✅ Phase 4.5: Security Completion (COMPLETE)
- ✅ Prerequisites: Resolved (async constructor, baselines, type enforcement)
- 🚧 Phase 2: Service Extraction (Ready to start)

See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for the full modernization roadmap.

## License

MIT - See [LICENSE](LICENSE) file for details.

---

**Maintained by**: [@vrognas](https://github.com/vrognas)
**Original author**: [@JohnstonCode](https://github.com/JohnstonCode)
