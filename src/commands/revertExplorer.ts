// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { Uri } from "vscode";
import { confirmRevert } from "../input/revert";
import { Command } from "./command";

export class RevertExplorer extends Command {
  constructor() {
    super("svn.revertExplorer");
  }

  public async execute(_mainUri?: Uri, allUris?: Uri[]) {
    if (!allUris || allUris.length === 0 || !(await confirmRevert())) {
      return;
    }

    // Always use infinity depth - for files it's ignored by SVN,
    // for directories it ensures full recursive revert including deleted paths
    await this.executeRevert(allUris, "infinity");
  }
}
