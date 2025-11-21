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

## Positron Integration

Enhanced integration with Posit's Positron IDE for data science workflows.

**Connections Pane**:
- View SVN repositories alongside database connections
- Quick checkout wizard with URL and directory inputs
- Repository metadata display (branch, revision, remote URL)

**Setup**: Automatically enabled when running in Positron. No configuration needed.

**Privacy**: All operations are local. No data sent to Posit or external services. See [PRIVACY.md](./PRIVACY.md) for details.

**What is Positron?** A next-generation IDE for data science by Posit PBC (creators of RStudio). Fork of VS Code optimized for R, Python, and Julia workflows.

Learn more: https://posit.co/products/ide/positron/

For technical details, see [docs/POSITRON_INTEGRATION.md](./docs/POSITRON_INTEGRATION.md).

## Authentication & Security

The extension provides secure authentication with multiple methods and comprehensive credential protection.

### Security Warning: Upgrade from v2.17.229 or Earlier

> **⚠️ CRITICAL:** Versions prior to v2.17.230 expose passwords in process listings. **Upgrade immediately** to v2.17.230+ to eliminate this security risk.

### Authentication Methods

**Recommended (in priority order):**

1. **SSH Key Authentication** ⭐ BEST PRACTICE
   - **Repository URL:** `svn+ssh://user@svn.example.com/repo`
   - **Security:** Public key cryptography, zero credential exposure
   - **Setup:**
     ```bash
     ssh-keygen -t ed25519 -C "your_email@example.com"
     ssh-copy-id user@svn.example.com
     ```
   - **When to use:** Production environments, shared servers, automated systems

2. **Password Authentication** (Secure with Credential Cache)
   - **Repository URL:** `https://svn.example.com/repo`
   - **Security:** Credentials stored in SVN cache (`~/.subversion/auth/`, mode 600)
   - **Setup:** Extension prompts for password, automatically caches securely
   - **When to use:** Quick testing, HTTPS-only repositories, personal projects

3. **Public Repository** (No Authentication)
   - **Repository URL:** `http://svn.example.com/public-repo`
   - **Security:** No credentials needed
   - **When to use:** Open-source projects, publicly accessible repositories

### How Credential Caching Works

**v2.17.230+** uses SVN's native credential cache for maximum security:

1. You enter username/password in VS Code UI prompt
2. Extension writes credentials to `~/.subversion/auth/svn.simple/<uuid>` (file mode 600)
3. SVN commands executed **without** `--password` flag
4. SVN reads credentials from cache automatically
5. ✅ **Result:** No password exposure in process list, container logs, or CI/CD logs

**Before v2.17.230:**
```bash
$ ps aux | grep svn
user 12345 svn update --password "MyPassword123"  # ❌ EXPOSED
```

**After v2.17.230:**
```bash
$ ps aux | grep svn
user 12345 svn update --username alice  # ✅ SECURE (no password)
```

### Authentication Method Indicators

Extension shows which auth method is active in the Output panel:

- `[auth: SSH key]` - SSH key authentication (most secure)
- `[auth: password via credential cache]` - Cached password (secure)
- `[auth: none - public repository]` - No authentication required

**Example output:**
```
[my-project]$ svn update --username alice [auth: password via credential cache]
At revision 1234.
```

This helps verify your authentication is configured correctly.

### Debugging Authentication Issues

#### Enable Verbose Output

1. Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Run: `SVN: Show Output`
3. Check authentication method indicators in logs

#### Common Issues

**Problem:** "Authentication failed" but credentials are correct
```
[repo]$ svn update --username alice [auth: password via credential cache]
svn: E170001: Authentication failed
```

**Solutions:**
1. Clear credential cache: `rm -rf ~/.subversion/auth/`
2. Re-enter credentials when prompted
3. Verify repository URL is correct
4. Check SVN server is accessible: `svn info <repo-url>`

**Problem:** Extension prompts for password repeatedly
```
ℹ No credentials configured - will prompt if needed
```

**Solutions:**
1. Ensure credentials are being cached (check `~/.subversion/auth/`)
2. Verify file permissions: `ls -la ~/.subversion/auth/svn.simple/` (should be 600)
3. Try manual SVN command: `svn update` (should not prompt if cache works)

