// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { ISvnInfo } from "../common/types";
import { XmlParserAdapter, DEFAULT_PARSE_OPTIONS } from "./xmlParserAdapter";
import { logError } from "../util/errorLogger";

export async function parseInfoXml(content: string): Promise<ISvnInfo> {
  return new Promise<ISvnInfo>((resolve, reject) => {
    try {
      const result = XmlParserAdapter.parse(content, DEFAULT_PARSE_OPTIONS);

      if (typeof result.entry === "undefined") {
        reject(new Error("Invalid info XML: missing entry element"));
        return;
      }

      resolve(result.entry);
    } catch (err) {
      logError("parseInfoXml error", err);
      reject(
        new Error(
          `Failed to parse info XML: ${err instanceof Error ? err.message : "Unknown error"}`
        )
      );
    }
  });
}
