// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { posix as path } from "path";
import { commands, Uri } from "vscode";
import { SvnUriAction } from "../common/types";
import { Repository } from "../repository";
import { toSvnUri } from "../uri";
import { Command } from "./command";

export class Log extends Command {
  constructor() {
    super("svn.log", { repository: true });
  }

  public async execute(repository: Repository) {
    await this.handleRepositoryOperation(async () => {
      const resource = toSvnUri(
        Uri.file(repository.workspaceRoot),
        SvnUriAction.LOG
      );
      const uri = resource.with({
        path: path.join(resource.path, "svn.log") // change document title
      });

      await commands.executeCommand<void>("vscode.open", uri);
    }, "Unable to log");
  }
}
