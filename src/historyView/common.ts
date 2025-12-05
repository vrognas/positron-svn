// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import * as path from "path";
import {
  commands,
  env,
  TextDocumentShowOptions,
  ThemeIcon,
  TreeItem,
  Uri,
  window
} from "vscode";
import { ISvnLogEntry, ISvnLogEntryPath } from "../common/types";
import { exists, lstat } from "../fs";
import { configuration } from "../helpers/configuration";
import { IRemoteRepository } from "../remoteRepository";
import { SvnRI } from "../svnRI";
import { tempSvnFs } from "../temp_svn_fs";
import { getAuthorColorDot } from "./letterAvatar";

/**
 * Format a date as relative time ("2 days ago", "3 months ago")
 * Replaces dayjs dependency (-46KB bundle size)
 */
function formatRelativeTime(date: string | Date): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);

  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (diffYear > 0) return rtf.format(-diffYear, "year");
  if (diffMonth > 0) return rtf.format(-diffMonth, "month");
  if (diffWeek > 0) return rtf.format(-diffWeek, "week");
  if (diffDay > 0) return rtf.format(-diffDay, "day");
  if (diffHour > 0) return rtf.format(-diffHour, "hour");
  if (diffMin > 0) return rtf.format(-diffMin, "minute");
  return rtf.format(-diffSec, "second");
}

export enum LogTreeItemKind {
  Repo = 1,
  Commit,
  CommitDetail,
  TItem
}

// svn:// or ^/ or WC-path
export class SvnPath {
  constructor(private path: string) {}
  public toString(): string {
    return this.path;
  }
}

export interface ICachedLog {
  entries: ISvnLogEntry[];
  // Uri of svn repository
  svnTarget: Uri;
  isComplete: boolean;
  repo: IRemoteRepository;
  persisted: {
    readonly commitFrom: string;
    baseRevision?: number;
    readonly userAdded?: boolean;
  };
  order: number;
  lastAccessed?: number; // LRU tracking
}

type TreeItemData = ISvnLogEntry | ISvnLogEntryPath | SvnPath | TreeItem;

export interface ILogTreeItem {
  readonly kind: LogTreeItemKind;
  data: TreeItemData;
  readonly parent?: ILogTreeItem;
  isBase?: boolean; // True if this commit is the BASE revision
  isServerOnly?: boolean; // True if revision > BASE (not synced yet)
}

export function transform(
  array: TreeItemData[],
  kind: LogTreeItemKind,
  parent?: ILogTreeItem
): ILogTreeItem[] {
  return array.map(data => {
    return { kind, data, parent };
  });
}

export function getIconObject(iconName: string): { light: Uri; dark: Uri } {
  // XXX Maybe use full path to extension?
  // Path needs to be relative from out/
  const iconsRootPath = path.join(__dirname, "..", "icons");
  const toUri = (theme: string) =>
    Uri.file(path.join(iconsRootPath, theme, `${iconName}.svg`));
  return {
    light: toUri("light"),
    dark: toUri("dark")
  };
}

export async function copyCommitToClipboard(what: string, item: ILogTreeItem) {
  const clipboard = (
    env as unknown as {
      clipboard?: { writeText: (text: string) => Promise<void> };
    }
  ).clipboard;
  if (clipboard === undefined) {
    window.showErrorMessage("Clipboard is supported in VS Code 1.30 and newer");
    return;
  }
  if (item.kind === LogTreeItemKind.Commit) {
    const commit = item.data as ISvnLogEntry;
    switch (what) {
      case "msg":
      case "revision":
        await clipboard.writeText(commit[what]);
    }
  }
}

function needFetch(
  cached: ISvnLogEntry[],
  fetched: ISvnLogEntry[],
  limit: number
): boolean {
  if (cached.length && cached[cached.length - 1]!.revision === "1") {
    return false;
  }
  if (fetched.length === 0 || fetched[fetched.length - 1]!.revision === "1") {
    return false;
  }
  if (fetched.length < limit) {
    return false;
  }
  return true;
}

/**
 * Mark commit status in the output list:
 * - isBase: true if revision === BASE (your working copy revision)
 * - isServerOnly: true if revision > BASE (not synced yet)
 */
export function insertBaseMarker(
  item: ICachedLog,
  entries: ISvnLogEntry[],
  out: ILogTreeItem[]
): void {
  const baseRev = item.persisted.baseRevision;
  if (!entries.length || !baseRev) {
    return;
  }

  for (let i = 0; i < out.length; i++) {
    const logItem = out[i];
    if (logItem?.kind !== LogTreeItemKind.Commit) {
      continue;
    }
    const commit = logItem.data as ISvnLogEntry;
    const rev = parseInt(commit.revision, 10);
    if (rev === baseRev) {
      // Mark this commit as BASE
      logItem.isBase = true;
    } else if (rev > baseRev) {
      // Mark commits above BASE as server-only (not synced)
      logItem.isServerOnly = true;
    }
  }
}

export async function checkIfFile(
  e: SvnRI,
  local: boolean
): Promise<boolean | undefined> {
  if (e.localFullPath === undefined) {
    if (local) {
      window.showErrorMessage("No working copy for this path");
    }
    return undefined;
  }
  let stat;
  try {
    stat = await lstat(e.localFullPath.fsPath);
  } catch {
    window.showWarningMessage(
      "Not available from this working copy: " + e.localFullPath
    );
    return false;
  }
  if (!stat.isFile()) {
    window.showErrorMessage("This target is not a file");
    return false;
  }
  return true;
}

