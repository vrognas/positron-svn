import { ISvnPath } from "../common/types";
import { XmlParserAdapter } from "./xmlParserAdapter";
import { logError } from "../util/errorLogger";

export async function parseDiffXml(content: string): Promise<ISvnPath[]> {
  return new Promise<ISvnPath[]>((resolve, reject) => {
    try {
      const result = XmlParserAdapter.parse(content, {
        mergeAttrs: true,
        explicitArray: false,
        camelcase: true
      });

      if (!result.paths || !result.paths.path) {
        reject(new Error("Invalid diff XML: missing paths or path elements"));
        return;
      }

      // Normalize: ensure array even for single path
      if (!Array.isArray(result.paths.path)) {
        result.paths.path = [result.paths.path];
      }

      resolve(result.paths.path);
    } catch (err) {
      logError("parseDiffXml error", err);
      reject(new Error(`Failed to parse diff XML: ${err instanceof Error ? err.message : "Unknown error"}`));
    }
  });
}
