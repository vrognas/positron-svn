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
      console.error('[BlameIconState] Initial context update failed:', err);
      // Set safe defaults
      void setVscodeContext("svnBlameActiveForFile", false);
      void setVscodeContext("svnBlameUntrackedFile", false);
    });
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

    // Check if file is tracked in SVN
    const repository = this.sourceControlManager.getRepository(editor.document.uri);

    // No repository found - file not in SVN workspace
    if (!repository) {
      console.log("[BlameIconState] No repository found, hiding icons");
      await setVscodeContext("svnBlameActiveForFile", false);
      await setVscodeContext("svnBlameUntrackedFile", false);
      return;
    }

    const resource = repository.getResourceFromFile(editor.document.uri);

    // Resource not loaded yet - repository still indexing OR file not tracked
    if (!resource) {
      console.log("[BlameIconState] Resource not found (clean file):", {
        file: editor.document.uri.fsPath,
        repoPath: repository.root,
        resourceCount: repository.getResourceMap()?.size || 0
      });

      // No resource = clean file (not in change index)
      // Check state manager for actual blame state
      const isEnabled = blameStateManager.isBlameEnabled(editor.document.uri);
      console.log("[BlameIconState] Clean file, blame enabled:", isEnabled);
      await setVscodeContext("svnBlameActiveForFile", isEnabled);
      await setVscodeContext("svnBlameUntrackedFile", false);
      return;
    }

    // Check if file is untracked
    const { Status } = await import("../common/types");
    const isUntracked = resource.type === Status.UNVERSIONED ||
                        resource.type === Status.IGNORED ||
                        resource.type === Status.NONE;

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
