"use strict";

import {
  Disposable,
  env,
  StatusBarAlignment,
  StatusBarItem,
  TextEditor,
  TextEditorSelectionChangeEvent,
  Uri,
  window,
  workspace
} from "vscode";
import { debounce } from "../decorators";
import { ISvnBlameLine } from "../common/types";
import { SourceControlManager } from "../source_control_manager";
import { blameConfiguration } from "./blameConfiguration";
import { blameStateManager } from "./blameStateManager";
import { logError } from "../util/errorLogger";

/**
 * BlameStatusBar manages the status bar item showing blame info for current line
 * Singleton instance (unlike BlameProvider which is per-repo)
 */
export class BlameStatusBar implements Disposable {
  private statusBarItem: StatusBarItem;
  private blameCache = new Map<string, { data: ISvnBlameLine[]; timestamp: number }>();
  private disposables: Disposable[] = [];
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(private sourceControlManager: SourceControlManager) {
    // Create status bar item (right-aligned, priority 100)
    this.statusBarItem = window.createStatusBarItem(
      "svn.blame.statusBar",
      StatusBarAlignment.Right,
      100
    );

    // Command for click action
    this.statusBarItem.command = "svn.showBlameCommit";

    // Register event listeners
    this.registerListeners();
  }

  /**
   * Register event listeners
   */
  private registerListeners(): void {
    this.disposables.push(
      // Cursor position changes (debounced)
      window.onDidChangeTextEditorSelection(e => this.onSelectionChanged(e)),

      // Active editor changes
      window.onDidChangeActiveTextEditor(e => this.onActiveEditorChanged(e)),

      // Document changes (invalidate cache)
      workspace.onDidChangeTextDocument(e => {
        this.blameCache.delete(e.document.uri.toString());
      }),

      // Document save (invalidate cache)
      workspace.onDidSaveTextDocument(d => {
        this.blameCache.delete(d.uri.toString());
      }),

      // Configuration changes
      blameConfiguration.onDidChange(() => this.onConfigurationChanged()),

      // Blame state changes
      blameStateManager.onDidChangeState(() => this.onBlameStateChanged())
    );

    // Initial update
    if (window.activeTextEditor) {
      this.onActiveEditorChanged(window.activeTextEditor);
    }
  }

  /**
   * Update status bar for current line (debounced 150ms)
   */
  @debounce(150)
  public async updateStatusBar(): Promise<void> {
    const editor = window.activeTextEditor;

    // Hide if no editor
    if (!editor) {
      this.statusBarItem.hide();
      return;
    }

    // Check if should show
    if (!this.shouldShowStatusBar(editor.document.uri)) {
      this.statusBarItem.hide();
      return;
    }

    // Get current line number (1-indexed)
    const lineNumber = editor.selection.active.line + 1;

    // Fetch blame data for file (cached)
    const blameData = await this.getBlameData(editor.document.uri);
    if (!blameData) {
      this.showUncommittedStatus();
      return;
    }

    // Find blame info for current line
    const blameLine = blameData.find(b => b.lineNumber === lineNumber);

    if (blameLine && blameLine.revision) {
      // Show blame info
      this.statusBarItem.text = this.formatStatusBarText(blameLine);
      this.statusBarItem.tooltip = this.formatTooltip(blameLine);
      this.statusBarItem.show();
    } else {
      // Uncommitted line
      this.showUncommittedStatus();
    }
  }

  /**
   * Show commit details QuickPick (called on status bar click)
   */
  public async showCommitDetails(): Promise<void> {
    const editor = window.activeTextEditor;
    if (!editor) {
      return;
    }

    const lineNumber = editor.selection.active.line + 1;
    const blameData = await this.getBlameData(editor.document.uri);
    if (!blameData) {
      return;
    }

    const blameLine = blameData.find(b => b.lineNumber === lineNumber);
    if (!blameLine || !blameLine.revision) {
      window.showInformationMessage("No blame information for this line");
      return;
    }

    // Show QuickPick with actions
    const items = [
      {
        label: "$(file-code) Show Commit",
        description: `r${blameLine.revision}`,
        action: "show"
      },
      {
        label: "$(clippy) Copy Revision",
        description: `r${blameLine.revision}`,
        action: "copy"
      },
      {
        label: "$(git-compare) Toggle Blame",
        description: "Show/hide blame decorations",
        action: "toggle"
      }
    ];

    const selected = await window.showQuickPick(items, {
      placeHolder: `Commit r${blameLine.revision} by ${blameLine.author}`
    });

    if (selected) {
      await this.executeAction(selected.action, blameLine, editor.document.uri);
    }
  }

  /**
   * Dispose status bar
   */
  public dispose(): void {
    this.statusBarItem.dispose();
    this.blameCache.clear();
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }

  // ===== Event Handlers =====

  @debounce(150)
  private async onSelectionChanged(_event: TextEditorSelectionChangeEvent): Promise<void> {
    await this.updateStatusBar();
  }

