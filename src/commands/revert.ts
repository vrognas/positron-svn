// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { SourceControlResourceState } from "vscode";
import { confirmRevert } from "../input/revert";
import { Command } from "./command";

export class Revert extends Command {
  constructor() {
    super("svn.revert");
  }

  public async execute(...resourceStates: SourceControlResourceState[]) {
    const selection = await this.getResourceStatesOrExit(resourceStates);
    if (!selection || !(await confirmRevert())) return;

    const uris = selection.map(resource => resource.resourceUri);
    // Always use infinity depth - for files it's ignored by SVN,
    // for directories it ensures full recursive revert including deleted paths
    await this.executeRevert(uris, "infinity");
  }
}
