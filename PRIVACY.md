# Privacy Policy

**Extension**: SVN (Positron)
**Version**: 2.17.236+
**Last Updated**: 2025-11-21

---

## Overview

**This extension collects ZERO user data.**

We are committed to privacy-first software development. This extension operates entirely locally with no telemetry, analytics, or tracking of any kind.

---

## Data Collection

### What We Collect
**Nothing.** This extension does not collect, transmit, or store any user data on external servers.

### What We DON'T Collect
- ❌ No telemetry or usage statistics
- ❌ No analytics or tracking events
- ❌ No crash reports to external services
- ❌ No personally identifiable information (PII)
- ❌ No repository URLs, file paths, or code content
- ❌ No command history or user actions
- ❌ No device information or system configuration

---

## Local-Only Operations

All extension operations execute locally on your machine:

### Repository Operations
- **SVN commands**: Executed via system SVN client (local)
- **Repository data**: Stored in your workspace (local)
- **Commit messages**: Never leave your machine
- **File changes**: Processed locally only

### Extension State
- **Configuration**: Stored in VS Code/Positron settings (local)
- **Cache**: Blame/log cache in memory (local, cleared on restart)
- **Logs**: Output channel logs (local only, never transmitted)

### Development Tools
- **Console logs**: Visible in Developer Tools (local only)
- **Error messages**: Sanitized for credentials, logged locally

---

## Optional External Requests

### 1. Gravatar (User Avatar Images)

**Status**: Enabled by default, user-configurable

**What is it?**
- Service that displays commit author avatars in log viewers
- URL: `https://www.gravatar.com/avatar/<MD5_HASH>.jpg`

**Data sent**:
- MD5 hash of SVN commit author's email address (irreversible)
- Your IP address (standard HTTP request)

**Privacy impact**:
- Gravatar can track IP addresses across requests
- MD5 hash cannot be reversed to original email
- No personally identifiable information

**Disable**:
```json
{
  "svn.gravatars.enabled": false
}
```

**Alternative**: Use `svn.gravatar.icon_url` to self-host avatars

### 2. SVN Repository Access

**Purpose**: Fetch commits, push changes to your configured SVN repository

**Data sent**:
- SVN commands (update, commit, checkout, etc.)
- Repository credentials (SSH key or cached password)
- File changes, commit messages

**Destination**: Your configured SVN repository URL only

