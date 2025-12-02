import { describe, it, expect } from "vitest";

/**
 * User-Friendly Error Messages Tests
 *
 * Tests error formatting with error codes shown for transparency.
 * Format: "[User message] (E-code)"
 */

/**
 * Error code to user-friendly message mapping.
 * Each message includes the error code for transparency.
 */
const errorMessages: Record<string, string> = {
  // Authentication errors
  E170001: "Authentication failed (E170001). Check credentials and try again.",
  E215004: "Authentication failed (E215004). No more credentials available.",

  // Network errors
  E170013: "Unable to connect (E170013). Check network and repository URL.",
  E175002: "Network timeout (E175002). Try again or check network connection.",

  // Cleanup-suggestible errors
  E155004: "Working copy locked (E155004). Run cleanup to fix.",
  E155009: "Work queue failed (E155009). Run cleanup to fix.",
  E155016: "Working copy corrupt (E155016). Run cleanup to fix.",
  E155032: "Database problem (E155032). Run cleanup to fix.",
  E155037: "Previous operation unfinished (E155037). Run cleanup to fix.",
  E200030: "SQLite database issue (E200030). Run cleanup to fix.",
  E200033: "SQLite database busy (E200033). Run cleanup to fix.",
  E200034: "SQLite rollback reset (E200034). Run cleanup to fix.",

  // Conflict errors
  E155023: "Conflict blocking operation (E155023). Resolve conflicts first.",
  E200024: "Merge conflict (E200024). Resolve conflicts before committing.",

  // Out-of-date errors
  E155019: "Working copy not up-to-date (E155019). Update before committing.",
  E200042: "File changed on server (E200042). Update working copy first.",

  // Lock errors
  E200035: "Path already locked (E200035). Another user has the lock.",
  E200036: "Path not locked (E200036). No lock to release.",
  E200041: "Lock expired (E200041). Re-lock the file if needed.",

  // Permission errors
  E261001: "Access denied (E261001). Insufficient read permissions.",
  E261002: "Partial access (E261002). Some items not visible.",

  // Version mismatch
  E250006: "Version mismatch (E250006). Client/server versions incompatible."
};

/**
 * Extract error code from SVN error message.
 * Returns undefined if no code found.
 */
function extractErrorCode(stderr: string): string | undefined {
  const match = stderr.match(/E\d{6}/);
  return match ? match[0] : undefined;
}

/**
 * Format user-friendly error message based on error code.
 * Returns message with error code for transparency.
 */
function formatUserFriendlyMessage(stderr: string, fallback: string): string {
  const code = extractErrorCode(stderr);
  if (code && errorMessages[code]) {
    return errorMessages[code];
  }
  return fallback;
}

/**
 * Check if error should suggest "Update" action.
 */
function needsUpdate(errorMessage: string): boolean {
  const fullError = errorMessage.toLowerCase();
  return (
    fullError.includes("e155019") ||
    fullError.includes("e200042") ||
    fullError.includes("out of date") ||
    fullError.includes("not up-to-date")
  );
}

/**
 * Check if error should suggest "Resolve Conflicts" action.
 */
function needsConflictResolution(errorMessage: string): boolean {
  const fullError = errorMessage.toLowerCase();
  return (
    fullError.includes("e155023") ||
    fullError.includes("e200024") ||
    (fullError.includes("conflict") && !fullError.includes("resolved"))
  );
}

