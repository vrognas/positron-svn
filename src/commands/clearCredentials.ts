// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { commands, window } from "vscode";
import { SourceControlManager } from "../source_control_manager";
import { Command } from "./command";

export class ClearCredentials extends Command {
  constructor() {
    // No repository required - clears all stored credentials
    super("svn.clearCredentials", { repository: false });
  }

  public async execute() {
    const sourceControlManager = (await commands.executeCommand(
      "svn.getSourceControlManager",
      ""
    )) as SourceControlManager;

    const repositories = sourceControlManager.repositories;

    if (repositories.length === 0) {
      window.showWarningMessage(
        "No SVN repositories open. Open a repository first to clear its credentials."
      );
      return;
    }

    // Clear credentials for all open repositories
    const cleared = new Set<string>();
    for (const repo of repositories) {
      const serviceName = repo.getCredentialServiceName();
      if (!cleared.has(serviceName)) {
        await repo.clearCredentials();
        cleared.add(serviceName);
      }
    }

    const serverCount = cleared.size;
    window.showInformationMessage(
      `SVN credentials cleared for ${serverCount} server${serverCount > 1 ? "s" : ""}. You will be prompted on next operation.`
    );
  }
}