**Control**:
- Configure repository URL via workspace settings
- Use SSH keys for maximum security (see [Authentication & Security](./README.md#authentication--security))
- Credentials stored locally in SVN cache (`~/.subversion/auth/`, mode 600)

**Privacy note**: Data is sent to **your repository server**, not to us or any third party.

---

## Positron Integration

When running in Posit's Positron IDE, additional features are enabled.

### What Changes?
- **Connections pane**: SVN repositories appear in Positron's Connections pane
- **Quick checkout**: Wizard for repository checkout
- **Repository metadata**: Display of branch, revision, status

### Data Flow
- **Registration**: Local API call to Positron's connections manager
- **User inputs**: Stored in Positron's connection registry (local)
- **Code generation**: Happens client-side (no network calls)
- **Execution**: Runs SVN commands locally

### Data Collection in Positron?
**No.** The Positron integration is local-only:
- No data sent to Posit PBC
- No data sent to Positron servers
- Same privacy guarantees as VS Code

### Verify
Check Output channel for:
```
Running in Positron
Positron: SVN Connections provider registered
```
These are local logs only, never transmitted.

**Learn more**: [docs/POSITRON_INTEGRATION.md](./docs/POSITRON_INTEGRATION.md)

---

## Credential Storage

Credentials are stored locally with multiple security layers:

### SSH Keys (Recommended)
- Stored in `~/.ssh/` directory
- Managed by SSH agent
- Never exposed to extension code
- Most secure authentication method

### Password (Credential Cache)
- Stored in SVN credential cache: `~/.subversion/auth/svn.simple/`
- File permissions: mode 600 (user-only access)
- Never passed via command-line arguments
- Not visible in process listings

### OS Keychain (SecretStorage)
- **macOS**: Keychain Access (encrypted)
- **Windows**: Credential Manager (encrypted)
- **Linux**: Secret Service (gnome-keyring, KWallet)
- Credentials encrypted by operating system
- Never stored in plaintext in extension settings

**Learn more**: [README.md Authentication & Security](./README.md#authentication--security)

---

## Error Sanitization

All error messages are sanitized before logging to prevent credential exposure.

### What is redacted?
- Passwords and authentication tokens
- File paths and directory names
- Repository URLs
- IP addresses and hostnames
- Usernames (in some contexts)

### Debug Mode (⚠️ Temporary Use Only)
```json
{
  "svn.debug.disableSanitization": true
}
```

**WARNING**:
- Disabling sanitization exposes credentials in logs
- Only enable temporarily for troubleshooting
- **Disable immediately after debugging**
- Extension shows prominent warning when enabled

---

## Third-Party Services

### Analytics Providers
**None.** We do not use:
- PostHog
- Segment
- Amplitude
- Mixpanel
- Google Analytics
- Or any other analytics service

### Crash Reporting
**None.** We do not use:
- Sentry
- Rollbar
- Bugsnag
- Or any crash reporting service

### Telemetry
**None.** No usage statistics collected.

---

## Data Retention

### What We Store Locally
- **Configuration**: Indefinitely (until you change settings)
- **Blame cache**: Until VS Code/Positron restart
- **Log cache**: Until VS Code/Positron restart
- **Credentials**: Until you clear SVN cache

### What We Store Remotely
**Nothing.** We have no servers or databases.

---

## Your Rights

### Access Your Data
All data is stored locally on your machine:
- **Settings**: `.vscode/settings.json` or user settings
- **Credentials**: `~/.subversion/auth/`
- **Logs**: VS Code/Positron Output channel

### Delete Your Data
```bash
# Clear SVN credential cache
rm -rf ~/.subversion/auth/

# Uninstall extension
code --uninstall-extension vrognas.positron-svn
```

### Export Your Data
No export needed - all data is already in open formats on your machine.

---

## Compliance

### GDPR (EU)
Not applicable - no personal data collected or processed.

### CCPA (California)
Not applicable - no personal data collected or sold.

### Data Protection
This extension does not process, store, or transmit personal data in any way that would require registration as a data controller.

---

## Verification

### Audit the Source Code
This extension is open source. Verify privacy claims by reviewing:

1. **No analytics libraries** in `package.json`:
   ```bash
   grep -E "telemetry|analytics|segment|posthog" package.json
   # Result: No matches
   ```

2. **No network requests** (except Gravatar and SVN):
   ```bash
   grep -r "fetch\|http\.get\|axios\|request" src/
   # Result: Only Gravatar avatar URLs
   ```

3. **No telemetry code**:
   ```bash
   grep -ri "telemetry" src/
   # Result: No matches
   ```

### Repository
- **GitHub**: https://github.com/vrognas/positron-svn
- **License**: MIT (open source)
- **Issues**: https://github.com/vrognas/positron-svn/issues

---

## Changes to Privacy Policy

We will update this policy if privacy practices change.

**Notification**:
- Updated version number in CHANGELOG.md
- GitHub release notes
- Updated "Last Updated" date above

**No retroactive changes**: We will never retroactively add telemetry to released versions.

---

## Questions or Concerns?

**Privacy questions**: File an issue at https://github.com/vrognas/positron-svn/issues
**Security vulnerabilities**: See [SECURITY.md](./SECURITY.md) for reporting procedures

---

## Summary

✅ **Zero data collection**
✅ **Local-only operations**
✅ **Optional Gravatar** (disable with `svn.gravatars.enabled: false`)
✅ **Secure credential storage**
✅ **Open source** (audit the code)
✅ **No third-party services**

This extension respects your privacy. Your data stays on your machine.

---

**Last updated**: 2025-11-21 (v2.17.236)
**License**: MIT
**Maintainer**: Viktor Rognas
