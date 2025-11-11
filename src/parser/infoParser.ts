import { ISvnInfo } from "../common/types";
import { XmlParserAdapter } from "./xmlParserAdapter";

export async function parseInfoXml(content: string): Promise<ISvnInfo> {
  return new Promise<ISvnInfo>((resolve, reject) => {
    try {
      const result = XmlParserAdapter.parse(content, {
        mergeAttrs: true,
        explicitRoot: false,
        explicitArray: false,
        camelcase: true
      });

      if (typeof result.entry === "undefined") {
        reject(new Error("Invalid info XML: missing entry element"));
        return;
      }

      resolve(result.entry);
    } catch (err) {
      console.error("parseInfoXml error:", err);
      reject(new Error(`Failed to parse info XML: ${err instanceof Error ? err.message : "Unknown error"}`));
    }
  });
}