export function getLimit(): number {
  const limit = Number.parseInt(
    configuration.get<string>("log.length") || "50",
    10
  );
  if (isNaN(limit) || limit <= 0) {
    throw new Error("Invalid log.length setting value");
  }
  return limit;
}

/// @note: cached.svnTarget should be valid
export async function fetchMore(cached: ICachedLog) {
  let rfrom = cached.persisted.commitFrom;
  const entries = cached.entries;
  if (entries.length) {
    const lastRev = Number.parseInt(entries[entries.length - 1]!.revision, 10);
    // Already at r1, nothing more to fetch
    if (lastRev <= 1) {
      cached.isComplete = true;
      return;
    }
    rfrom = (lastRev - 1).toString();
  }
  let moreCommits: ISvnLogEntry[] = [];
  const limit = getLimit();
  try {
    moreCommits = await cached.repo.log(rfrom, "1", limit, cached.svnTarget);
  } catch {
    // Item didn't exist
  }
  if (!needFetch(entries, moreCommits, limit)) {
    cached.isComplete = true;
  }
  // Deduplicate: skip commits already in entries
  const existingRevs = new Set(entries.map(e => e.revision));
  const newCommits = moreCommits.filter(c => !existingRevs.has(c.revision));
  entries.push(...newCommits);
}

/**
 * Get commit author icon for history view
 * Returns colored dot (if enabled) or standard git-commit icon
 */
export function getCommitIcon(
  author: string
): Uri | { light: Uri; dark: Uri } | ThemeIcon {
  const showColors = configuration.get("log.authorColors", true);

  if (!author || !showColors) {
    return new ThemeIcon("git-commit");
  }

  return getAuthorColorDot(author);
}

/**
 * Build file change stats string (e.g., "A:1 · M:3 · D:2")
 */
function getFileStats(paths: ISvnLogEntryPath[] | undefined): string {
  if (!paths || paths.length === 0) return "";

  const counts: Record<string, number> = {};
  for (const p of paths) {
    const action = p.action || "?";
    counts[action] = (counts[action] || 0) + 1;
  }

  // Order: A (Added), M (Modified), D (Deleted), R (Replaced), other
  const order = ["A", "M", "D", "R"];
  const parts: string[] = [];

  for (const action of order) {
    if (counts[action]) {
      parts.push(`${action}:${counts[action]}`);
      delete counts[action];
    }
  }
  // Add any remaining actions
  for (const [action, count] of Object.entries(counts)) {
    parts.push(`${action}:${count}`);
  }

  return parts.join(" · ");
}

export function getCommitDescription(commit: ISvnLogEntry): string {
  const relativeDate = formatRelativeTime(commit.date);
  const hasMsg = commit.msg && commit.msg.trim();
  const prefix = hasMsg ? "· " : "";

  // Add file stats if available
  const stats = getFileStats(commit.paths);
  const statsPart = stats ? ` · ${stats}` : "";

  return `${prefix}r${commit.revision} · ${commit.author} · ${relativeDate}${statsPart}`;
}

export function getCommitLabel(commit: ISvnLogEntry): string {
  if (!commit.msg) {
    return "";
  }
  return commit.msg.split(/\r?\n/, 1)[0]!;
}

export function getCommitToolTip(commit: ISvnLogEntry): string {
  let date = commit.date;
  if (!isNaN(Date.parse(date))) {
    date = new Date(date).toString();
  }
  return `Author: ${commit.author}
${date}
Revision: ${commit.revision}
Message: ${commit.msg}`;
}

async function downloadFile(
  repo: IRemoteRepository,
  arg: Uri,
  revision: string
): Promise<Uri> {
  if (revision === "BASE") {
    const nm = repo.getPathNormalizer();
    const ri = nm.parse(arg.toString(true));
    const localPath = ri.localFullPath;
    if (localPath === undefined || !(await exists(localPath.path))) {
      const errorMsg =
        "BASE revision doesn't exist for " +
        (localPath ? localPath.path : "remote path");
      window.showErrorMessage(errorMsg);
      throw new Error(errorMsg);
    }
    return localPath;
  }
  let out;
  try {
    out = await repo.show(arg, revision);
  } catch (e) {
    window.showErrorMessage("Failed to open path");
    throw e;
  }
  return tempSvnFs.createTempSvnRevisionFile(arg, revision, out);
}

export async function openDiff(
  repo: IRemoteRepository,
  arg1: Uri,
  r1: string | undefined,
  r2: string,
  arg2?: Uri
) {
  // For added files (r1 = undefined), create empty temp file
  const uri1 = r1
    ? await downloadFile(repo, arg1, r1)
    : await tempSvnFs.createTempSvnRevisionFile(arg1, "empty", "");
  const uri2 = await downloadFile(repo, arg2 || arg1, r2);
  const opts: TextDocumentShowOptions = {
    preview: true
  };
  const title = r1
    ? `${path.basename(arg1.path)} (${r1} : ${r2})`
    : `${path.basename(arg1.path)} (added in ${r2})`;
  return commands.executeCommand<void>("vscode.diff", uri1, uri2, title, opts);
}

export async function openFileRemote(
  repo: IRemoteRepository,
  arg: Uri,
  against: string
) {
  let out;
  try {
    out = await repo.show(arg, against);
  } catch {
    window.showErrorMessage("Failed to open path");
    return;
  }
  const localUri = await tempSvnFs.createTempSvnRevisionFile(arg, against, out);
  const opts: TextDocumentShowOptions = {
    preview: true
  };
  return commands.executeCommand<void>("vscode.open", localUri, opts);
}
