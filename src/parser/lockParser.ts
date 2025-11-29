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
  lock?: ParsedLock;
}

interface ParsedInfo {
  entry?: ParsedEntry;
}

/**
 * Parse lock information from svn info --xml output.
 * Returns lock info if file is locked, null otherwise.
 */
export async function parseLockInfo(
  content: string
): Promise<ISvnLockInfo | null> {
  return new Promise<ISvnLockInfo | null>((resolve, reject) => {
    if (!content || content.trim() === "") {
      reject(new Error("Cannot parse lock info: empty XML content"));
      return;
    }

    try {
      const result = XmlParserAdapter.parse(content, {
        mergeAttrs: true,
        explicitRoot: false,
        explicitArray: false,
        camelcase: true
      }) as ParsedInfo;

      if (!result.entry) {
        reject(new Error("Invalid info XML: missing entry element"));
        return;
      }

      const lock = result.entry.lock;
      if (!lock) {
        // File is not locked
        resolve(null);
        return;
      }

      // Validate required lock fields
      if (!lock.owner || !lock.token || !lock.created) {
        logError("Incomplete lock data in XML", {
          hasOwner: !!lock.owner,
          hasToken: !!lock.token,
          hasCreated: !!lock.created
        });
        resolve(null);
        return;
      }

      resolve({
        owner: lock.owner,
        token: lock.token,
        comment: lock.comment,
        created: lock.created
      });
    } catch (err) {
      logError("parseLockInfo error", err);
      reject(
        new Error(
          `Failed to parse lock XML: ${err instanceof Error ? err.message : "Unknown error"}`
        )
      );
    }
  });
}
