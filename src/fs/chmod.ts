// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { chmod as fsChmod, stat as fsStat } from "fs";
import { promisify } from "util";

const chmodAsync = promisify(fsChmod);
const statAsync = promisify(fsStat);

/**
 * Make a file read-only by removing write permissions.
 * @param path Path to the file
 */
export async function makeReadOnly(path: string): Promise<void> {
  const stats = await statAsync(path);
  // Remove write bits (owner, group, others) - keep read and execute
  const readOnlyMode = stats.mode & ~0o222;
  await chmodAsync(path, readOnlyMode);
}

/**
 * Make a file writable by adding write permission for owner.
 * @param path Path to the file
 */
export async function makeWritable(path: string): Promise<void> {
  const stats = await statAsync(path);
  // Add owner write bit
  const writableMode = stats.mode | 0o200;
  await chmodAsync(path, writableMode);
}
