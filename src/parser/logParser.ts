import { ISvnLogEntry } from "../common/types";
import { XmlParserAdapter } from "./xmlParserAdapter";
import { logError } from "../util/errorLogger";

export async function parseSvnLog(content: string): Promise<ISvnLogEntry[]> {
  return new Promise<ISvnLogEntry[]>((resolve, reject) => {
    try {
      const result = XmlParserAdapter.parse(content, {
        mergeAttrs: true,
        explicitRoot: false,
        explicitArray: false,
        camelcase: true
      });

      if (!result.logentry) {
        reject(new Error("Invalid log XML: missing logentry elements"));
        return;
      }

      // Normalize logentry to array
      let transformed = [];
      if (Array.isArray(result.logentry)) {
        transformed = result.logentry;
      } else if (typeof result.logentry === "object") {
        transformed = [result.logentry];
      }

      // Normalize paths structure
      for (const logentry of transformed) {
        if (logentry.paths === undefined) {
          logentry.paths = [];
        } else if (Array.isArray(logentry.paths.path)) {
          logentry.paths = logentry.paths.path;
        } else {
          logentry.paths = [logentry.paths.path];
        }
      }

      resolve(transformed);
    } catch (err) {
      logError("parseSvnLog error", err);
      reject(new Error(`Failed to parse log XML: ${err instanceof Error ? err.message : "Unknown error"}`));
    }
  });
}
