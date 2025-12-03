// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { window } from "vscode";
import { SvnDepth } from "../common/types";

export async function confirmRevert() {
  const yes = "Yes I'm sure";
  const answer = await window.showWarningMessage(
    "Are you sure? This will wipe all local changes.",
    { modal: true },
    yes
  );

  if (answer !== yes) {
    return false;
  }

  return true;
}

/**
 * Always returns "infinity" depth for revert operations.
 * For files, depth is ignored by SVN. For directories, infinity ensures
 * full recursive revert including deleted paths.
 */
export async function checkAndPromptDepth(): Promise<keyof typeof SvnDepth> {
  return "infinity";
}
