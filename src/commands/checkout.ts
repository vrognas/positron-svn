// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import * as os from "os";
import * as path from "path";
import { commands, ProgressLocation, Uri, window, workspace } from "vscode";
import { IAuth, ICpOptions, ISvnErrorData } from "../common/types";
import { getBranchName } from "../helpers/branch";
import { configuration } from "../helpers/configuration";
import { SourceControlManager } from "../source_control_manager";
import { svnErrorCodes } from "../svn";
import { validateRepositoryUrl } from "../validation";
import { Command } from "./command";

export class Checkout extends Command {
  constructor() {
    super("svn.checkout");
  }

  public async execute(url?: string) {
    if (!url) {
      url = await window.showInputBox({
        prompt: "Repository URL",
        ignoreFocusOut: true
      });
    }

    if (!url) {
      return;
    }

    // Validate URL to prevent SSRF and command injection
    if (!validateRepositoryUrl(url)) {
      window.showErrorMessage(
        `Invalid repository URL. Only http://, https://, svn://, and svn+ssh:// protocols are allowed.`
      );
      return;
    }

    let defaultCheckoutDirectory =
      configuration.get<string>("defaultCheckoutDirectory") || os.homedir();
    defaultCheckoutDirectory = defaultCheckoutDirectory.replace(
      /^~/,
      os.homedir()
    );

    const uris = await window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      defaultUri: Uri.file(defaultCheckoutDirectory),
      openLabel: "Select Repository Location"
    });

    if (!uris || uris.length === 0) {
      return;
    }

    const uri = uris[0]!;
    const parentPath = uri.fsPath;

    let folderName: string | undefined;

    // Get folder name from branch
    const branch = getBranchName(url);
    if (branch) {
      const baseUrl = url.replace(/\//g, "/").replace(branch.path, "");
      folderName = path.basename(baseUrl);
    }

    folderName = await window.showInputBox({
      prompt: "Folder name",
      value: folderName,
      ignoreFocusOut: true
    });

    if (!folderName) {
      return;
    }

    const repositoryPath = path.join(parentPath, folderName);

    // Use Notification location if supported
    let location: ProgressLocation = ProgressLocation.Window;
    if ((ProgressLocation as unknown as Record<string, unknown>).Notification) {
      location = (
        ProgressLocation as unknown as Record<string, ProgressLocation>
      ).Notification!;
    }

    const progressOptions = {
      location,
      title: `Checkout svn repository '${url}'...`,
      cancellable: true
    };

    let attempt = 0;

    const opt: ICpOptions = {};

    while (true) {
      attempt++;
      try {
        await window.withProgress(progressOptions, async () => {
          const sourceControlManager = (await commands.executeCommand(
            "svn.getSourceControlManager",
            ""
          )) as SourceControlManager;
          const args = ["checkout", url, repositoryPath];
          await sourceControlManager.svn.exec(parentPath, args, opt);
        });
        break;
      } catch (err) {
        const svnError = err as ISvnErrorData;
        if (
          svnError.svnErrorCode === svnErrorCodes.AuthorizationFailed &&
          attempt <= 3
        ) {
          const auth = (await commands.executeCommand(
            "svn.promptAuth",
            opt.username,
            undefined,
            url
          )) as IAuth;
          if (auth) {
            opt.username = auth.username;
            opt.password = auth.password;
            continue;
          }
        }
        throw err;
      }
    }

    const choices = [];
    let message = "Would you like to open the checked out repository?";
    const open = "Open Repository";
    choices.push(open);

    const addToWorkspace = "Add to Workspace";
    if (
      workspace.workspaceFolders &&
      (workspace as unknown as Record<string, unknown>).updateWorkspaceFolders // For VSCode >= 1.21
    ) {
      message =
        "Would you like to open the checked out repository, or add it to the current workspace?";
      choices.push(addToWorkspace);
    }

    const result = await window.showInformationMessage(message, ...choices);

    const openFolder = result === open;

    if (openFolder) {
      commands.executeCommand("vscode.openFolder", Uri.file(repositoryPath));
    } else if (result === addToWorkspace) {
      // For VSCode >= 1.21
      (
        workspace as unknown as {
          updateWorkspaceFolders: (
            start: number,
            deleteCount: number,
            folder: { uri: Uri }
          ) => void;
        }
      ).updateWorkspaceFolders(workspace.workspaceFolders!.length, 0, {
        uri: Uri.file(repositoryPath)
      });
    }
  }
}
