# Error Sanitizer - Real-World Examples

## Example 1: Authentication Error

### Before Sanitization
```
SVN error: Authentication failed at C:\Users\john\Projects\myapp with password=MySecureP@ssw0rd123

{
  "exitCode": 1,
  "svnErrorCode": "E200015",
  "svnCommand": "svn update C:\Users\john\Projects\myapp --password MySecureP@ssw0rd123",
  "stdout": "Updating C:\Users\john\Projects\myapp",
  "stderr": "svn: E200015: Authentication failed"
}

Error
    at svnRepository.ts:42:15
    at C:\Users\john\Projects\myapp\node_modules\src\index.ts:10:5
```

### After Sanitization
```
SVN error: Authentication failed at [PATH] with password=[REDACTED]

{
  "exitCode": 1,
  "svnErrorCode": "E200015",
  "svnCommand": "svn update [PATH] --password [REDACTED]",
  "stdout": "Updating [PATH]",
  "stderr": "svn: E200015: Authentication failed"
}

Error
    at svnRepository.ts:42:15
    at [PATH]\node_modules\src\index.ts:10:5
```

## Example 2: Network Connection Error

### Before Sanitization
```
SVN error: Connection refused from server at https://svn.internal-corp.com:8443/repo

{
  "exitCode": 1,
  "svnErrorCode": "E210001",
  "svnCommand": "svn checkout https://svn.internal-corp.com:8443/repo --username admin --password corp123!",
  "stdout": "Attempting to connect to 192.168.100.50",
  "stderr": "svn: E210001: OPTIONS request failed on '/repo'"
}
```

### After Sanitization
```
SVN error: Connection refused from server at [DOMAIN]

{
  "exitCode": 1,
  "svnErrorCode": "E210001",
  "svnCommand": "svn checkout [DOMAIN] --username admin --password [REDACTED]",
  "stdout": "Attempting to connect to [IP]",
  "stderr": "svn: E210001: OPTIONS request failed on '/repo'"
}
```

## Example 3: API Integration Error

### Before Sanitization
```
SVN error: Failed to retrieve metadata from /app/svn/handler with api_key=sk_live_REDACTED_EXAMPLE

{
  "exitCode": 1,
  "svnErrorCode": "E200000",
  "svnCommand": "svn info /app/svn/handler",
  "stdout": "User: user@company.com, Session: 550e8400-e29b-41d4-a716-446655440000",
  "stderr": "Authorization failed: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U"
}
```

### After Sanitization
```
SVN error: Failed to retrieve metadata from [PATH] with api_key=[REDACTED]

{
  "exitCode": 1,
  "svnErrorCode": "E200000",
  "svnCommand": "svn info [PATH]",
  "stdout": "User: [EMAIL], Session: [UUID]",
  "stderr": "Authorization failed: Bearer [REDACTED]"
}
```

## Example 4: AWS Credential Leak

### Before Sanitization
```
SVN error: Temporary credential access failed

{
  "exitCode": 1,
  "svnErrorCode": "E200008",
  "svnCommand": "svn update /home/ec2-user/workspace",
  "stdout": "Accessing remote with AKIA1234567890ABCDEF",
  "stderr": "Access denied from 10.0.0.100:443 with token=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
}
```

### After Sanitization
```
SVN error: Temporary credential access failed

{
  "exitCode": 1,
  "svnErrorCode": "E200008",
  "svnCommand": "svn update [PATH]",
  "stdout": "Accessing remote with [AWS_KEY]",
  "stderr": "Access denied from [IP] with token=[REDACTED]"
}
```

## Example 5: Unix System Error

### Before Sanitization
```
SVN error: File access denied at /home/devuser/projects/svn-repo

{
  "exitCode": 1,
  "svnErrorCode": "E200009",
  "svnCommand": "svn commit /home/devuser/projects/svn-repo -m 'Deploy from 203.0.113.45 using token=prod_abc123xyz'",
  "stdout": "Checking repository at 203.0.113.45:22 from user devuser@company.com",
  "stderr": "svn: E200009: Cannot access the working copy"
}
```

