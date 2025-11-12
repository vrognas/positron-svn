import { XmlParserAdapter } from "./xmlParserAdapter";
import { ISvnListItem } from "../common/types";
import { logError } from "../util/errorLogger";

export async function parseSvnList(content: string): Promise<ISvnListItem[]> {
  return new Promise<ISvnListItem[]>((resolve, reject) => {
    try {
      const result = XmlParserAdapter.parse(content, {
        mergeAttrs: true,
        explicitArray: false,
        camelcase: true
      });

      if (result.list && result.list.entry) {
        // Normalize: ensure array even for single entry
        if (!Array.isArray(result.list.entry)) {
          result.list.entry = [result.list.entry];
        }
        resolve(result.list.entry);
      } else {
        resolve([]);
      }
    } catch (err) {
      logError("parseSvnList error", err);
      reject(new Error(`Failed to parse list XML: ${err instanceof Error ? err.message : "Unknown error"}`));
    }
  });
}
