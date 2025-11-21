// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

/**
 * Security error sanitizer for Phase 0.3
 * Strips sensitive information from error messages before logging/display
 */

import { configuration } from "../helpers/configuration";

/**
 * Check if sanitization is disabled for debugging
 * WARNING: When disabled, credentials and paths will be exposed in logs
 */
function isSanitizationDisabled(): boolean {
  return configuration.get<boolean>("debug.disableSanitization", false);
}

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
 * @returns Sanitized string with sensitive data redacted (or original if debug mode enabled)
 */
export function sanitizeString(input: string): string {
  if (!input) return input;

  // ⚠️ DEBUG MODE: Return raw string when sanitization disabled
  if (isSanitizationDisabled()) {
    return input;
  }

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
 * Represents values that can be safely returned after sanitization
 */
type SanitizedPrimitive = string | number | boolean | null | undefined;
type SanitizedArray = Array<SanitizedPrimitive | SanitizedObject>;
type SanitizedObject = { [key: string]: SanitizedValue };
type SanitizedValue = SanitizedPrimitive | SanitizedArray | SanitizedObject;

/**
 * Type guard to check if value is a plain object (not array, not null)
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Sanitize an object by removing sensitive fields
 * @param obj Object to sanitize (typically error data)
 * @returns New object with sanitized string values
 */
export function sanitizeObject(obj: Record<string, unknown>): SanitizedObject {
  if (!obj || typeof obj !== "object") {
    return {};
  }

  const sanitized: SanitizedObject = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      // String values: sanitize and assign
      sanitized[key] = sanitizeString(value);
    } else if (Array.isArray(value)) {
      // Array values: sanitize string items, preserve others
      sanitized[key] = value.map((item) =>
        typeof item === "string" ? sanitizeString(item) : item
      );
    } else if (isPlainObject(value)) {
      // Nested objects: recurse
      sanitized[key] = sanitizeObject(value);
    } else {
      // Primitives (number, boolean, null, undefined): pass through
      sanitized[key] = value as SanitizedPrimitive;
    }
  }

  return sanitized;
}

/**
 * Type guard to check if object has a property
 */
function hasProperty<K extends string>(
  obj: unknown,
  key: K
): obj is Record<K, unknown> {
  return typeof obj === "object" && obj !== null && key in obj;
}

/**
 * Extract string property safely
 */
function getStringProperty(obj: unknown, key: string): string | undefined {
  if (hasProperty(obj, key)) {
    const value = obj[key];
    return typeof value === "string" ? value : undefined;
  }
  return undefined;
}

/**
 * Extract numeric property safely
 */
function getNumericProperty(obj: unknown, key: string): number | undefined {
  if (hasProperty(obj, key)) {
    const value = obj[key];
    return typeof value === "number" ? value : undefined;
  }
  return undefined;
}

/**
 * Create a sanitized error log entry
 * Useful for logging error details safely
 * @param error Error object (standard Error or SvnError-like object)
 * @returns Sanitized error details object
 */
export function createSanitizedErrorLog(error: Error | Record<string, unknown> | unknown): Record<string, string | number> {
  if (!error || typeof error !== "object") {
    return {};
  }

  const log: Record<string, string | number> = {};

  // Safe error properties (standard Error)
  const message = getStringProperty(error, "message");
  if (message) log.message = sanitizeString(message);

  const name = getStringProperty(error, "name");
  if (name) log.name = name;

  const code = getStringProperty(error, "code");
  if (code) log.code = code;

  // SvnError specific properties
  const exitCode = getNumericProperty(error, "exitCode");
  if (exitCode !== undefined) log.exitCode = exitCode;

  const svnErrorCode = getStringProperty(error, "svnErrorCode");
  if (svnErrorCode) log.svnErrorCode = svnErrorCode;

  const svnCommand = getStringProperty(error, "svnCommand");
  if (svnCommand) log.svnCommand = sanitizeString(svnCommand);

  const stdout = getStringProperty(error, "stdout");
  if (stdout) log.stdout = sanitizeString(stdout);

  const stderr = getStringProperty(error, "stderr");
  if (stderr) log.stderr = sanitizeString(stderr);

  const stderrFormated = getStringProperty(error, "stderrFormated");
  if (stderrFormated) log.stderrFormated = sanitizeString(stderrFormated);

  // Stack trace (sanitize but keep structure)
  const stack = getStringProperty(error, "stack");
  if (stack) log.stack = sanitizeString(stack);

  return log;
}
