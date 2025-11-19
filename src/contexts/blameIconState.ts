import { Disposable, window } from "vscode";
import { blameStateManager } from "../blame/blameStateManager";
import { IDisposable, setVscodeContext } from "../util";

export class BlameIconState implements IDisposable {
  private disposables: Disposable[] = [];

  constructor() {
    // Listen to blame state changes
    blameStateManager.onDidChangeState(
      this.updateIconContext,
      this,
      this.disposables
    );

    // Listen to active editor changes
    window.onDidChangeActiveTextEditor(
      () => this.updateIconContext(),
      this,
      this.disposables
    );

    // Set initial state
    this.updateIconContext();
  }

  private updateIconContext(): void {
    const editor = window.activeTextEditor;
    if (!editor || editor.document.uri.scheme !== "file") {
      setVscodeContext("svnBlameActiveForFile", false);
      return;
    }

    const isEnabled = blameStateManager.isBlameEnabled(editor.document.uri);
    setVscodeContext("svnBlameActiveForFile", isEnabled);
  }

  public dispose(): void {
    this.disposables.forEach(d => d.dispose());
  }
}
