// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { SourceControlResourceState, Uri, window } from "vscode";
import { Command } from "./command";
import { makeReadOnly } from "../fs";

export class Unlock extends Command {
  constructor() {
    super("svn.unlock");
  }

  public async execute(...args: (SourceControlResourceState | Uri)[]) {
    // Handle Uri from Explorer context menu
    // args[0] = clicked item, args[1] = array of all selected items (multi-select)
    if (args.length > 0 && args[0] instanceof Uri) {
      const uris = Array.isArray(args[1])
        ? (args[1] as Uri[]).filter((a): a is Uri => a instanceof Uri)
        : [args[0]];
      await this.runByRepository(uris, async (repository, resources) => {
        const paths = resources.map(r => r.fsPath);
        const result = await repository.unlock(paths);
        if (result.exitCode === 0) {
          // Make files read-only after unlocking (if has needs-lock property)
          for (const p of paths) {
            const hasNeedsLock = await repository.hasNeedsLock(p);
            if (hasNeedsLock) {
              try {
                await makeReadOnly(p);
              } catch {
                // Ignore permission errors
              }
            }
          }
          window.showInformationMessage(`Unlocked ${paths.length} file(s)`);
        } else {
          window.showErrorMessage(
            `Unlock failed: ${result.stderr || "Unknown error"}`
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
        const result = await repository.unlock(paths);
        if (result.exitCode === 0) {
          // Make files read-only after unlocking (if has needs-lock property)
          for (const p of paths) {
            const hasNeedsLock = await repository.hasNeedsLock(p);
            if (hasNeedsLock) {
              try {
                await makeReadOnly(p);
              } catch {
                // Ignore permission errors
              }
            }
          }
          window.showInformationMessage(`Unlocked ${paths.length} file(s)`);
        } else {
          window.showErrorMessage(
            `Unlock failed: ${result.stderr || "Unknown error"}`
          );
        }
      },
      "Unable to unlock files"
    );
  }
}

export class BreakLock extends Command {
  constructor() {
    super("svn.breakLock");
  }

  public async execute(...args: (SourceControlResourceState | Uri)[]) {
    // Confirm breaking lock
    const answer = await window.showWarningMessage(
      "Break lock owned by another user? This cannot be undone.",
      { modal: true },
      "Break Lock",
      "Cancel"
    );

    if (answer !== "Break Lock") {
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
        const result = await repository.unlock(paths, { force: true });
        if (result.exitCode === 0) {
          // Make files read-only after unlocking (if has needs-lock property)
          for (const p of paths) {
            const hasNeedsLock = await repository.hasNeedsLock(p);
            if (hasNeedsLock) {
              try {
                await makeReadOnly(p);
              } catch {
                // Ignore permission errors
              }
            }
          }
          window.showInformationMessage(
            `Broke lock on ${paths.length} file(s)`
          );
        } else {
          window.showErrorMessage(
            `Break lock failed: ${result.stderr || "Unknown error"}`
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
        const result = await repository.unlock(paths, { force: true });
        if (result.exitCode === 0) {
          // Make files read-only after unlocking (if has needs-lock property)
          for (const p of paths) {
            const hasNeedsLock = await repository.hasNeedsLock(p);
            if (hasNeedsLock) {
              try {
                await makeReadOnly(p);
              } catch {
                // Ignore permission errors
              }
            }
          }
          window.showInformationMessage(
            `Broke lock on ${paths.length} file(s)`
          );
        } else {
          window.showErrorMessage(
            `Break lock failed: ${result.stderr || "Unknown error"}`
          );
        }
      },
      "Unable to break lock"
    );
  }
}
