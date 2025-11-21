// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { window } from "vscode";
import { configuration } from "../helpers/configuration";
import IncomingChangeNode from "../treeView/nodes/incomingChangeNode";
import { Command } from "./command";

export class PullIncommingChange extends Command {
  constructor() {
    super("svn.treeview.pullIncomingChange");
  }

  // TODO: clean this up
  public async execute(...changes: any[]) {
    const showUpdateMessage = configuration.get<boolean>(
      "showUpdateMessage",
      true
    );

    if (changes[0] instanceof IncomingChangeNode) {
      await this.handleRepositoryOperation(async () => {
        const incomingChange = changes[0];

        const result = await incomingChange.repository.pullIncomingChange(
          incomingChange.uri.fsPath
        );

        if (showUpdateMessage) {
          window.showInformationMessage(result);
        }
      }, "Unable to update");

      return;
    }

    const uris = changes.map(change => change.resourceUri);

    await this.runByRepository(uris, async (repository, resources) => {
      const files = resources.map(resource => resource.fsPath);

      files.forEach(async path => {
        const result = await repository.pullIncomingChange(path);

        if (showUpdateMessage) {
          window.showInformationMessage(result);
        }
      });
    });
  }
}