describe("User-Friendly Error Messages", () => {
  describe("Error Code Extraction", () => {
    it("extracts E155004 from SVN error", () => {
      expect(extractErrorCode("svn: E155004: Working copy locked")).toBe(
        "E155004"
      );
    });

    it("extracts E170001 from multiline error", () => {
      expect(
        extractErrorCode("svn: E170001: Authorization failed\nsvn: E000000")
      ).toBe("E170001");
    });

    it("returns undefined for no error code", () => {
      expect(extractErrorCode("File not found")).toBeUndefined();
    });
  });

  describe("Message Formatting with Error Code", () => {
    it("formats E155004 with code for transparency", () => {
      const result = formatUserFriendlyMessage(
        "svn: E155004: Working copy locked",
        "Operation failed"
      );
      expect(result).toContain("E155004");
      expect(result).toContain("locked");
    });

    it("formats E170001 auth error with code", () => {
      const result = formatUserFriendlyMessage(
        "svn: E170001: Authorization failed",
        "Operation failed"
      );
      expect(result).toContain("E170001");
      expect(result).toContain("Authentication");
    });

    it("formats E155019 out-of-date with code", () => {
      const result = formatUserFriendlyMessage(
        "svn: E155019: Working copy is not up-to-date",
        "Operation failed"
      );
      expect(result).toContain("E155019");
      expect(result).toContain("up-to-date");
    });

    it("uses fallback for unknown codes", () => {
      const result = formatUserFriendlyMessage(
        "svn: E999999: Unknown error",
        "Something went wrong"
      );
      expect(result).toBe("Something went wrong");
    });
  });

  describe("Update-Suggestible Errors", () => {
    it("detects E155019 (not up-to-date)", () => {
      expect(needsUpdate("svn: E155019: Working copy is not up-to-date")).toBe(
        true
      );
    });

    it("detects E200042 (item out of date)", () => {
      expect(needsUpdate("svn: E200042: Item is out of date")).toBe(true);
    });

    it("detects 'out of date' text pattern", () => {
      expect(needsUpdate("File is out of date")).toBe(true);
    });

    it("does not flag unrelated errors", () => {
      expect(needsUpdate("svn: E155004: Working copy locked")).toBe(false);
    });
  });

  describe("Conflict-Suggestible Errors", () => {
    it("detects E155023 (conflict blocking)", () => {
      expect(needsConflictResolution("svn: E155023: Conflict detected")).toBe(
        true
      );
    });

    it("detects E200024 (merge conflict)", () => {
      expect(
        needsConflictResolution("svn: E200024: Merge conflict during commit")
      ).toBe(true);
    });

    it("detects 'conflict' text pattern", () => {
      expect(needsConflictResolution("Tree conflict on file.txt")).toBe(true);
    });

    it("ignores 'conflict resolved' messages", () => {
      expect(needsConflictResolution("Conflict resolved")).toBe(false);
    });
  });

  describe("Lock Error Messages", () => {
    it("formats E200035 (path already locked)", () => {
      const result = formatUserFriendlyMessage(
        "svn: E200035: Path is already locked",
        "Lock failed"
      );
      expect(result).toContain("E200035");
      expect(result).toContain("locked");
    });

    it("formats E200036 (path not locked)", () => {
      const result = formatUserFriendlyMessage(
        "svn: E200036: Path is not locked",
        "Unlock failed"
      );
      expect(result).toContain("E200036");
      expect(result).toContain("not locked");
    });

    it("formats E200041 (lock expired)", () => {
      const result = formatUserFriendlyMessage(
        "svn: E200041: Lock has expired",
        "Lock operation failed"
      );
      expect(result).toContain("E200041");
      expect(result).toContain("expired");
    });
  });

  describe("Permission Error Messages", () => {
    it("formats E261001 (access denied)", () => {
      const result = formatUserFriendlyMessage(
        "svn: E261001: Item is not readable",
        "Access failed"
      );
      expect(result).toContain("E261001");
      expect(result).toContain("denied");
    });

    it("formats E261002 (partial access)", () => {
      const result = formatUserFriendlyMessage(
        "svn: E261002: Item is only partially readable",
        "Access limited"
      );
      expect(result).toContain("E261002");
      expect(result).toContain("Partial");
    });
  });

  describe("Version Mismatch", () => {
    it("formats E250006 (client/server mismatch)", () => {
      const result = formatUserFriendlyMessage(
        "svn: E250006: Client/server version mismatch",
        "Version error"
      );
      expect(result).toContain("E250006");
      expect(result).toContain("mismatch");
    });
  });
});
