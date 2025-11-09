# Security Framework - Phase 0.3

## Overview

Error sanitization framework prevents sensitive data exposure in logs, error messages, and crash reports.

## Components

### 1. Error Sanitizer Module
**File**: `src/security/errorSanitizer.ts`

Core functions:

- `sanitizeError(error: Error | string): string` - Sanitize Error objects
- `sanitizeString(input: string): string` - Strip sensitive patterns
- `sanitizeObject<T>(obj: T): Partial<T>` - Recursively sanitize object values
- `createSanitizedErrorLog(error: any): Record<string, any>` - Create safe error logs

#### Patterns Sanitized

| Pattern | Example Input | Output |
|---------|---------------|--------|
| Windows paths | `C:\Users\john\repo` | `[PATH]` |
| Unix paths | `/home/john/repo` | `[PATH]` |
| URLs (HTTP/HTTPS) | `https://api.example.com` | `[DOMAIN]` |
| IPv4 addresses | `192.168.1.100` | `[IP]` |
| IPv6 addresses | `fe80::1` | `[IP]` |
| Key=value credentials | `password=abc123` | `password=[REDACTED]` |
| Query string params | `?token=xyz&pwd=abc` | `?token=[REDACTED]&pwd=[REDACTED]` |
| Bearer tokens | `Bearer eyJhbGc...` | `Bearer [REDACTED]` |
| Basic auth | `Basic dXNlcjpwYXNz` | `Basic [REDACTED]` |
| Long quoted secrets | `"a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"` | `"[REDACTED]"` |
| UUIDs/GUIDs | `550e8400-e29b-41d4-a716-446655440000` | `[UUID]` |
| AWS keys | `AKIA1234567890ABCDEF` | `[AWS_KEY]` |
| Email addresses | `user@example.com` | `[EMAIL]` |

### 2. Integration with SvnError
**File**: `src/svnError.ts` (lines 30-43)

Modified `toString()` method:
- Sanitizes error message before JSON output
- Applies sanitization to stdout/stderr fields
- Sanitizes stack traces
- Maintains JSON structure for parsing

**Changes**:
```typescript
// Added import
import { sanitizeString, createSanitizedErrorLog } from "./security/errorSanitizer";

// Updated toString() method
public toString(): string {
  const errorLog = createSanitizedErrorLog(this);
  let result =
    sanitizeString(this.message) +
    " " +
    JSON.stringify(errorLog, null, 2);

  if (this.error) {
    result += sanitizeString((this.error as any).stack || "");
  }

  return result;
}
```

### 3. Test Suite
**File**: `src/security/errorSanitizer.test.ts`

Coverage:
- Path sanitization (Windows, Unix)
- URL and IP sanitization (IPv4, IPv6)
- Credential stripping (passwords, tokens, keys)
- Email and UUID redaction
- Error object integration
- SvnError integration
- Edge cases (empty strings, multiple patterns, null values)

## Usage

### Direct Sanitization
```typescript
import { sanitizeError, sanitizeString } from "./security/errorSanitizer";

// Sanitize error messages
const safe = sanitizeError(error);
console.log(safe); // "[PATH] auth failed with [REDACTED]"

// Sanitize strings
const input = "Password: abc123 at C:\\app";
const output = sanitizeString(input);
// "Password: [REDACTED] at [PATH]"
```

### Error Log Creation
```typescript
import { createSanitizedErrorLog } from "./security/errorSanitizer";

const safeLog = createSanitizedErrorLog(svnError);
logToService(safeLog); // Safe to send to external services
```

### Object Sanitization
```typescript
import { sanitizeObject } from "./security/errorSanitizer";

const data = {
  message: "Auth failed at /app with token=xyz",
  details: { ip: "192.168.1.1" }
};
const safe = sanitizeObject(data);
// All string values are sanitized recursively
```

## Security Properties

1. **Readable Structure**: Error messages remain understandable after sanitization
2. **Comprehensive Coverage**: Multiple sensitive pattern types handled
3. **Deep Sanitization**: Recursive object traversal catches nested secrets
4. **Graceful Degradation**: Non-string fields preserved unchanged
5. **No False Positives**: Legitimate hashes/IDs preserved where possible

## Implementation Guidelines

### When to Sanitize

- Before logging to external services
- Before including in error reports
- Before sending crash data
- Before displaying in UI error messages
- Before writing to public logs

### When NOT to Sanitize

- Internal debug logs (development only)
- Data stored in SecureStorage
- Encrypted logs
- Already-redacted data

## Performance Considerations

- Regex patterns optimized for common cases
- Early returns for empty/null inputs
- Single-pass object traversal
- Suitable for real-time error processing

## Future Enhancements

Phase 0.4+ considerations:
- Custom pattern registration
- Configurable sanitization levels
- Performance metrics collection
- Audit trail for sanitization actions
- Integration with SIEM systems

## Related Security Phases

- **Phase 0.1**: Secret scanning in CI/CD
- **Phase 0.2**: Secure credential storage
- **Phase 0.3**: Error sanitization (current)
- **Phase 0.4**: Logging framework
- **Phase 0.5**: Audit trail implementation