  private async onActiveEditorChanged(_editor: TextEditor | undefined): Promise<void> {
    await this.updateStatusBar();
  }

  private async onConfigurationChanged(): Promise<void> {
    await this.updateStatusBar();
  }

  private async onBlameStateChanged(): Promise<void> {
    await this.updateStatusBar();
  }

  // ===== Helper Methods =====

  /**
   * Check if should show status bar for URI
   */
  private shouldShowStatusBar(uri: Uri): boolean {
    // Must be file scheme
    if (uri.scheme !== "file") {
      return false;
    }

    // Check configuration
    if (!blameConfiguration.isEnabled() || !blameConfiguration.isStatusBarEnabled()) {
      return false;
    }

    // Check state manager
    if (!blameStateManager.shouldShowBlame(uri)) {
      return false;
    }

    return true;
  }

  /**
   * Get blame data for URI (with caching)
   */
  private async getBlameData(uri: Uri): Promise<ISvnBlameLine[] | undefined> {
    const key = uri.toString();

    // Check cache
    const cached = this.blameCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.data;
    }

    // Find repository for this file
    const repository = this.sourceControlManager.getRepository(uri);
    if (!repository) {
      return undefined;
    }

    // Skip untracked files (prevents SVN errors for UNVERSIONED/IGNORED files)
    const resource = repository.getResourceFromFile(uri);
    if (resource) {
      const { Status } = await import("../common/types");
      if (resource.type === Status.UNVERSIONED ||
          resource.type === Status.IGNORED ||
          resource.type === Status.NONE) {
        return undefined;
      }
    }

    // Fetch from repository
    try {
      const data = await repository.blame(uri.fsPath);

      // Cache with timestamp
      this.blameCache.set(key, { data, timestamp: Date.now() });

      return data;
    } catch (err) {
      logError("BlameStatusBar: Failed to fetch blame data", err);
      return undefined;
    }
  }

  /**
   * Format status bar text using template
   */
  private formatStatusBarText(line: ISvnBlameLine): string {
    const template = blameConfiguration.getStatusBarTemplate();
    const dateFormat = blameConfiguration.getDateFormat();

    const revision = line.revision || "???";
    const author = line.author || "unknown";
    const date = this.formatDate(line.date, dateFormat);
    const message = ""; // Message fetching deferred to Phase 3 (hover)

    return template
      .replace(/\$\{revision\}/g, revision)
      .replace(/\$\{author\}/g, author)
      .replace(/\$\{date\}/g, date)
      .replace(/\$\{message\}/g, message)
      .replace(/\s+-\s+$/g, "") // Remove trailing " - " if message empty
      .trim();
  }

  /**
   * Format tooltip content
   */
  private formatTooltip(line: ISvnBlameLine): string {
    const parts = [
      `Revision: r${line.revision}`,
      `Author: ${line.author}`,
      `Date: ${new Date(line.date!).toLocaleString()}`
    ];

    // Add merge info if present
    if (line.merged) {
      parts.push("", `Merged from: r${line.merged.revision} (${line.merged.author})`);
    }

    parts.push("", "Click for actions");

    return parts.join("\n");
  }

  /**
   * Format date (relative or absolute)
   */
  private formatDate(dateStr: string | undefined, format: "relative" | "absolute"): string {
    if (!dateStr) {
      return "unknown";
    }

    try {
      const date = new Date(dateStr);

      if (format === "relative") {
        return this.getRelativeTime(date);
      } else {
        return date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined
        });
      }
    } catch {
      return dateStr; // Fallback to raw string
    }
  }

  /**
   * Get relative time string (e.g., "2 days ago")
   */
  private getRelativeTime(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d ago`;
    if (seconds < 31536000) return `${Math.floor(seconds / 2592000)}mo ago`;
    return `${Math.floor(seconds / 31536000)}y ago`;
  }

  /**
   * Show uncommitted status
   */
  private showUncommittedStatus(): void {
    this.statusBarItem.text = "$(edit) Not committed";
    this.statusBarItem.tooltip = "Line not yet committed to SVN";
    this.statusBarItem.show();
  }

  /**
   * Execute QuickPick action
   */
  private async executeAction(
    action: string,
    blameLine: ISvnBlameLine,
    uri: Uri
  ): Promise<void> {
    switch (action) {
      case "show":
        // Show commit details - delegate to log command
        window.showInformationMessage(
          `Commit r${blameLine.revision} by ${blameLine.author} on ${blameLine.date}`
        );
        break;

      case "copy":
        // Copy revision to clipboard
        await env.clipboard.writeText(blameLine.revision!);
        window.showInformationMessage(`Copied r${blameLine.revision} to clipboard`);
        break;

      case "toggle":
        // Toggle blame for this file
        blameStateManager.toggleBlame(uri);
        break;
    }
  }
}
