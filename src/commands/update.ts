// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { window } from "vscode";
import { configuration } from "../helpers/configuration";
import { Repository } from "../repository";
import { Command } from "./command";

export class Update extends Command {
  constructor() {
    super("svn.update", { repository: true });
  }

  public async execute(repository: Repository) {
    await this.handleRepositoryOperation(async () => {
      const ignoreExternals = configuration.get<boolean>(
        "update.ignoreExternals",
        false
      );
      const showUpdateMessage = configuration.get<boolean>(
        "showUpdateMessage",
        true
      );

      const result = await repository.updateRevision(ignoreExternals);

      if (showUpdateMessage) {
        window.showInformationMessage(result);
      }
    }, "Unable to update");
  }
}