### After Sanitization
```
SVN error: File access denied at [PATH]

{
  "exitCode": 1,
  "svnErrorCode": "E200009",
  "svnCommand": "svn commit [PATH] -m 'Deploy from [IP] using token=[REDACTED]'",
  "stdout": "Checking repository at [IP]:22 from user [EMAIL]",
  "stderr": "svn: E200009: Cannot access the working copy"
}
```

## Example 6: Complex Multi-Factor Error

### Before Sanitization
```
SVN error: Multi-step authentication failed at fe80::1 with credentials

{
  "exitCode": 1,
  "svnErrorCode": "E200015",
  "svnCommand": "svn log C:\\projects\\enterprise /app/data -u john.doe@enterprise.local -p 'P@ssw0rd!2024'",
  "stdout": "Connecting to https://svn-prod.corp.local:8443/repo?session=550e8400-e29b-41d4-a716-446655440000",
  "stderr": "Authentication via Basic YWRtaW46c2VjcmV0IQ== failed. Retry with correct credentials from C:\\credentials\\vault.json"
}
```

### After Sanitization
```
SVN error: Multi-step authentication failed at [IP] with credentials

{
  "exitCode": 1,
  "svnErrorCode": "E200015",
  "svnCommand": "svn log [PATH] [PATH] -u [EMAIL] -p [REDACTED]",
  "stdout": "Connecting to [DOMAIN]?session=[UUID]",
  "stderr": "Authentication via Basic [REDACTED] failed. Retry with correct credentials from [PATH]"
}
```

## Pattern Matching Verification

### Test Case: Windows Path
**Input**: `C:\Users\Administrator\AppData\Local\Programs\svn\bin\svn.exe`
**Pattern**: Windows drive letter + path
**Output**: `[PATH]`

### Test Case: Email in Error
**Input**: `Please contact support@company.com for assistance`
**Pattern**: Email address
**Output**: `Please contact [EMAIL] for assistance`

### Test Case: Multiple IPs
**Input**: `Failed at 192.168.1.1 from 10.0.0.100 via 172.16.0.50`
**Pattern**: IPv4 addresses
**Output**: `Failed at [IP] from [IP] via [IP]`

### Test Case: Nested Query Params
**Input**: `?username=admin&password=secret&token=abc&api_key=xyz123`
**Pattern**: Query string credentials
**Output**: `?username=admin&password=[REDACTED]&token=[REDACTED]&api_key=[REDACTED]`

### Test Case: Bearer Token
**Input**: `Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9`
**Pattern**: Bearer token
**Output**: `Authorization: Bearer [REDACTED]`

### Test Case: AWS Key
**Input**: `Using credentials AKIAIOSFODNN7EXAMPLE`
**Pattern**: AWS key pattern
**Output**: `Using credentials [AWS_KEY]`

## Logging Integration

### Console Output (Safe to Share)
```
[ERROR] 2025-11-09T23:37:51Z - SVN error:
  Auth failed at [PATH] with [REDACTED] from [IP]
  See [DOMAIN] for help, contact [EMAIL]
```

### External Service Submission (No Sensitive Data)
```json
{
  "timestamp": "2025-11-09T23:37:51Z",
  "level": "error",
  "component": "SvnRepository",
  "message": "SVN error: Auth failed at [PATH] with [REDACTED]",
  "metadata": {
    "exitCode": 1,
    "svnErrorCode": "E200015",
    "svnCommand": "svn update [PATH] --password [REDACTED]"
  }
}
```

### Support Ticket (Ready to Share with Users)
```
Issue: SVN Update Failed

Error: Authentication failed at [PATH] with [REDACTED]

Details:
- Command: svn update [PATH]
- Exit Code: 1
- Error Code: E200015

Please verify your credentials and repository path.
```

## Benefits Demonstrated

1. **Security**: No paths, passwords, tokens, or IPs exposed
2. **Usability**: Error messages remain clear and actionable
3. **Compliance**: Safe for external logging/monitoring services
4. **Debuggability**: Enough context to diagnose issues
5. **Audit**: Pattern tracking for security metrics
