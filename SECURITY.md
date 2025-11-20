# Security Policy

## Supported Versions

| Version | Supported          | Security Features |
| ------- | ------------------ | ----------------- |
| 2.17.230+ | :white_check_mark: | Credential cache, error sanitization |
| 2.17.0 - 2.17.229 | :x: | **PASSWORD EXPOSURE RISK** |
| < 2.17.0 | :x: | Not supported |

**Critical:** Versions prior to 2.17.230 expose passwords in process listings. Upgrade immediately.

## Reporting a Vulnerability

**Please DO NOT file public GitHub issues for security vulnerabilities.**

### Contact

Report security vulnerabilities privately via:

1. **GitHub Security Advisories** (preferred)
   - Go to: https://github.com/vrognas/positron-svn/security/advisories
   - Click "Report a vulnerability"
   - Provide detailed information

2. **Email**
   - Send to: [repository maintainer email]
   - Subject: "SECURITY: [brief description]"
   - Include: version, steps to reproduce, impact assessment

### Response Timeline

- **Initial response:** Within 48 hours
- **Impact assessment:** Within 7 days
- **Fix timeline:** Based on severity
  - Critical: 1-3 days
  - High: 7-14 days
  - Medium: 30 days
  - Low: Next release cycle

### What to Include

- Extension version (`Help` → `About` in VS Code)
- SVN version (`svn --version`)
- Operating system and version
- Steps to reproduce the vulnerability
- Potential impact (who is affected, what data is at risk)
- Any suggested fixes (optional)

## Security Features

### Credential Protection

**v2.17.230+** implements multiple layers of credential security:

#### 1. SVN Credential Cache (Default)
- Credentials written to `~/.subversion/auth/` (mode 600)
- Never passed via command-line arguments
- Not visible in process listings (`ps`, `top`, etc.)
- Automatically managed by SVN

#### 2. Error Sanitization
- All error messages sanitized before logging
- Removes: passwords, tokens, file paths, URLs, IP addresses
- Configurable debug mode for troubleshooting

#### 3. SecretStorage Integration
- Passwords stored in OS keychain (encrypted)
  - **macOS:** Keychain Access
  - **Windows:** Credential Manager
  - **Linux:** Secret Service (gnome-keyring, KWallet)
- Never stored in plaintext in extension settings

