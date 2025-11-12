/**
 * Safe error logging utility (Phase 20.D)
 *
 * Wraps console.error/log with automatic credential sanitization
 * to prevent credential leaks in error logs
 */

import { sanitizeError, sanitizeString } from "../security/errorSanitizer";

/**
 * Safely log an error with automatic sanitization
 * Use this instead of console.error() in catch blocks
 *
 * @param message Context message for the error
 * @param error The error to log (optional)
 *
 * @example
 * ```typescript
 * try {
 *   await performOperation();
 * } catch (error) {
 *   logError("Operation failed", error); // Safe - credentials sanitized
 * }
 * ```
 */
export function logError(message: string, error?: unknown): void {
  const sanitizedMessage = sanitizeString(message);

  if (error) {
    const sanitizedError = sanitizeError(
      error instanceof Error ? error : new Error(String(error))
    );
    console.error(`${sanitizedMessage}:`, sanitizedError);
  } else {
    console.error(sanitizedMessage);
  }
}

/**
 * Safely log a warning with automatic sanitization
 * Use this instead of console.warn() when logging user/system data
 *
 * @param message Context message for the warning
 * @param data Optional data to log
 */
export function logWarning(message: string, data?: unknown): void {
  const sanitizedMessage = sanitizeString(message);

  if (data !== undefined) {
    const sanitizedData = typeof data === "string"
      ? sanitizeString(data)
      : sanitizeString(JSON.stringify(data, null, 2));
    console.warn(`${sanitizedMessage}:`, sanitizedData);
  } else {
    console.warn(sanitizedMessage);
  }
}

/**
 * Safely throw an error with sanitized message
 * Use this when re-throwing or creating errors from untrusted input
 *
 * @param message Error message
 * @param originalError Optional original error for context
 * @returns Error with sanitized message
 */
export function createSafeError(message: string, originalError?: unknown): Error {
  const sanitizedMessage = sanitizeString(message);
  const error = new Error(sanitizedMessage);

  if (originalError && originalError instanceof Error) {
    // Preserve stack trace but sanitize it
    if (originalError.stack) {
      error.stack = sanitizeString(originalError.stack);
    }
  }

  return error;
}