**Problem:** Want to see raw error messages for debugging

**Solution:** Enable debug mode (⚠️ **TEMPORARY ONLY**):
```json
{
  "svn.debug.disableSanitization": true
}
```

**⚠️ WARNING:**
- Debug mode exposes credentials in logs
- Extension shows prominent warning when enabled
- Only enable temporarily for troubleshooting
- **Disable immediately after debugging**

When enabled, you'll see:
```
⚠️⚠️⚠️ SECURITY WARNING ⚠️⚠️⚠️
Error sanitization is DISABLED
Credentials WILL BE VISIBLE in logs
Disable: svn.debug.disableSanitization = false
⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️
```

Plus a dialog with **[Disable Now]** button.

#### Verify Authentication Setup

**Check credential cache:**
```bash
# List cached credentials
ls -la ~/.subversion/auth/svn.simple/

# Should show files with permissions: -rw------- (600)
```

**Check SVN version:**
```bash
svn --version
# Requires SVN 1.6+ for credential cache
```

**Test repository access:**
```bash
svn info <your-repo-url>
# Should show repository information without prompting
```

### Best Practices

#### Production Environments
- ✅ Use SSH keys (`svn+ssh://`)
- ✅ Enable MFA on SVN server
- ✅ Keep SVN client updated
- ❌ Never use `svn.debug.disableSanitization` in production
- ❌ Avoid HTTP URLs (use HTTPS or svn+ssh://)

#### Development Workstations
- ✅ Use HTTPS with credential cache for personal projects
- ✅ Use SSH keys for shared/company repositories
- ✅ Protect `~/.subversion/auth/` directory (mode 700)
- ✅ Regularly update extension and SVN client

#### CI/CD Pipelines
- ✅ Use SSH keys stored in CI/CD secrets
- ✅ Use repository access tokens (if supported by SVN server)
- ❌ Never pass passwords via environment variables
- ❌ Never commit credentials to `.vscode/settings.json`

**Example GitHub Actions:**
```yaml
- name: Setup SSH key
  run: |
    mkdir -p ~/.ssh
    echo "${{ secrets.SVN_SSH_KEY }}" > ~/.ssh/id_rsa
    chmod 600 ~/.ssh/id_rsa
- run: svn checkout svn+ssh://svn.example.com/repo
```

### Security Features

1. **Error Sanitization**
   - Automatic redaction of passwords, tokens, paths, URLs
   - Active by default in all logs and error messages
   - Protects against accidental credential exposure

2. **SecretStorage Integration**
   - Passwords stored in OS keychain (encrypted)
     - **macOS:** Keychain Access
     - **Windows:** Credential Manager
     - **Linux:** Secret Service (gnome-keyring, KWallet)
   - Never stored in plaintext in extension settings

3. **Credential Cache Protection**
   - Files stored with mode 600 (user-only access)
   - Automatic cleanup of old credentials
   - Isolated per repository/realm

4. **Audit Trail**
   - All auth operations logged (credentials redacted)
   - Authentication method always visible
   - Debug mode warnings prevent accidental exposure

### Troubleshooting Checklist

- [ ] Check authentication method indicator in Output panel
- [ ] Verify repository URL is correct (HTTPS vs svn+ssh://)
- [ ] Test SVN access outside VS Code: `svn info <repo-url>`
- [ ] Check credential cache: `ls ~/.subversion/auth/svn.simple/`
- [ ] Verify SVN version: `svn --version` (requires 1.6+)
- [ ] Review error messages in Output panel
- [ ] Try clearing cache: `rm -rf ~/.subversion/auth/` and re-enter credentials
- [ ] For persistent issues, enable debug mode temporarily (see above)

### Security Resources

- [SECURITY.md](./SECURITY.md) - Security policy and vulnerability reporting
- [SVN Security Best Practices](https://subversion.apache.org/docs/community-guide/conventions.html#security)
- [Issue Tracker](https://github.com/vrognas/positron-svn/issues) - Report bugs (not security vulnerabilities)

For security vulnerabilities, use [GitHub Security Advisories](https://github.com/vrognas/positron-svn/security/advisories).

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
