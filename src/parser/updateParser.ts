// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { IUpdateResult } from "../common/types";

/**
 * Parse SVN update output to extract revision, conflicts, and message.
 * Detects all conflict types: text, tree, and property conflicts.
 */
export function parseUpdateOutput(stdout: string): IUpdateResult {
  if (!stdout || typeof stdout !== "string") {
    return { revision: null, conflicts: [], message: "" };
  }

  const revRegex = /(?:Updated to|At) revision (\d+)/i;
  const conflictRegex = /^\s*C\s+(.+)$/;

  const lines = stdout.trim().split(/\r?\n/);
  const conflicts: string[] = [];
  let revision: number | null = null;
  let message = "";

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]!;
    const trimmed = line.trim();

    // Capture last non-empty line as message
    if (!message && trimmed) {
      message = trimmed;
    }

    // Detect all conflict types (text, tree, property)
    const conflictMatch = conflictRegex.exec(line);
    if (conflictMatch && conflictMatch[1]) {
      conflicts.unshift(conflictMatch[1]!.trim());
    }

    // Extract revision (only once)
    if (revision === null) {
      const revMatch = revRegex.exec(line);
      if (revMatch && revMatch[1]) {
        revision = parseInt(revMatch[1]!, 10);
      }
    }
  }

  return { revision, conflicts, message };
}
