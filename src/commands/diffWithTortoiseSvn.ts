import { SourceControlResourceState, Uri, window } from "vscode";
import { Resource } from "../resource";
import { Command } from "./command";
import { spawn } from "child_process";
import { existsSync } from "fs";
import { logError } from "../util/errorLogger";

/**
 * Command to open file diff in TortoiseSVN's configured diff editor
 * Useful for large tabular files (CSV) where built-in diff is inadequate
 */
export class DiffWithTortoiseSvn extends Command {
  constructor() {
    super("svn.diffWithTortoiseSvn");
  }

  public async execute(
    arg?: Resource | Uri,
    ...resourceStates: SourceControlResourceState[]
  ) {
    let filePath: string | undefined;

    // Extract file path from Resource or Uri
    if (arg instanceof Resource) {
      filePath = arg.resourceUri.fsPath;
    } else if (arg instanceof Uri) {
      filePath = arg.fsPath;
    }

    // If no file provided, try to get from resource states
    if (!filePath && resourceStates.length > 0) {
      filePath = resourceStates[0].resourceUri.fsPath;
    }

    if (!filePath) {
      window.showErrorMessage("No file selected for diff");
      return;
    }

    // Find TortoiseProc.exe
    const tortoiseProcPath = this.findTortoiseProc();
    if (!tortoiseProcPath) {
      window.showErrorMessage(
        "TortoiseProc.exe not found. Please ensure TortoiseSVN is installed."
      );
      return;
    }

    try {
      // Launch TortoiseSVN diff with the file
      // TortoiseProc will use the configured external diff tool (e.g., BeyondCompare)
      // from TortoiseSVN Settings -> Diff Viewer -> External
      // Simple diff command compares working copy against BASE automatically

      // Debug: Show command being executed
      console.log(`Launching TortoiseSVN: "${tortoiseProcPath}" /command:diff "/path:${filePath}"`);

      const child = spawn(
        tortoiseProcPath,
        ["/command:diff", `"/path:${filePath}"`],
        {
          detached: true,
          stdio: ["ignore", "pipe", "pipe"]
        }
      );

      // Log stdout
      child.stdout?.on("data", (data) => {
        console.log("TortoiseSVN stdout:", data.toString());
      });

      // Log any errors from stderr
      child.stderr?.on("data", (data) => {
        const errorMsg = data.toString();
        console.error("TortoiseSVN stderr:", errorMsg);
        logError("TortoiseSVN stderr", new Error(errorMsg));
      });

      child.on("error", (error) => {
        console.error("TortoiseSVN spawn error:", error);
        logError("Failed to spawn TortoiseSVN", error);
        window.showErrorMessage(
          `Failed to launch TortoiseSVN: ${error.message}`
        );
      });

      child.on("exit", (code, signal) => {
        console.log(`TortoiseSVN exited with code ${code}, signal ${signal}`);
      });

      // Detach the process so it runs independently
      child.unref();
    } catch (error) {
      logError("Failed to launch TortoiseSVN diff", error);
      window.showErrorMessage(
        `Failed to launch TortoiseSVN diff: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Locate TortoiseProc.exe in common installation paths
   */
  private findTortoiseProc(): string | undefined {
    const commonPaths = [
      "C:\\Program Files\\TortoiseSVN\\bin\\TortoiseProc.exe",
      "C:\\Program Files (x86)\\TortoiseSVN\\bin\\TortoiseProc.exe"
    ];

    for (const path of commonPaths) {
      if (existsSync(path)) {
        return path;
      }
    }

    return undefined;
  }
}
