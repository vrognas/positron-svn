// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

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

      // SVN outputs <lists><list path="..."><entry>...
      // Handle both <lists><list> and direct <list> formats
      let listNode = result.list;
      if (result.lists?.list) {
        listNode = result.lists.list;
      }

      if (listNode?.entry) {
        // Normalize: ensure array even for single entry
        if (!Array.isArray(listNode.entry)) {
          listNode.entry = [listNode.entry];
        }
        resolve(listNode.entry);
      } else {
        resolve([]);
      }
    } catch (err) {
      logError("parseSvnList error", err);
      reject(
        new Error(
          `Failed to parse list XML: ${err instanceof Error ? err.message : "Unknown error"}`
        )
      );
    }
  });
}
