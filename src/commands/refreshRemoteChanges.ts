// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { Repository } from "../repository";
import { Command } from "./command";

export class RefreshRemoteChanges extends Command {
  constructor() {
    super("svn.refreshRemoteChanges", { repository: true });
  }

  public async execute(repository: Repository) {
    await repository.updateRemoteChangedFiles();
  }
}
