// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { CancellationToken, ProgressLocation, window } from "vscode";
import { Repository } from "../repository";

/**
 * Result of pre-commit update operation
 */
export interface UpdateResult {
  success: boolean;
  revision?: number;
  hasConflicts?: boolean;
  cancelled?: boolean;
  skipped?: boolean;
  error?: string;
}

/**
 * User choice for conflict resolution
 */
export type ConflictChoice = "abort" | "continue";

/**
 * Service for running SVN update before commit.
 * Checks for remote changes first, only updates if needed.
 */
export class PreCommitUpdateService {
  /**
   * Run SVN update with progress notification.
   * First checks if server has new commits - skips update if already at HEAD.
   */
  async runUpdate(repository: Repository): Promise<UpdateResult> {
    return window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: "Checking for updates...",
        cancellable: true
      },
      async (progress, token: CancellationToken) => {
        if (token.isCancellationRequested) {
          return { success: false, cancelled: true };
        }

        try {
          // Check if update is needed
          progress.report({ message: "Checking server for new commits..." });
          const hasChanges = await repository.hasRemoteChanges();

          if (!hasChanges) {
            // Already at HEAD, skip update
            return { success: true, skipped: true };
          }

          progress.report({ message: "Running svn update..." });
          const updateResult = await repository.updateRevision();

          if (updateResult.conflicts.length > 0) {
            return {
              success: false,
              hasConflicts: true,
              revision: updateResult.revision ?? undefined
            };
          }

          return {
            success: true,
            revision: updateResult.revision ?? undefined
          };
        } catch (error: unknown) {
          const errorMsg = (error as Error)?.message || String(error);

          // Check for conflict error codes
          if (
            errorMsg.includes("E155015") ||
            errorMsg.includes("conflict") ||
            errorMsg.includes("E200024")
          ) {
            return {
              success: false,
              hasConflicts: true,
              error: errorMsg
            };
          }

          return {
            success: false,
            error: errorMsg
          };
        }
      }
    );
  }

  /**
   * Prompt user to choose action when conflicts detected
   */
  async promptConflictResolution(): Promise<ConflictChoice> {
    const choice = await window.showWarningMessage(
      "Update found conflicts. Resolve conflicts before committing, or commit anyway?",
      { modal: true },
      "Abort",
      "Commit Anyway"
    );

    if (choice === "Commit Anyway") {
      return "continue";
    }

    return "abort";
  }

  /**
   * Parse SVN update output to extract revision and conflict info
   */
  parseUpdateOutput(output: string): UpdateResult {
    const result: UpdateResult = { success: true };

    // Extract revision from "Updated to revision X." or "At revision X."
    const revMatch = output.match(/(?:Updated to|At) revision (\d+)/i);
    if (revMatch && revMatch[1]) {
      result.revision = parseInt(revMatch[1], 10);
    }

    // Check for conflict indicators
    if (
      output.includes("Summary of conflicts:") ||
      /^C\s+/m.test(output) ||
      output.includes("Text conflicts:")
    ) {
      result.hasConflicts = true;
      result.success = false;
    }

    return result;
  }
}
