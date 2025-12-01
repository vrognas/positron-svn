// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import * as path from "path";
import {
  commands,
  Disposable,
  ExtensionContext,
  OutputChannel,
  Uri,
  window
} from "vscode";
import { registerCommands } from "./commands";
import { ConstructorPolicy } from "./common/types";
import { CheckActiveEditor } from "./contexts/checkActiveEditor";
import { OpenRepositoryCount } from "./contexts/openRepositoryCount";
import { BlameIconState } from "./contexts/blameIconState";
import { configuration } from "./helpers/configuration";
import { ItemLogProvider } from "./historyView/itemLogProvider";
import { RepoLogProvider } from "./historyView/repoLogProvider";
import * as messages from "./messages";
import { SourceControlManager } from "./source_control_manager";
import { Svn } from "./svn";
import { SvnFinder } from "./svnFinder";
import SvnProvider from "./treeView/dataProviders/svnProvider";
import SparseCheckoutProvider from "./treeView/dataProviders/sparseCheckoutProvider";
import { toDisposable } from "./util";
import { BranchChangesProvider } from "./historyView/branchChangesProvider";
import { IsSvn19orGreater } from "./contexts/isSvn19orGreater";
import { IsSvn18orGreater } from "./contexts/isSvn18orGreater";
import { tempSvnFs } from "./temp_svn_fs";
import { SvnFileSystemProvider } from "./svnFileSystemProvider";
import { isPositron, getEnvironmentName } from "./positron/runtime";
import { logError } from "./util/errorLogger";
import { registerSvnConnectionsProvider } from "./positron/connectionsProvider";
import { BlameStatusBar } from "./blame/blameStatusBar";

async function init(
  extensionContext: ExtensionContext,
  outputChannel: OutputChannel,
  disposables: Disposable[]
) {
  console.log("SVN Extension: init() started");
  const pathHint = configuration.get<string>("path");
  const svnFinder = new SvnFinder();

  console.log("SVN Extension: Finding SVN executable...");
  // Pass context for caching - startup optimization saves ~1-2s on subsequent launches
  const info = await svnFinder.findSvn(pathHint, extensionContext);
  console.log(`SVN Extension: Found SVN ${info.version} at ${info.path}`);

  const svn = new Svn({ svnPath: info.path, version: info.version });

  // Register process exit handlers for credential cleanup
  const cleanup = () => {
    console.log("SVN Extension: Cleaning up credentials on process exit");
    svn.getAuthCache().dispose();
  };

  process.on("exit", cleanup);
  process.on("SIGINT", () => {
    cleanup();
    process.exit();
  });
  process.on("SIGTERM", () => {
    cleanup();
    process.exit();
  });

  const sourceControlManager = await new SourceControlManager(
    svn,
    ConstructorPolicy.Async,
    extensionContext
  );

  console.log("SVN Extension: Registering commands...");
  registerCommands(sourceControlManager, disposables);

  console.log("SVN Extension: Creating providers...");
  disposables.push(
    sourceControlManager,
    tempSvnFs,
    new SvnFileSystemProvider(sourceControlManager),
    new SvnProvider(sourceControlManager),
    new RepoLogProvider(sourceControlManager),
    new ItemLogProvider(sourceControlManager),
    new BranchChangesProvider(sourceControlManager),
    new SparseCheckoutProvider(sourceControlManager),
    new CheckActiveEditor(sourceControlManager),
    new OpenRepositoryCount(sourceControlManager),
    new IsSvn18orGreater(info.version),
    new IsSvn19orGreater(info.version),
    new BlameIconState(sourceControlManager)
  );

  outputChannel.appendLine(`Using svn "${info.version}" from "${info.path}"`);
  outputChannel.appendLine(`Running in ${getEnvironmentName()}`);
  console.log("SVN Extension: Providers created successfully");

  // Initialize blame status bar (singleton)
  console.log("SVN Extension: Creating BlameStatusBar...");
  const blameStatusBar = new BlameStatusBar(sourceControlManager);
  disposables.push(blameStatusBar);

  // Register blame commands
  disposables.push(
    commands.registerCommand("svn.showBlameCommit", () => {
      blameStatusBar.showCommitDetails();
    })
  );
  console.log("SVN Extension: BlameStatusBar created");

  // Register Positron-specific providers
  if (isPositron()) {
    console.log("SVN Extension: Registering Positron connections provider");
    const connectionsDisposable =
      registerSvnConnectionsProvider(sourceControlManager);
    if (connectionsDisposable) {
      disposables.push(connectionsDisposable);
      outputChannel.appendLine("Positron: SVN Connections provider registered");
    }
  }

  const onOutput = (str: string) => outputChannel.append(str);
  svn.onOutput.addListener("log", onOutput);
  disposables.push(
    toDisposable(() => svn.onOutput.removeListener("log", onOutput))
  );
  disposables.push(toDisposable(messages.dispose));
  console.log("SVN Extension: init() complete");
}

