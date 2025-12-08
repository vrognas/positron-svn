// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { SourceControlResourceState, Uri, window } from "vscode";
import { Command } from "./command";
import { validateLockComment } from "../validation";
import { makeWritable } from "../fs";

export class Lock extends Command {
  constructor() {
    super("svn.lock");
  }

  public async execute(...args: (SourceControlResourceState | Uri)[]) {
    // Prompt for optional lock comment
    const comment = await window.showInputBox({
      prompt: "Enter a lock comment (optional)",
      placeHolder: "e.g., Editing large dataset"
    });

    // User cancelled the input box
    if (comment === undefined) {
      return;
    }

    // Validate lock comment to prevent command injection
    if (comment && !validateLockComment(comment)) {
      window.showErrorMessage(
        "Invalid lock comment: shell metacharacters not allowed"
      );
      return;
    }

    // Handle Uri from Explorer context menu
    // args[0] = clicked item, args[1] = array of all selected items (multi-select)
    if (args.length > 0 && args[0] instanceof Uri) {
      const uris = Array.isArray(args[1])
        ? (args[1] as Uri[]).filter((a): a is Uri => a instanceof Uri)
        : [args[0]];
      await this.runByRepository(uris, async (repository, resources) => {
        const paths = resources.map(r => r.fsPath);
        const result = await repository.lock(paths, comment ? { comment } : {});
        if (result.exitCode === 0) {
          // Make files writable after locking (for needs-lock files)
          for (const p of paths) {
            try {
              await makeWritable(p);
            } catch {
              // Ignore permission errors
            }
          }
          window.showInformationMessage(`Locked ${paths.length} file(s)`);
        } else {
          window.showErrorMessage(
            `Lock failed: ${result.stderr || "Unknown error"}`
          );
        }
      });
      return;
    }

    // Handle SourceControlResourceState from SCM view
    const selection = await this.getResourceStatesOrExit(
      args as SourceControlResourceState[]
    );
    if (!selection) return;

    await this.executeOnResources(
      selection,
      async (repository, paths) => {
        const result = await repository.lock(paths, comment ? { comment } : {});
        if (result.exitCode === 0) {
          // Make files writable after locking (for needs-lock files)
          for (const p of paths) {
            try {
              await makeWritable(p);
            } catch {
              // Ignore permission errors
            }
          }
          window.showInformationMessage(`Locked ${paths.length} file(s)`);
        } else {
          window.showErrorMessage(
            `Lock failed: ${result.stderr || "Unknown error"}`
          );
        }
      },
      "Unable to lock files"
    );
  }
}

/**
 * Steal lock from another user (atomic break + relock via svn lock --force)
 */
export class StealLock extends Command {
  constructor() {
    super("svn.stealLock");
  }

  public async execute(...args: (SourceControlResourceState | Uri)[]) {
    // Confirm stealing lock
    const answer = await window.showWarningMessage(
      "Steal lock from another user? They will lose their lock.",
      { modal: true },
      "Steal Lock",
      "Cancel"
    );

    if (answer !== "Steal Lock") {
      return;
    }

    // Handle Uri from Explorer context menu
    // args[0] = clicked item, args[1] = array of all selected items (multi-select)
    if (args.length > 0 && args[0] instanceof Uri) {
      const uris = Array.isArray(args[1])
        ? (args[1] as Uri[]).filter((a): a is Uri => a instanceof Uri)
        : [args[0]];
      await this.runByRepository(uris, async (repository, resources) => {
        const paths = resources.map(r => r.fsPath);
        const result = await repository.lock(paths, { force: true });
        if (result.exitCode === 0) {
          // Make files writable after locking (for needs-lock files)
          for (const p of paths) {
            try {
              await makeWritable(p);
            } catch {
              // Ignore permission errors
            }
          }
          window.showInformationMessage(
            `Stole lock on ${paths.length} file(s)`
          );
        } else {
          window.showErrorMessage(
            `Steal lock failed: ${result.stderr || "Unknown error"}`
          );
        }
      });
      return;
    }

    // Handle SourceControlResourceState from SCM view
    const selection = await this.getResourceStatesOrExit(
      args as SourceControlResourceState[]
    );
    if (!selection) return;

    await this.executeOnResources(
      selection,
      async (repository, paths) => {
        const result = await repository.lock(paths, { force: true });
        if (result.exitCode === 0) {
          // Make files writable after locking (for needs-lock files)
          for (const p of paths) {
            try {
              await makeWritable(p);
            } catch {
              // Ignore permission errors
            }
          }
          window.showInformationMessage(
            `Stole lock on ${paths.length} file(s)`
          );
        } else {
          window.showErrorMessage(
            `Steal lock failed: ${result.stderr || "Unknown error"}`
          );
        }
      },
      "Unable to steal lock"
    );
  }
}
