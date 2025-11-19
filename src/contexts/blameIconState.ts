import { Disposable, window } from "vscode";
import { blameStateManager } from "../blame/blameStateManager";
import { IDisposable, setVscodeContext } from "../util";
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

    // Listen to repository changes (for file status updates)
    sourceControlManager.onDidChangeStatusRepository(
      () => this.updateIconContext(),
      this,
      this.disposables
    );

    // Set initial state
    void this.updateIconContext();
  }

  private async updateIconContext(): Promise<void> {
    const editor = window.activeTextEditor;
    console.log("[BlameIconState] updateIconContext called, editor:", editor?.document.uri.fsPath);

    if (!editor || editor.document.uri.scheme !== "file") {
      console.log("[BlameIconState] No editor or non-file scheme, setting both to false");
      await setVscodeContext("svnBlameActiveForFile", false);
      await setVscodeContext("svnBlameUntrackedFile", false);
      return;
    }

    // Check if file is untracked in SVN
    const repository = this.sourceControlManager.getRepository(editor.document.uri);
    let isUntracked = false;

    if (repository) {
      const resource = repository.getResourceFromFile(editor.document.uri);
      if (resource) {
        const { Status } = await import("../common/types");
        isUntracked = resource.type === Status.UNVERSIONED ||
                      resource.type === Status.IGNORED ||
                      resource.type === Status.NONE;
      }
    }

    // Set context variables
    if (isUntracked) {
      console.log("[BlameIconState] File is UNTRACKED, setting svnBlameUntrackedFile=true");
      await setVscodeContext("svnBlameActiveForFile", false);
      await setVscodeContext("svnBlameUntrackedFile", true);
    } else {
      const isEnabled = blameStateManager.isBlameEnabled(editor.document.uri);
      console.log("[BlameIconState] File is TRACKED, blame enabled:", isEnabled);
      await setVscodeContext("svnBlameActiveForFile", isEnabled);
      await setVscodeContext("svnBlameUntrackedFile", false);
    }
  }

  public dispose(): void {
    this.disposables.forEach(d => d.dispose());
  }
}