async function _activate(context: ExtensionContext, disposables: Disposable[]) {
  const outputChannel = window.createOutputChannel("Svn");
  commands.registerCommand("svn.showOutput", () => outputChannel.show());
  disposables.push(outputChannel);

  const showOutput = configuration.get<boolean>("showOutput");

  if (showOutput) {
    outputChannel.show();
  }

  const tryInit = async () => {
    try {
      await init(context, outputChannel, disposables);
    } catch (err) {
      const error = err as Error;
      if (!/Svn installation not found/.test(error.message || "")) {
        throw err;
      }

      const shouldIgnore =
        configuration.get<boolean>("ignoreMissingSvnWarning") === true;

      if (shouldIgnore) {
        return;
      }

      console.warn(error.message);
      outputChannel.appendLine(error.message);
      outputChannel.show();

      const findSvnExecutable = "Find SVN executable";
      const download = "Download SVN";
      const neverShowAgain = "Don't Show Again";
      const choice = await window.showWarningMessage(
        "SVN not found. Install it or configure it using the 'svn.path' setting.",
        findSvnExecutable,
        download,
        neverShowAgain
      );

      if (choice === findSvnExecutable) {
        let filters: { [name: string]: string[] } | undefined;

        // For windows, limit to executable files
        if (path.sep === "\\") {
          filters = {
            svn: ["exe", "bat"]
          };
        }

        const executable = await window.showOpenDialog({
          canSelectFiles: true,
          canSelectFolders: false,
          canSelectMany: false,
          filters
        });

        if (executable && executable[0]) {
          const file = executable[0].fsPath;

          outputChannel.appendLine(`Updated "svn.path" with "${file}"`);

          await configuration.update("path", file);

          // Try Re-init after select the executable
          await tryInit();
        }
      } else if (choice === download) {
        commands.executeCommand(
          "vscode.open",
          Uri.parse("https://subversion.apache.org/packages.html")
        );
      } else if (choice === neverShowAgain) {
        await configuration.update("ignoreMissingSvnWarning", true);
      }
    }
  };

  await tryInit();
}

export async function activate(context: ExtensionContext) {
  const env = getEnvironmentName();
  const inPositron = isPositron();

  console.log(`SVN Extension: activate() called in ${env}`);
  if (inPositron) {
    console.log("SVN Extension: Positron-specific features available");
  }

  const disposables: Disposable[] = [];
  context.subscriptions.push(
    new Disposable(() => Disposable.from(...disposables).dispose())
  );

  await _activate(context, disposables).catch(err => {
    logError("SVN Extension: Activation failed", err);
    window.showErrorMessage(
      `SVN Extension activation failed: ${err.message || err}`
    );
  });
  console.log("SVN Extension: activation complete");
}

// this method is called when your extension is deactivated

export function deactivate() {}
