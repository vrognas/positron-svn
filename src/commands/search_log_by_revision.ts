// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { posix as path } from "path";
import { Command } from "./command";
import { window, Uri, commands } from "vscode";
import { Repository } from "../repository";
import { toSvnUri } from "../uri";
import { SvnUriAction } from "../common/types";
import { validateRevision } from "../validation";

export class SearchLogByRevision extends Command {
  constructor() {
    super("svn.searchLogByRevision", { repository: true });
  }

  public async execute(repository: Repository) {
    const input = await window.showInputBox({ prompt: "Revision?" });
    if (!input) {
      return;
    }

    // Use centralized validation to prevent injection attacks
    if (!validateRevision(input)) {
      window.showErrorMessage("Invalid revision. Enter number (max 1B) or keyword (HEAD, BASE, PREV, COMMITTED)");
      return;
    }

    const revision = parseInt(input, 10);

    await this.handleRepositoryOperation(async () => {
      const resource = toSvnUri(
        Uri.file(repository.workspaceRoot),
        SvnUriAction.LOG_REVISION,
        { revision }
      );
      const uri = resource.with({
        path: path.join(resource.path, "svn.log")
      });

      await commands.executeCommand<void>("vscode.open", uri);
    }, "Unable to log");
  }
}
