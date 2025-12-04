// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { SourceControlResourceState, window } from "vscode";
import { configuration } from "../helpers/configuration";
import IncomingChangeNode from "../treeView/nodes/incomingChangeNode";
import { Command } from "./command";

export class PullIncommingChange extends Command {
  constructor() {
    super("svn.treeview.pullIncomingChange");
  }

  public async execute(
    ...changes: (IncomingChangeNode | SourceControlResourceState)[]
  ) {
    const showUpdateMessage = configuration.get<boolean>(
      "showUpdateMessage",
      true
    );

    if (changes[0] instanceof IncomingChangeNode) {
      await this.handleRepositoryOperation(async () => {
        const incomingChange = changes[0] as IncomingChangeNode;

        const result = await incomingChange.repository.pullIncomingChange(
          incomingChange.uri.fsPath
        );

        // Refresh remote changes after pull
        incomingChange.repository.refreshRemoteChanges();

        if (showUpdateMessage) {
          window.showInformationMessage(result);
        }
      }, "Unable to update");

      return;
    }

    const uris = (changes as SourceControlResourceState[]).map(
      change => change.resourceUri
    );

    await this.runByRepository(uris, async (repository, resources) => {
      const files = resources.map(resource => resource.fsPath);

      // Pull all files and collect results
      const results = await Promise.all(
        files.map(path => repository.pullIncomingChange(path))
      );

      // Refresh remote changes once after batch completes (not per-file)
      repository.refreshRemoteChanges();

      // Show single batched notification
      if (showUpdateMessage && results.length > 0) {
        const message =
          results.length === 1
            ? results[0]!
            : `Updated ${results.length} files`;
        window.showInformationMessage(message);
      }
    });
  }
}
