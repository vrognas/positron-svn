// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { Disposable, window } from "vscode";
import { blameStateManager } from "../blame/blameStateManager";
import { IDisposable, setVscodeContext } from "../util";
import { logError } from "../util/errorLogger";
import { SourceControlManager } from "../source_control_manager";

export class BlameIconState implements IDisposable {
  private disposables: Disposable[] = [];

  constructor(private sourceControlManager: SourceControlManager) {
    // Listen to blame state changes
    blameStateManager.onDidChangeState(
      () => this.updateIconContext(),
      this,
      this.disposables
    );

    // Listen to active editor changes
    window.onDidChangeActiveTextEditor(
      () => this.updateIconContext(),
      this,
      this.disposables
    );

    // Listen to repository discovery
    sourceControlManager.onDidOpenRepository(
      () => this.updateIconContext(),
      this,
      this.disposables
    );

    // Listen to repository status changes (for file status updates)
    sourceControlManager.onDidChangeStatusRepository(
      () => this.updateIconContext(),
      this,
      this.disposables
    );

    // Set initial state
    void this.updateIconContext().catch(err => {
      logError("BlameIconState initial context update failed", err);
      // Set safe defaults
      void setVscodeContext("svnBlameActiveForFile", false);
      void setVscodeContext("svnBlameUntrackedFile", false);
    });
  }

  private async updateIconContext(): Promise<void> {
    const editor = window.activeTextEditor;

    if (!editor || editor.document.uri.scheme !== "file") {
      await setVscodeContext("svnBlameActiveForFile", false);
      await setVscodeContext("svnBlameUntrackedFile", false);
      return;
    }

    // Check if file is tracked in SVN
    const repository = this.sourceControlManager.getRepository(
      editor.document.uri
    );

    // No repository found - file not in SVN workspace
    if (!repository) {
      await setVscodeContext("svnBlameActiveForFile", false);
      await setVscodeContext("svnBlameUntrackedFile", false);
      return;
    }

    const resource = repository.getResourceFromFile(editor.document.uri);

    // Resource not loaded yet - repository still indexing OR file not tracked
    if (!resource) {
      // No resource = clean file (not in change index)
      // Check state manager for actual blame state
      const isEnabled = blameStateManager.isBlameEnabled(editor.document.uri);
      await setVscodeContext("svnBlameActiveForFile", isEnabled);
      await setVscodeContext("svnBlameUntrackedFile", false);
      return;
    }

    // Check if file cannot be blamed:
    // - UNVERSIONED/IGNORED/NONE: not under version control
    // - ADDED: scheduled for addition but never committed (E195002)
    const { Status } = await import("../common/types");
    const cannotBlame =
      resource.type === Status.UNVERSIONED ||
      resource.type === Status.IGNORED ||
      resource.type === Status.NONE ||
      resource.type === Status.ADDED;

    // Set context variables
    if (cannotBlame) {
      await setVscodeContext("svnBlameActiveForFile", false);
      await setVscodeContext("svnBlameUntrackedFile", true);
    } else {
      const isEnabled = blameStateManager.isBlameEnabled(editor.document.uri);
      await setVscodeContext("svnBlameActiveForFile", isEnabled);
      await setVscodeContext("svnBlameUntrackedFile", false);
    }
  }

  public dispose(): void {
    this.disposables.forEach(d => d.dispose());
  }
}
