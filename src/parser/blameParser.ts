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
export async function parseSvnBlame(
  content: string
): Promise<ISvnBlameLine[]> {
  return new Promise<ISvnBlameLine[]>((resolve, reject) => {
    try {
      const result = XmlParserAdapter.parse(content, {
        mergeAttrs: true,
        explicitRoot: false,
        explicitArray: false,
        camelcase: true
      });

      // Validate structure
      if (!result.target) {
        reject(
          new Error("Invalid blame XML: missing target element")
        );
        return;
      }

      // Handle empty file (no entries)
      if (!result.target.entry) {
        resolve([]);
        return;
      }

      // Normalize entry to array (single entry becomes object with explicitArray: false)
      let entries = [];
      if (Array.isArray(result.target.entry)) {
        entries = result.target.entry;
      } else {
        entries = [result.target.entry];
      }

      // Transform XML entries to ISvnBlameLine[]
      const blameLines: ISvnBlameLine[] = entries.map((entry: any) => {
        const line: ISvnBlameLine = {
          lineNumber: parseInt(entry.lineNumber, 10)
        };

        // Handle committed lines (have commit element)
        if (entry.commit) {
          line.revision = entry.commit.revision;
          line.author = entry.commit.author;
          line.date = entry.commit.date;
        }

        // Handle merged lines (have merged element with commit info)
        if (entry.merged && entry.merged.commit) {
          line.merged = {
            path: entry.merged.path,
            revision: entry.merged.commit.revision,
            author: entry.merged.commit.author,
            date: entry.merged.commit.date
          };
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
