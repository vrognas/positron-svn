import * as xml2js from "xml2js";
import { ISvnInfo } from "../common/types";
import { xml2jsParseSettings } from "../common/constants";

export async function parseInfoXml(content: string): Promise<ISvnInfo> {
  return new Promise<ISvnInfo>((resolve, reject) => {
    xml2js.parseString(
      content,
      xml2jsParseSettings,
      (err, result) => {
        if (err || typeof result.entry === "undefined") {
          reject();
        }

        resolve(result.entry);
      }
    );
  });
}

export async function parseBatchInfoXml(content: string): Promise<Map<string, ISvnInfo>> {
  return new Promise<Map<string, ISvnInfo>>((resolve, reject) => {
    xml2js.parseString(
      content,
      xml2jsParseSettings,
      (err, result) => {
        if (err) {
          reject(err);
          return;
        }

        const infoMap = new Map<string, ISvnInfo>();

        // Handle both single and multiple entries
        const entries = Array.isArray(result.entry) ? result.entry : [result.entry];

        for (const entry of entries) {
          if (entry && entry.$.path) {
            infoMap.set(entry.$.path, entry);
          }
        }

        resolve(infoMap);
      }
    );
  });
}
