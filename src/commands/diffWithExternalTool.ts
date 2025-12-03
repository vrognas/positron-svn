// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { commands, SourceControlResourceState, Uri, window } from "vscode";
import { Resource } from "../resource";
import { Command } from "./command";
import { SourceControlManager } from "../source_control_manager";
import { diffWithExternalTool } from "../util/fileOperations";
import { logError } from "../util/errorLogger";

/**
 * Command to open file diff with external diff tool using SVN's --diff-cmd
 * Reads svn.diff.tool from settings (path to bcsvn.bat or similar wrapper)
 * Useful for large tabular files (CSV) where built-in diff is inadequate
 */
export class DiffWithExternalTool extends Command {
  constructor() {
    super("svn.diffWithExternalTool");
  }

  public async execute(
    arg?: Resource | Uri,
    ...resourceStates: SourceControlResourceState[]
  ) {
    let filePath: string | undefined;

    // Extract file path from Resource or Uri
    if (arg instanceof Resource) {
      filePath = arg.resourceUri.fsPath;
    } else if (arg instanceof Uri) {
      filePath = arg.fsPath;
    }

    // If no file provided, try to get from resource states
    if (!filePath && resourceStates.length > 0) {
      filePath = resourceStates[0]!.resourceUri.fsPath;
    }

    if (!filePath) {
      window.showErrorMessage("No file selected for diff");
      return;
    }

    try {
      // Get SourceControlManager (use cached static or fetch via command)
      const sourceControlManager =
        (Command as unknown as { _sourceControlManager?: SourceControlManager })
          ._sourceControlManager ||
        ((await commands.executeCommand(
          "svn.getSourceControlManager",
          ""
        )) as SourceControlManager);

      // Get repository for the file path
      const repository = sourceControlManager.getRepository(Uri.file(filePath));

      if (!repository) {
        window.showErrorMessage("File is not in an SVN repository");
        return;
      }

      // Use shared utility for diff
      await diffWithExternalTool(
        repository.workspaceRoot,
        filePath,
        sourceControlManager.svn.exec.bind(sourceControlManager.svn)
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logError("Failed to launch external diff", error);
      window.showErrorMessage(`Failed to launch external diff: ${message}`);
    }
  }
}