#### 4. Authentication Method Indicators
- Visible confirmation of auth method in use
- Examples:
  - `[auth: SSH key]` - Most secure (svn+ssh://)
  - `[auth: password via credential cache]` - Secure
  - `[auth: none - public repository]` - No auth needed

### Known Security Limitations

#### 1. Credential Cache Files (mode 600)
- **Risk:** Local file system access
- **Mitigation:** File permissions restrict to user only
- **Residual risk:** LOW - requires local shell access
- **CVSS 3.1:** 3.2 (Low)

#### 2. SVN Client Security
- Extension relies on system SVN client
- Vulnerabilities in SVN client affect extension
- **Mitigation:** Keep SVN updated (`svn --version`)

#### 3. Repository Access
- Extension cannot prevent:
  - Weak repository passwords
  - Compromised SVN server
  - Man-in-the-middle attacks on HTTP URLs
- **Mitigation:** Use HTTPS or svn+ssh:// URLs

#### 4. Debug Mode Credential Exposure
- Setting `svn.debug.disableSanitization: true` exposes credentials in logs
- **Mitigation:**
  - Prominent warning shown
  - One-click disable option
  - Never enable in production

## Security Best Practices

### Recommended Authentication Methods

**Priority order (most secure first):**

1. **SSH Key Authentication** ⭐ BEST
   ```
   Repository URL: svn+ssh://user@svn.example.com/repo
   Setup: ssh-keygen, ssh-copy-id
   Security: Public key cryptography, no password transmission
   ```

2. **HTTPS with Credential Cache** ⭐ RECOMMENDED
   ```
   Repository URL: https://svn.example.com/repo
   Setup: Extension prompts for password, saves to cache
   Security: Encrypted transmission, cached credentials (mode 600)
   ```

3. **HTTP (Local Networks Only)**
   ```
   Repository URL: http://svn.local/repo
   Security: Unencrypted - only for trusted local networks
   ```

### Configuration Hardening

**Recommended settings in `.vscode/settings.json`:**

```json
{
  // NEVER enable debug sanitization in production
  "svn.debug.disableSanitization": false,

  // Reduce attack surface
  "svn.sourceControl.countUnversioned": false,
  "svn.detectExternals": false,

  // Security-conscious defaults
  "svn.commit.checkEmptyMessage": true
}
```

### CI/CD Security

**For GitHub Actions, GitLab CI, etc.:**

```yaml
# ❌ NEVER do this:
- run: svn checkout https://svn.example.com/repo --username user --password ${{ secrets.SVN_PASSWORD }}

# ✅ Use SSH keys instead:
- name: Setup SSH key
  run: |
    mkdir -p ~/.ssh
    echo "${{ secrets.SVN_SSH_KEY }}" > ~/.ssh/id_rsa
    chmod 600 ~/.ssh/id_rsa
- run: svn checkout svn+ssh://svn.example.com/repo
```

### Development Workstation Security

1. **Use SSH keys for all repositories**
   ```bash
   ssh-keygen -t ed25519 -C "your_email@example.com"
   ssh-copy-id user@svn.example.com
   ```

2. **Enable automatic updates**
   - Extension auto-updates via VS Code marketplace
   - Update SVN client regularly: `brew upgrade subversion` (macOS) or package manager

3. **Protect credential cache**
   ```bash
   # Verify permissions
   ls -la ~/.subversion/auth/svn.simple/
   # Should show: -rw------- (600)
   ```

4. **Use multi-factor authentication**
   - Enable MFA on your SVN server if supported
   - Use time-based passwords (TOTP) where available

## Security Changelog

### v2.17.230 (2025-11-20) - Critical Security Update

**SECURITY:**
- **FIXED:** Password exposure in process list (CVSS 7.5 → 3.2)
  - Credentials no longer passed via `--password` command-line flag
  - Implemented SVN native credential cache
  - Credentials written to `~/.subversion/auth/` with mode 600

**ADDED:**
- Error sanitization system
  - Automatic redaction of passwords, tokens, paths, URLs
  - Debug mode with prominent security warnings
- Authentication method indicators
  - `[auth: SSH key]` - SSH key authentication
  - `[auth: password via credential cache]` - Cached password
  - `[auth: none - public repository]` - No authentication
- SecretStorage integration
  - OS keychain support (Keychain/Credential Manager/Secret Service)
  - Encrypted password storage

**IMPROVED:**
- Enhanced auth error messages with troubleshooting guidance
- Debug mode warnings prevent accidental credential exposure

### Previous Versions (< 2.17.230)

**VULNERABILITY:**
- Passwords visible in process listings
- Credentials exposed in:
  - `ps aux` output (Linux/macOS)
  - Task Manager (Windows)
  - Container logs (Docker, Kubernetes)
  - CI/CD build logs
  - System audit logs

**Impact:** Any user on system could read passwords during 2-30 second window

**Mitigation:** Upgrade to v2.17.230 or later immediately

## Vulnerability Disclosure History

### CVE-PENDING: Command-line Password Exposure (v2.17.229 and earlier)

- **Discovered:** 2025-11-18
- **Fixed in:** v2.17.230
- **Severity:** HIGH (CVSS 7.5)
- **Description:** Passwords passed via `--password` flag visible in process list
- **Affected versions:** All versions < 2.17.230
- **Mitigation:** Upgrade to v2.17.230+

## Security Resources

### External References

- [SVN Security Best Practices](https://subversion.apache.org/docs/community-guide/conventions.html#security)
- [OWASP Credential Management](https://cheatsheetseries.owasp.org/cheatsheets/Credential_Storage_Cheat_Sheet.html)
- [VS Code Security Guidelines](https://code.visualstudio.com/api/references/extension-guidelines#security)

### Internal Documentation

- [Debug Authentication Guide](./README.md#debugging-authentication) - Troubleshooting auth issues
- [LESSONS_LEARNED.md](./docs/LESSONS_LEARNED.md) - Architecture security insights
- [ARCHITECTURE_ANALYSIS.md](./docs/ARCHITECTURE_ANALYSIS.md) - Security design decisions

## Compliance

### Data Protection

- **GDPR:** Extension does not collect or transmit user data
- **CCPA:** No personal data shared with third parties
- **SOC 2:** Credentials stored in OS-provided secure storage only

### Audit Trail

All authentication operations logged (credentials redacted):
```
[repo]$ svn update --username alice [auth: password via credential cache]
```

Logs never contain:
- Actual passwords or tokens
- Full file system paths
- Repository URLs with embedded credentials

## Security Testing

Extension security validated via:

1. **Unit tests:** 45+ test cases for credential handling
2. **Integration tests:** Process list verification
3. **Manual security audit:** Credential exposure testing
4. **Static analysis:** ESLint security rules
5. **Dependency scanning:** npm audit (0 production vulnerabilities)

## Contact

For security-related questions (non-vulnerabilities):
- GitHub Discussions: https://github.com/vrognas/positron-svn/discussions
- Email: [repository maintainer email]

For security vulnerabilities:
- **Use GitHub Security Advisories ONLY** (see "Reporting a Vulnerability" above)

---

**Last updated:** 2025-11-20
**Security version:** 2.17.230
