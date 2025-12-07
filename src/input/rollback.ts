// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { window } from "vscode";

export async function confirmRollback(revision: string): Promise<boolean> {
  const yes = "Yes, rollback";
  const answer = await window.showWarningMessage(
    `Rollback file to revision ${revision}? This will modify your working copy.`,
    { modal: true },
    yes
  );

  return answer === yes;
}
