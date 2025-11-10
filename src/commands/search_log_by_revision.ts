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
      window.showErrorMessage("Invalid revision. Please enter a number or keyword (HEAD, BASE, PREV, COMMITTED)");
      return;
    }

    const revision = parseInt(input, 10);

    try {
      const resource = toSvnUri(
        Uri.file(repository.workspaceRoot),
        SvnUriAction.LOG_REVISION,
        { revision }
      );
      const uri = resource.with({
        path: path.join(resource.path, "svn.log")
      });

      await commands.executeCommand<void>("vscode.open", uri);
    } catch (error) {
      console.error(error);
      window.showErrorMessage("Unable to log");
    }
  }
}
