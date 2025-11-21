// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { SourceControlManager } from "../source_control_manager";
import { Command } from "./command";

export class GetSourceControlManager extends Command {
  constructor(protected sourceControlManager: SourceControlManager) {
    super("svn.getSourceControlManager");
  }

  public async execute() {
    return this.sourceControlManager;
  }
}
