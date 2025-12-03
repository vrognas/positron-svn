// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { window } from "vscode";

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
