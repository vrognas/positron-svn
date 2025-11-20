import { commands, SourceControlResourceState, Uri, window } from "vscode";
import { Resource } from "../resource";
import { Command } from "./command";
import { SourceControlManager } from "../source_control_manager";
import { diffWithExternalTool } from "../util/fileOperations";

/**
 * Command to open file diff with external diff tool using SVN's --diff-cmd
 * Reads svn.diff.tool from settings (path to bcsvn.bat or similar wrapper)
 * Useful for large tabular files (CSV) where built-in diff is inadequate
 */
export class DiffWithExternalTool extends Command {
  constructor() {
    super("svn.diffWithExternalTool");
  }

  public async execute(
    arg?: Resource | Uri,
    ...resourceStates: SourceControlResourceState[]
  ) {
    console.log("DiffWithExternalTool command called", { arg, resourceStates });

    let filePath: string | undefined;

    // Extract file path from Resource or Uri
    if (arg instanceof Resource) {
      filePath = arg.resourceUri.fsPath;
      console.log("Got file path from Resource:", filePath);
    } else if (arg instanceof Uri) {
      filePath = arg.fsPath;
      console.log("Got file path from Uri:", filePath);
    }

    // If no file provided, try to get from resource states
    if (!filePath && resourceStates.length > 0) {
      filePath = resourceStates[0].resourceUri.fsPath;
      console.log("Got file path from resourceStates:", filePath);
    }

    if (!filePath) {
      window.showErrorMessage("No file selected for diff");
      return;
    }

    try {
      console.log("Getting repository for:", filePath);

      // Get SourceControlManager (use cached static or fetch via command)
      const sourceControlManager = (Command as any)._sourceControlManager || (await commands.executeCommand(
        "svn.getSourceControlManager",
        ""
      )) as SourceControlManager;

      console.log("Got SourceControlManager:", !!sourceControlManager);

      // Get repository for the file path
      const repository = sourceControlManager.getRepository(Uri.file(filePath));
      console.log("getRepository returned:", repository ? "found" : "null/undefined");

      if (!repository) {
        console.log("ERROR: Repository not found");
        window.showErrorMessage("File is not in an SVN repository");
        return;
      }
      console.log("Repository found ✓", repository.workspaceRoot);

      // Use shared utility for diff
      await diffWithExternalTool(
        repository.workspaceRoot,
        filePath,
        sourceControlManager.svn.exec.bind(sourceControlManager.svn)
      );

    } catch (error) {
      // Security: Use logError helper to sanitize error output
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[diffWithExternalTool] Failed to launch external diff: ${message}`);
      window.showErrorMessage(`Failed to launch external diff: ${message}`);
    }
  }
}
