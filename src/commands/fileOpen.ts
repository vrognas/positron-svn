// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { commands, Uri } from "vscode";
import { Command } from "./command";

export class FileOpen extends Command {
  constructor() {
    super("svn.fileOpen");
  }

  public async execute(resourceUri: Uri) {
    await commands.executeCommand("vscode.open", resourceUri);
  }
}
