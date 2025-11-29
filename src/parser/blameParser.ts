// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { ISvnBlameLine } from "../common/types";
import { XmlParserAdapter } from "./xmlParserAdapter";
import { logError } from "../util/errorLogger";

/**
 * Parse SVN blame XML output into structured blame lines
 *
 * Handles svn blame --xml output format:
 * - Normal committed lines with revision/author/date
 * - Uncommitted lines (no commit element)
 * - Merged lines with merge source info
 * - Empty files (no entries)
 *
 * @param content XML string from svn blame --xml
 * @returns Array of blame line information
 * @throws Error if XML is malformed or invalid
 *
 * @example
 * const xml = await exec(['blame', '--xml', 'file.ts']);
 * const blameLines = await parseSvnBlame(xml);
 * // blameLines[0] = { lineNumber: 1, revision: "123", author: "john", date: "..." }
 */
export async function parseSvnBlame(content: string): Promise<ISvnBlameLine[]> {
  return new Promise<ISvnBlameLine[]>((resolve, reject) => {
    try {
      const parsed = XmlParserAdapter.parse(content, {
        mergeAttrs: true,
        explicitRoot: false,
        explicitArray: false,
        camelcase: true
      });

      const result = parsed as Record<string, unknown>;

      // Validate structure
      if (!result.target || typeof result.target !== "object") {
        reject(new Error("Invalid blame XML: missing target element"));
        return;
      }

      const target = result.target as Record<string, unknown>;

      // Handle empty file (no entries)
      if (!target.entry) {
        resolve([]);
        return;
      }

      // Normalize entry to array (single entry becomes object with explicitArray: false)
      let entries = [];
      if (Array.isArray(target.entry)) {
        entries = target.entry;
      } else {
        entries = [target.entry];
      }

      // Transform XML entries to ISvnBlameLine[]
      const blameLines: ISvnBlameLine[] = entries.map((entry: unknown) => {
        const e = entry as Record<string, unknown>;
        const line: ISvnBlameLine = {
          lineNumber: parseInt(e.lineNumber as string, 10)
        };

        // Handle committed lines (have commit element)
        if (e.commit && typeof e.commit === "object") {
          const commit = e.commit as Record<string, unknown>;
          line.revision = commit.revision as string;
          line.author = commit.author as string;
          line.date = commit.date as string;
        }

        // Handle merged lines (have merged element with commit info)
        if (e.merged && typeof e.merged === "object") {
          const merged = e.merged as Record<string, unknown>;
          if (merged.commit && typeof merged.commit === "object") {
            const mergedCommit = merged.commit as Record<string, unknown>;
            line.merged = {
              path: merged.path as string,
              revision: mergedCommit.revision as string,
              author: mergedCommit.author as string,
              date: mergedCommit.date as string
            };
          }
        }

        return line;
      });

      resolve(blameLines);
    } catch (err) {
      logError("parseSvnBlame error", err);
      reject(
        new Error(
          `Failed to parse blame XML: ${
            err instanceof Error ? err.message : "Unknown error"
          }`
        )
      );
    }
  });
}
