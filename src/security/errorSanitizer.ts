/**
 * Security error sanitizer for Phase 0.3
 * Strips sensitive information from error messages before logging/display
 */

/**
 * Sanitize error messages by removing sensitive information
 * @param error Error object or string to sanitize
 * @returns Sanitized error message with sensitive data redacted
 */
export function sanitizeError(error: Error | string): string {
  const errorStr = typeof error === "string" ? error : error.message || String(error);
  return sanitizeString(errorStr);
}

/**
 * Sanitize a string by removing sensitive patterns
 * @param input String to sanitize
 * @returns Sanitized string with sensitive data redacted
 */
export function sanitizeString(input: string): string {
  if (!input) return input;

  let sanitized = input;

  // Strip Windows paths: C:\path\to\file → [PATH]
  sanitized = sanitized.replace(/[A-Z]:\\(?:[^\\/:*?"<>|\r\n]+\\)*[^\\/:*?"<>|\r\n]*/gi, "[PATH]");

  // Strip Unix paths: /path/to/file → [PATH]
  sanitized = sanitized.replace(/\/(?:[a-zA-Z0-9._\-~]+\/)*[a-zA-Z0-9._\-~]*/g, "[PATH]");

  // Strip URLs: https://example.com/path → [DOMAIN]
  sanitized = sanitized.replace(
    /https?:\/\/(?:(?:[a-zA-Z0-9\-._~:/?#\[\]@!$&'()*+,;=])+)/gi,
    "[DOMAIN]"
  );

  // Strip IPv4 addresses: 192.168.1.1 → [IP]
  sanitized = sanitized.replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[IP]");

  // Strip IPv6 addresses: fe80::1 → [IP]
  sanitized = sanitized.replace(/\b(?:[0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}\b/g, "[IP]");

  // Strip credentials in format: key=value (password, token, secret, etc.)
  sanitized = sanitized.replace(
    /(?:password|passwd|pwd|token|secret|api[_-]?key|auth|credential|apikey)\s*=\s*[^\s,;]+/gi,
    "$&=[REDACTED]"
  );

  // Strip credentials in query strings: ?password=abc&token=xyz → ?password=[REDACTED]&token=[REDACTED]
  sanitized = sanitized.replace(
    /[?&](?:password|passwd|pwd|token|secret|api[_-]?key|auth|credential|apikey)\s*=\s*[^\s&;]+/gi,
    (match) => {
      const [key] = match.split("=");
      return key + "=[REDACTED]";
    }
  );

  // Strip Bearer tokens: Bearer eyJhbGciOiJIUzI1NiI... → Bearer [REDACTED]
  sanitized = sanitized.replace(/Bearer\s+[A-Za-z0-9._\-~+/=]+/g, "Bearer [REDACTED]");

  // Strip Basic auth: Basic base64string → Basic [REDACTED]
  sanitized = sanitized.replace(/Basic\s+[A-Za-z0-9+/=]+/g, "Basic [REDACTED]");

  // Strip quoted strings that look like secrets (very long alphanumeric)
  sanitized = sanitized.replace(/"([A-Za-z0-9+/=_\-]{32,})"/g, '"[REDACTED]"');
  sanitized = sanitized.replace(/'([A-Za-z0-9+/=_\-]{32,})'/g, "'[REDACTED]'");

  // Strip UUIDs/GUIDs (often used as API keys or tokens)
  sanitized = sanitized.replace(
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
    "[UUID]"
  );

  // Strip AWS-style keys (AKIA...)
  sanitized = sanitized.replace(/AKIA[0-9A-Z]{16}/g, "[AWS_KEY]");

  // Strip email addresses: user@example.com → [EMAIL]
  sanitized = sanitized.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[EMAIL]");

  return sanitized;
}

/**
 * Sanitize an object by removing sensitive fields
 * @param obj Object to sanitize (typically error data)
 * @returns New object with sanitized string values
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): Partial<T> {
  if (!obj || typeof obj !== "object") return obj;

  const sanitized: Partial<T> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      sanitized[key as keyof T] = sanitizeString(value) as any;
    } else if (Array.isArray(value)) {
      sanitized[key as keyof T] = value.map((item) =>
        typeof item === "string" ? sanitizeString(item) : item
      ) as any;
    } else if (typeof value === "object" && value !== null) {
      sanitized[key as keyof T] = sanitizeObject(value) as any;
    } else {
      sanitized[key as keyof T] = value;
    }
  }

  return sanitized;
}

/**
 * Create a sanitized error log entry
 * Useful for logging error details safely
 * @param error SvnError or standard Error
 * @returns Sanitized error details object
 */
export function createSanitizedErrorLog(error: any): Record<string, any> {
  if (!error) return {};

  const log: Record<string, any> = {};

  // Safe error properties
  if (error.message) log.message = sanitizeString(error.message);
  if (error.name) log.name = error.name;
  if (error.code) log.code = error.code;

  // SvnError specific properties
  if (error.exitCode) log.exitCode = error.exitCode;
  if (error.svnErrorCode) log.svnErrorCode = error.svnErrorCode;
  if (error.svnCommand) log.svnCommand = sanitizeString(error.svnCommand);
  if (error.stdout) log.stdout = sanitizeString(error.stdout);
  if (error.stderr) log.stderr = sanitizeString(error.stderr);
  if (error.stderrFormated) log.stderrFormated = sanitizeString(error.stderrFormated);

  // Stack trace (sanitize but keep structure)
  if (error.stack) log.stack = sanitizeString(error.stack);

  return log;
}
