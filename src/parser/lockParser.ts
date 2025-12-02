// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { ISvnLockInfo } from "../common/types";
import { XmlParserAdapter } from "./xmlParserAdapter";
import { logError } from "../util/errorLogger";

interface ParsedLock {
  token?: string;
  owner?: string;
  comment?: string;
  created?: string;
}

interface ParsedEntry {
  path?: string;
  url?: string;
  lock?: ParsedLock;
}

interface ParsedInfo {
  entry?: ParsedEntry | ParsedEntry[];
}

/**
 * Parse lock information from svn info --xml output.
 * Returns lock info if file is locked, null otherwise.
 */
export function parseLockInfo(content: string): ISvnLockInfo | null {
  if (!content || content.trim() === "") {
    throw new Error("Cannot parse lock info: empty XML content");
  }

  try {
    const result = XmlParserAdapter.parse(content, {
      mergeAttrs: true,
      explicitRoot: false,
      explicitArray: false,
      camelcase: true
    }) as ParsedInfo;

    if (!result.entry) {
      throw new Error("Invalid info XML: missing entry element");
    }

    // Handle single entry (not array)
    const entry = Array.isArray(result.entry) ? result.entry[0]! : result.entry;
    const lock = entry.lock;
    if (!lock) {
      // File is not locked
      return null;
    }

    // Validate required lock fields
    if (!lock.owner || !lock.token || !lock.created) {
      throw new Error("Incomplete lock data: missing required fields");
    }

    return {
      owner: lock.owner,
      token: lock.token,
      comment: lock.comment,
      created: lock.created
    };
  } catch (err) {
    logError("parseLockInfo error", err);
    throw err instanceof Error
      ? err
      : new Error(`Failed to parse lock XML: Unknown error`);
  }
}

/**
 * Parse lock information for multiple URLs from svn info --xml output.
 * Returns a map from URL to lock info (null if not locked).
 */
export function parseBatchLockInfo(
  content: string
): Map<string, ISvnLockInfo | null> {
  const result = new Map<string, ISvnLockInfo | null>();

  if (!content || content.trim() === "") {
    return result;
  }

  try {
    const parsed = XmlParserAdapter.parse(content, {
      mergeAttrs: true,
      explicitRoot: false,
      explicitArray: false,
      camelcase: true
    }) as ParsedInfo;

    if (!parsed.entry) {
      return result;
    }

    // Normalize to array
    const entries = Array.isArray(parsed.entry) ? parsed.entry : [parsed.entry];

    for (const entry of entries) {
      // Use URL as key (matches what we pass to svn info)
      if (!entry.url) continue;

      const lock = entry.lock;
      if (!lock || !lock.owner || !lock.token || !lock.created) {
        result.set(entry.url, null);
      } else {
        result.set(entry.url, {
          owner: lock.owner,
          token: lock.token,
          comment: lock.comment,
          created: lock.created
        });
      }
    }
  } catch (err) {
    logError("parseBatchLockInfo error", err);
  }

  return result;
}
