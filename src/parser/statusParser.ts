// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { XmlParserAdapter } from "./xmlParserAdapter";
import { IEntry, IFileStatus, IWcStatus, LockStatus } from "../common/types";
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

  // Extract lock owner from repos-status if available
  let lockOwner: string | undefined;
  const serverChecked = !!entry.reposStatus;
  const serverHasLock = !!entry.reposStatus?.lock;

  if (serverHasLock) {
    const lock = entry.reposStatus!.lock as Record<string, unknown>;
    if (lock.owner && typeof lock.owner === "string") {
      lockOwner = lock.owner;
    }
  }

  // wcLocked="true" means we hold the lock token locally (K)
  const hasLockToken =
    !!entry.wcStatus.wcLocked && entry.wcStatus.wcLocked === "true";

  // Compute lock status: K, O, B, T
  let lockStatus: LockStatus | undefined;
  if (hasLockToken) {
    if (serverChecked && !serverHasLock) {
      // We have token but server shows no lock - broken
      lockStatus = LockStatus.B;
    } else if (serverChecked && serverHasLock && lockOwner) {
      // We have token and server has lock by someone
      // TODO: Compare lockOwner with current user for T detection
      // For now, if we have token and server has lock, assume it's ours (K)
      // T would be: hasLockToken && serverHasLock && lockOwner !== currentUser
      lockStatus = LockStatus.K;
    } else {
      // No server check or server shows our lock
      lockStatus = LockStatus.K;
    }
  } else if (serverHasLock) {
    // We don't have token but server has lock - locked by other
    lockStatus = LockStatus.O;
  }

  const wcStatus: IWcStatus = {
    locked: hasLockToken || serverHasLock,
    switched: !!entry.wcStatus.switched && entry.wcStatus.switched === "true",
    lockOwner,
    hasLockToken,
    serverChecked,
    lockStatus
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

    // Validate each changelist item has expected structure before processing
    for (const change of changelists as unknown[]) {
      if (
        change &&
        typeof change === "object" &&
        "entry" in change &&
        "name" in change &&
        typeof (change as { name: unknown }).name === "string"
      ) {
        const validChange = change as {
          entry: IEntry | IEntry[];
          name: string;
        };
        statusList.push(...processEntry(validChange.entry, validChange.name));
      }
    }
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
