// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { XmlParserAdapter } from "./xmlParserAdapter";
import { IEntry, IFileStatus, IWcStatus } from "../common/types";
import { logError } from "../util/errorLogger";

function processEntry(
  entry: IEntry | IEntry[],
  changelist?: string
): IFileStatus[] {
  if (Array.isArray(entry)) {
    const list: IFileStatus[] = [];
    entry.forEach((e: IEntry) => {
      const r = processEntry(e, changelist);
      if (r) {
        list.push(...r);
      }
    });
    return list;
  }

  const wcStatus: IWcStatus = {
    locked:
      (!!entry.wcStatus.wcLocked && entry.wcStatus.wcLocked === "true") ||
      !!(entry.reposStatus && entry.reposStatus.lock),
    switched: !!entry.wcStatus.switched && entry.wcStatus.switched === "true"
  };

  const r: IFileStatus = {
    changelist,
    path: entry.path,
    status: entry.wcStatus.item,
    props: entry.wcStatus.props,
    wcStatus,
    reposStatus: entry.reposStatus
  };

  if (entry.wcStatus.movedTo && r.status === "deleted") {
    return [];
  }
  if (entry.wcStatus.movedFrom && r.status === "added") {
    r.rename = entry.wcStatus.movedFrom;
  }
  if (entry.wcStatus.commit) {
    r.commit = {
      revision: entry.wcStatus.commit.revision,
      author: entry.wcStatus.commit.author,
      date: entry.wcStatus.commit.date
    };
  }

  return [r];
}

function xmlToStatus(xml: Record<string, unknown>) {
  const statusList: IFileStatus[] = [];
  if (xml.target && typeof xml.target === "object") {
    const target = xml.target as Record<string, unknown>;
    if (target.entry) {
      statusList.push(...processEntry(target.entry as IEntry | IEntry[]));
    }
  }

  if (xml.changelist) {
    let changelists = xml.changelist;
    if (!Array.isArray(changelists)) {
      changelists = [changelists];
    }

    (changelists as Array<{ entry: IEntry | IEntry[]; name: string }>).forEach(
      change => {
        statusList.push(...processEntry(change.entry, change.name));
      }
    );
  }

  return statusList;
}

export async function parseStatusXml(content: string): Promise<IFileStatus[]> {
  return new Promise<IFileStatus[]>((resolve, reject) => {
    try {
      const parsed = XmlParserAdapter.parse(content, {
        mergeAttrs: true,
        explicitRoot: false,
        explicitArray: false,
        camelcase: true
      });

      const result = parsed as Record<string, unknown>;
      const statusList: IFileStatus[] = xmlToStatus(result);

      resolve(statusList);
    } catch (err) {
      logError("parseStatusXml error", err);
      reject(
        new Error(
          `Failed to parse status XML: ${err instanceof Error ? err.message : "Unknown error"}`
        )
      );
    }
  });
}
