// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { getPatchChangelist } from "../changelistItems";
import { Repository } from "../repository";
import { Command } from "./command";

export class PatchChangeList extends Command {
  constructor() {
    super("svn.patchChangeList", { repository: true });
  }

  public async execute(repository: Repository) {
    const changelistName = await getPatchChangelist(repository);

    if (!changelistName) {
      return;
    }

    const content = await repository.patchChangelist(changelistName);
    await this.showDiffPath(repository, content);
  }
}
