// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { Uri } from "vscode";
import { Command } from "./command";

export class AddToIgnoreExplorer extends Command {
  constructor() {
    super("svn.addToIgnoreExplorer");
  }

  public async execute(_mainUri?: Uri, allUris?: Uri[]) {
    if (!allUris || allUris.length === 0) {
      return;
    }

    return this.addToIgnore(allUris);
  }
}
