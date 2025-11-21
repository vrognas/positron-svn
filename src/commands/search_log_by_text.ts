// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { Command } from "./command";
import { window, Uri, commands, ProgressLocation } from "vscode";
import { Repository } from "../repository";
import { validateSearchPattern } from "../validation";
import { tempSvnFs } from "../temp_svn_fs";

export class SearchLogByText extends Command {
  constructor() {
    super("svn.searchLogByText", { repository: true });
  }

  public async execute(repository: Repository) {
    const input = await window.showInputBox({ prompt: "Search query" });
    if (!input) {
      return;
    }

    // Validate search pattern to prevent command injection
    if (!validateSearchPattern(input)) {
      window.showErrorMessage("Invalid search pattern: contains forbidden characters");
      return;
    }

    const uri = Uri.parse("tempsvnfs:/svn.log");
    tempSvnFs.writeFile(uri, Buffer.from(""), {
      create: true,
      overwrite: true
    });

    await commands.executeCommand<void>("vscode.open", uri);

    await this.handleRepositoryOperation(async () => {
      const result = await window.withProgress(
        {
          cancellable: false,
          location: ProgressLocation.Notification,
          title: "Searching Log"
        },
        async () => {
          return repository.plainLogByText(input);
        }
      );

      // Write output to temp file
      tempSvnFs.writeFile(uri, Buffer.from(result), {
        create: true,
        overwrite: true
      });
    }, "Unable to search log");
  }
}
