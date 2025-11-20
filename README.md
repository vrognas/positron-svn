# Subversion source control for Positron

Positron-optimized fork of the SVN extension with enhanced features for data science workflows.

**Original extension:** [JohnstonCode/svn-scm](https://github.com/JohnstonCode/svn-scm)

# Prerequisites

> **Note**: This extension leverages your machine's SVN installation,\
> so you need to [install SVN](https://subversion.apache.org) first.

## Windows

If you use [TortoiseSVN](https://tortoisesvn.net/), make sure the option
**Command Line Tools** is checked during installation and
`C:\Program Files\TortoiseSVN\bin` is available in PATH.

## Feedback & Contributing

* Please report any bugs, suggestions or documentation requests via the
  [Issues](https://github.com/vrognas/positron-svn/issues)
* Feel free to submit
  [pull requests](https://github.com/vrognas/positron-svn/pulls)

## Contributing as a Developer

Want to contribute? Great! See our [CONTRIBUTING.md](./CONTRIBUTING.md) for:
- Development environment setup
- Testing & TDD workflow
- Code style guidelines
- Pull request process

For comprehensive guides, see:
- [Developer Setup Guide](./docs/DEVELOPER_SETUP.md) - Environment configuration
- [Documentation Priority Matrix](./docs/DOCUMENTATION_PRIORITY_MATRIX.md) - For maintainers
- [Lessons Learned](./docs/LESSONS_LEARNED.md) - Architecture insights

# Features

### Checkout

You can checkout a SVN repository with the `SVN: Checkout` command in the **Command Palette** (`Ctrl+Shift+P`). You will be asked for the URL of the repository and the parent directory under which to put the local repository.

----

* Source Control View
* Quick Diffs in gutter
* Status Bar
* Create changelists
* Add files
* Revert edits
* Remove files
* Create branches
* Switch branches
* Create patches
* Diff changes
* Diff with external tools (Beyond Compare, etc.)
* Commit changes/changelists
* See commit messages

## External Diff Tools

Configure external diff tools like Beyond Compare for large files (e.g., CSVs) where built-in diff is insufficient.

**Setup:**
1. Set `svn.diff.tool` to path of wrapper batch file (e.g., `bcsvn.bat`)
2. Right-click file in Source Control → **Diff with External Tool**
3. For Beyond Compare setup, see: https://www.scootersoftware.com/kb/vcs#svn

## Blame Annotations

View line-by-line revision history directly in the editor.

**Features:**
- Gutter annotations: colored revision indicators (enabled by default)
- Inline messages: commit details at end of line, GitLens-style (enabled by default)
- Status bar: blame info for current line
- Auto-blame: automatically show blame when files open (enabled by default)
- Hover tooltips: detailed commit info on hover

**Configuration:**
See all 19 configuration options in Settings → search "svn.blame"

For advanced configuration, see [Blame System Documentation](docs/BLAME_SYSTEM.md).

## Settings
Here are all of the extension settings with their default values. To change any of these, add the relevant Config key and value to your VSCode settings.json file. Alternatively search for the config key in the settings UI to change its value.

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

  // Encoding of svn output if the output is not utf-8. When this parameter is null, the encoding is automatically detected. Example: 'windows-1252'.
  "svn.default.encoding": null,

  // The default location to checkout a svn repository.
  "svn.defaultCheckoutDirectory": null,

  // When a file is deleted, what SVN should do? `none` - Do nothing, `prompt` - Ask the action, `remove` - automatically remove from SVN
  "svn.delete.actionForDeletedFiles": "prompt"  // values: ["none","prompt","remove"],

  // Ignored files/rules for `svn.delete.actionForDeletedFiles`(Ex.: file.txt or **/*.txt)
  "svn.delete.ignoredRulesForDeletedFiles": [],

  // Controls whether to automatically detect svn externals.
  "svn.detectExternals": true,

  // Controls whether to automatically detect svn on ignored folders.
  "svn.detectIgnored": true,

  // Path to external diff tool wrapper (e.g., batch file for Beyond Compare). Used with 'Diff with External Tool' command
  "svn.diff.tool": null,

  // Show diff changes using latest revision in the repository. Set false to use latest revision in local folder
  "svn.diff.withHead": true,

  // Whether svn is enabled
  "svn.enabled": true,

  // Try the experimental encoding detection
  "svn.experimental.detect_encoding": null,

  // Priority of encoding
  "svn.experimental.encoding_priority": [],

  // Url for the gravitar icon using the <AUTHOR>, <AUTHOR_MD5> and <SIZE> placeholders
  "svn.gravatar.icon_url": "https://www.gravatar.com/avatar/<AUTHOR_MD5>.jpg?s=<SIZE>&d=robohash",

  // Use garavatar icons in log viewers
  "svn.gravatars.enabled": true,

  // Ignores the warning when SVN is missing
  "svn.ignoreMissingSvnWarning": null,

  // List of SVN repositories to ignore.
  "svn.ignoreRepositories": null,

  // Ignores the warning when working copy is too old
  "svn.ignoreWorkingCopyIsTooOld": null,

  // Regex to detect path for 'branches' in SVN URL, 'null' to disable. Subpath use 'branches/[^/]+/([^/]+)(/.*)?' (Ex.: 'branches/...', 'versions/...')
  "svn.layout.branchesRegex": "branches/([^/]+)(/.*)?",

  // Regex group position for name of branch
  "svn.layout.branchesRegexName": 1,

  // Set true to show 'branches/<name>' and false to show only '<name>'
  "svn.layout.showFullName": true,

  // Regex group position for name of tag
  "svn.layout.tagRegexName": 1,

  // Regex to detect path for 'tags' in SVN URL, 'null' to disable. Subpath use 'tags/[^/]+/([^/]+)(/.*)?'. (Ex.: 'tags/...', 'stamps/...')
  "svn.layout.tagsRegex": "tags/([^/]+)(/.*)?",

  // Regex to detect path for 'trunk' in SVN URL, 'null' to disable. (Ex.: '(trunk)', '(main)')
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

  // Only show previous commits for a given user. Requires svn >= 1.8
  "svn.previousCommitsUser": null,

  // Refresh remote changes on refresh command
  "svn.refresh.remoteChanges": null,

  // Set the interval in seconds to check changed files on remote repository and show in statusbar. 0 to disable
  "svn.remoteChanges.checkFrequency": 300,

  // Show the output window when the extension starts
  "svn.showOutput": null,

  // Show the update message when update is run
  "svn.showUpdateMessage": true,

  // Set left click functionality on changes resource state
  "svn.sourceControl.changesLeftClick": "open diff"  // values: ["open","open diff"],

  // Combine the svn external in the main if is from the same server.
  "svn.sourceControl.combineExternalIfSameServer": null,

  // Allow to count unversioned files in status count
  "svn.sourceControl.countUnversioned": true,

  // Hide unversioned files in Source Control UI
  "svn.sourceControl.hideUnversioned": null,

  // Ignore unversioned files like .gitignore, Configuring this will overlook the default ignore rule
  "svn.sourceControl.ignore": [],

  // Changelists to ignore on commit
  "svn.sourceControl.ignoreOnCommit": ["ignore-on-commit"],

  // Changelists to ignore on status count
  "svn.sourceControl.ignoreOnStatusCount": ["ignore-on-commit"],

  // Set to ignore externals definitions on update (add --ignore-externals)
  "svn.update.ignoreExternals": true
}
```
<!--end-settings-->
