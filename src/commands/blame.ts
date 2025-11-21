// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { window, Uri } from "vscode";
import { Command } from "./command";
import { Repository } from "../repository";
import { Resource } from "../resource";
import { logError } from "../util/errorLogger";

/**
 * Execute SVN blame on a file and display results
 * This command directly calls repository.blame() and can be used for:
 * - Programmatic blame access
 * - Testing blame functionality
 * - Integration with other tools
 *
 * For UI-integrated blame, use showBlame/toggleBlame commands
 * which work with BlameProvider.
 */
export class Blame extends Command {
  constructor() {
    super("svn.blameFile", { repository: true });
  }

  /**
   * Execute blame on a file
   * @param repository Repository instance
   * @param arg Resource or Uri to blame (defaults to active editor)
   * @param revision Optional revision to blame (defaults to HEAD)
   */
  public async execute(
    repository: Repository,
    arg?: Resource | Uri,
    revision?: string
  ) {
    await this.handleRepositoryOperation(async () => {
      let uri: Uri | undefined;

      // Determine URI from argument or active editor
      if (arg instanceof Resource) {
        uri = arg.resourceUri;
      } else if (arg instanceof Uri) {
        uri = arg;
      } else {
        const editor = window.activeTextEditor;
        if (editor) {
          uri = editor.document.uri;
        }
      }

      if (!uri) {
        window.showErrorMessage("No file selected for blame");
        return;
      }

      // Execute blame
      try {
        const blameLines = await repository.blame(
          uri.fsPath,
          revision || "HEAD"
        );

        // For now, just show success message
        // BlameProvider will handle actual UI display
        window.showInformationMessage(
          `Blame loaded: ${blameLines.length} lines from ${uri.fsPath}`
        );

        // TODO: Trigger BlameProvider to display results
        // This will be wired up when BlameProvider is implemented

      } catch (err) {
        logError("Blame command failed", err);
        throw err; // handleRepositoryOperation will catch and show to user
      }
    }, "Unable to blame file");
  }
}
