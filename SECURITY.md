# Security Framework

Error sanitization prevents sensitive data exposure in logs, errors, and crash reports.

## Components

### Error Sanitizer (`src/security/errorSanitizer.ts`)

**Functions:**
- `sanitizeError(error)` - Sanitize Error objects
- `sanitizeString(input)` - Strip sensitive patterns
- `sanitizeObject(obj)` - Recursively sanitize values
- `createSanitizedErrorLog(error)` - Create safe logs

**Patterns Sanitized:**

| Pattern | Example | Output |
|---------|---------|--------|
| Windows paths | `C:\Users\john\repo` | `[PATH]` |
| Unix paths | `/home/john/repo` | `[PATH]` |
| URLs | `https://api.example.com` | `[DOMAIN]` |
| IPv4/IPv6 | `192.168.1.100`, `fe80::1` | `[IP]` |
| Credentials | `password=abc123` | `password=[REDACTED]` |
| Tokens | `Bearer eyJhbGc...` | `Bearer [REDACTED]` |
| AWS keys | `AKIA1234567890ABCDEF` | `[AWS_KEY]` |
| Email | `user@example.com` | `[EMAIL]` |
| UUIDs | `550e8400-e29b-...` | `[UUID]` |

### Integration with SvnError (`src/svnError.ts:30-43`)

`toString()` method sanitizes:
- Error message
- stdout/stderr fields
- Stack traces
- JSON output

## Examples

### Before/After Sanitization

**Authentication Error:**
```
Before: Auth failed at C:\Users\john\app with password=MyPass123
After:  Auth failed at [PATH] with password=[REDACTED]
```

**Network Error:**
```
Before: Connection refused at https://svn.corp.com:8443 from 192.168.1.100
After:  Connection refused at [DOMAIN] from [IP]
```

**AWS Credentials:**
```
Before: Accessing with AKIA1234567890ABCDEF and token=wJalrXUtnFEMI/K7MDENG
After:  Accessing with [AWS_KEY] and token=[REDACTED]
```

**Multi-pattern Error:**
```
Before: svn commit C:\projects\app -u john@corp.com -p 'Pass!2024' from 10.0.0.1
After:  svn commit [PATH] -u [EMAIL] -p [REDACTED] from [IP]
```

## Usage

```typescript
import { sanitizeError, sanitizeString, sanitizeObject } from "./security/errorSanitizer";

// Sanitize errors
console.log(sanitizeError(error));

// Sanitize strings
const safe = sanitizeString("Password: abc at C:\\app");
// "Password: [REDACTED] at [PATH]"

// Sanitize objects (recursive)
const safeLog = sanitizeObject({ msg: "Auth at /app", ip: "10.0.0.1" });
logToService(safeLog); // Safe for external services
```

## Guidelines

**When to sanitize:**
- External logging services
- Error reports/crash data
- UI error messages
- Public logs

**When NOT to sanitize:**
- Internal debug (dev only)
- SecureStorage data
- Encrypted logs
- Already-redacted data

## Tests (`src/security/errorSanitizer.test.ts`)

Coverage:
- Path sanitization (Windows, Unix)
- URLs, IPs (IPv4, IPv6)
- Credentials (passwords, tokens, keys)
- Email, UUID redaction
- Error/SvnError integration
- Edge cases (empty, null, multiple patterns)

## Performance

- Optimized regex patterns
- Early returns for empty inputs
- Single-pass object traversal
- Suitable for real-time processing
