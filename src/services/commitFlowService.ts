// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import {
  InputBoxValidationSeverity,
  QuickPickItem,
  QuickPickItemKind,
  window
} from "vscode";
import { Repository } from "../repository";
import {
  ConventionalCommitService,
  ConventionalCommit
} from "./conventionalCommitService";
import { PreCommitUpdateService } from "./preCommitUpdateService";

/**
 * Result of the commit flow
 */
export interface CommitFlowResult {
  message?: string;
  selectedFiles?: string[];
  cancelled: boolean;
}

/**
 * Options for commit flow
 */
export interface CommitFlowOptions {
  updateBeforeCommit?: boolean;
  conventionalCommits?: boolean;
}

interface TypePickItem extends QuickPickItem {
  type?: string;
  isPreviousMessage?: boolean;
  message?: string;
}

interface ConfirmPickItem extends QuickPickItem {
  action?: "commit" | "edit";
}

interface FilePickItem extends QuickPickItem {
  filePath: string;
}

/**
 * Service orchestrating the multi-step commit QuickPick flow.
 * Implements VS Code UX guidelines for multi-step Quick Picks.
 */
export class CommitFlowService {
  private conventionalService: ConventionalCommitService;
  private updateService: PreCommitUpdateService;

  constructor(conventionalService?: ConventionalCommitService) {
    this.conventionalService =
      conventionalService || new ConventionalCommitService();
    this.updateService = new PreCommitUpdateService();
  }

  /**
   * Run the complete commit flow
   */
  async runCommitFlow(
    repository: Repository,
    filePaths: string[],
    options: CommitFlowOptions = {}
  ): Promise<CommitFlowResult> {
    const { updateBeforeCommit = false, conventionalCommits = true } = options;

    // Step 0: File selection with checkboxes
    const selectedFiles = await this.showFileSelectionStep(filePaths);
    if (!selectedFiles || selectedFiles.length === 0) {
      return { cancelled: true };
    }

    // Run pre-commit update if enabled
    if (updateBeforeCommit) {
      const updateResult = await this.updateService.runUpdate(repository);

      if (updateResult.cancelled) {
        return { cancelled: true };
      }

      if (updateResult.hasConflicts) {
        const choice = await this.updateService.promptConflictResolution();
        if (choice === "abort") {
          return { cancelled: true };
        }
      }

      if (!updateResult.success && !updateResult.hasConflicts) {
        window.showErrorMessage(`Update failed: ${updateResult.error}`);
        return { cancelled: true };
      }
    }

    // Build commit message
    let message: string | undefined;

    if (conventionalCommits) {
      message = await this.runConventionalFlow(repository, selectedFiles);
    } else {
      message = await this.runSimpleFlow(repository);
    }

    if (message === undefined) {
      return { cancelled: true };
    }

    return { message, selectedFiles, cancelled: false };
  }

  /**
   * Run conventional commit flow with type selection
   */
  private async runConventionalFlow(
    repository: Repository,
    filePaths: string[]
  ): Promise<string | undefined> {
    // Step 1: Select commit type
    const typeResult = await this.showTypeStep(repository);
    if (!typeResult) {
      return undefined;
    }

    // Handle previous message selection
    if (typeResult.isPreviousMessage && typeResult.message) {
      return typeResult.message;
    }

    // Handle custom message
    if (typeResult.type === "custom") {
      return this.showCustomMessageStep(repository);
    }

    // Step 2: Enter scope (optional)
    const scope = await this.showScopeStep(repository, typeResult.type!);
    if (scope === undefined) {
      return undefined; // Cancelled
    }

    // Step 3: Enter description (pre-populate with SCM input box value)
    const existingMessage = repository.inputBox.value;
    let description: string | undefined;
    let confirmed = false;

    while (!confirmed) {
      description = await this.showDescriptionStep(
        typeResult.type!,
        scope,
        existingMessage
      );
      if (description === undefined) {
        return undefined;
      }

      // Build message
      const commit: ConventionalCommit = {
        type: typeResult.type!,
        scope: scope || undefined,
        description
      };
      const message = this.conventionalService.format(commit);

      // Step 4: Confirm
      const confirmResult = await this.showConfirmStep(message, filePaths);
      if (confirmResult === undefined) {
        return undefined;
      }

      if (confirmResult === "commit") {
        confirmed = true;
        return message;
      }
      // confirmResult === "edit" -> loop again
    }

    return undefined;
  }

  /**
   * Show commit type selection (Step 1)
   */
  private async showTypeStep(
    repository: Repository
  ): Promise<TypePickItem | undefined> {
    const types = this.conventionalService.getCommitTypes();
    const items: TypePickItem[] = [];

    // Add previous message if available
    const prevMessage = repository.inputBox.value;
    if (prevMessage && prevMessage.trim()) {
      items.push({
        label: "$(history) Use previous message",
        description: this.truncate(prevMessage, 40),
        isPreviousMessage: true,
        message: prevMessage
      });
      items.push({
        label: "",
        kind: QuickPickItemKind.Separator
      });
    }

    // Add commit types
    for (const t of types) {
      items.push({
        label: `${t.icon} ${t.label}`,
        description: t.description,
        type: t.type
      });
    }

    const selected = await window.showQuickPick(items, {
      title: "Commit (1/3): Select type",
      placeHolder: "Choose commit type"
    });

    return selected;
  }

  /**
   * Show scope input (Step 2)
   * Shows the message prefix being built (e.g., "feat: _")
   */
  private async showScopeStep(
    repository: Repository,
    type: string
  ): Promise<string | undefined> {
    // Get recent scopes from repository if available
    const recentScopes = this.getRecentScopes(repository);
    const placeholder =
      recentScopes.length > 0
        ? `Optional scope (recent: ${recentScopes.join(", ")})`
        : "Optional scope (e.g., ui, api, core)";

    const scope = await window.showInputBox({
      title: `Commit (2/3): ${type}(_): ...`,
      prompt: placeholder,
      placeHolder: "Leave empty to skip"
    });

    // undefined means cancelled, empty string means skipped
    return scope;
  }

  /**
   * Show description input (Step 3)
   * Shows real-time character count as user types
   * Pre-populates with SCM input box value if available
   */
  private async showDescriptionStep(
    type: string,
    scope: string,
    existingMessage?: string
  ): Promise<string | undefined> {
    const prefix = scope ? `${type}(${scope}): ` : `${type}: `;
    const maxTotal = this.conventionalService.getMaxLength();

    // Try to extract description from existing message
    let initialValue = "";
    if (existingMessage) {
      // If message starts with prefix, extract description
      if (existingMessage.startsWith(prefix)) {
        initialValue = existingMessage.slice(prefix.length);
      } else {
        // Otherwise use the whole message (user can edit)
        initialValue = existingMessage;
      }
    }

    const description = await window.showInputBox({
      title: `Commit (3/3): ${prefix}_`,
      prompt: "Use imperative mood: add, fix, update, remove...",
      placeHolder: "If applied, this commit will...",
      value: initialValue,
      validateInput: value => {
        if (!value || value.trim() === "") {
          return {
            message: "Description required",
            severity: InputBoxValidationSeverity.Error
          };
        }
        const totalLen = prefix.length + value.length;
        const remaining = maxTotal - totalLen;

        if (remaining < 0) {
          return {
            message: `${totalLen}/${maxTotal} (${remaining}) - exceeds 50 char recommendation`,
            severity: InputBoxValidationSeverity.Warning
          };
        }
        // Show real-time character count as info
        return {
          message: `${totalLen}/${maxTotal}`,
          severity: InputBoxValidationSeverity.Info
        };
      }
    });

    return description;
  }

  /**
   * Show confirmation step with file list
   */
  private async showConfirmStep(
    message: string,
    filePaths: string[]
  ): Promise<"commit" | "edit" | undefined> {
    const items: ConfirmPickItem[] = [
      {
        label: `$(check) Commit ${filePaths.length} file(s)`,
        description: message,
        action: "commit"
      },
      {
        label: "$(edit) Edit message",
        description: "Go back and change description",
        action: "edit"
      },
      {
        label: "",
        kind: QuickPickItemKind.Separator
      }
    ];

    // Add file list preview (max 5)
    const previewFiles = filePaths.slice(0, 5);
    for (const file of previewFiles) {
      items.push({
        label: `  $(file) ${this.getFileName(file)}`,
        description: this.getRelativePath(file)
      });
    }

    if (filePaths.length > 5) {
      items.push({
        label: `  ... and ${filePaths.length - 5} more`
      });
    }

    const selected = await window.showQuickPick(items, {
      title: "Confirm commit",
      placeHolder: message
    });

    if (!selected) {
      return undefined;
    }

    return selected.action;
  }

  /**
   * Show file selection step with checkboxes (Step 0)
   * All files selected by default, user can deselect
   */
  private async showFileSelectionStep(
    filePaths: string[]
  ): Promise<string[] | undefined> {
    if (filePaths.length === 0) {
      return [];
    }

    // Skip picker if only one file
    if (filePaths.length === 1) {
      return filePaths;
    }

    const items: FilePickItem[] = filePaths.map(filePath => ({
      label: `$(file) ${this.getFileName(filePath)}`,
      description: this.getRelativePath(filePath),
      filePath,
      picked: true // All selected by default
    }));

    const selected = await window.showQuickPick(items, {
      title: `Select files to commit (${filePaths.length} changed)`,
      placeHolder: "Check/uncheck files to include in commit",
      canPickMany: true
    });

    if (!selected) {
      return undefined; // Cancelled
    }

    if (selected.length === 0) {
      return undefined; // No files selected
    }

    return selected.map(item => item.filePath);
  }

  /**
   * Show custom message input (skip conventional format)
   * Shows real-time character count
   */
  private async showCustomMessageStep(
    repository: Repository
  ): Promise<string | undefined> {
    const maxLen = this.conventionalService.getMaxLength();

    return window.showInputBox({
      title: "Commit: Enter message",
      prompt: "Enter your commit message",
      value: repository.inputBox.value,
      placeHolder: "Your commit message",
      validateInput: value => {
        if (!value || value.trim() === "") {
          return {
            message: "Message required",
            severity: InputBoxValidationSeverity.Error
          };
        }
        const remaining = maxLen - value.length;
        if (remaining < 0) {
          return {
            message: `${value.length}/${maxLen} (${remaining}) - exceeds 50 char recommendation`,
            severity: InputBoxValidationSeverity.Warning
          };
        }
        // Show real-time character count as info
        return {
          message: `${value.length}/${maxLen}`,
          severity: InputBoxValidationSeverity.Info
        };
      }
    });
  }

  /**
   * Simple flow without conventional commits
   */
  private async runSimpleFlow(
    repository: Repository
  ): Promise<string | undefined> {
    return this.showCustomMessageStep(repository);
  }

  /**
   * Get recent scopes from repository (auto-detect from directory names)
   */
  private getRecentScopes(repository: Repository): string[] {
    // If repository has getRecentScopes method, use it
    const repoWithScopes = repository as Repository & {
      getRecentScopes?: () => string[];
    };
    if (typeof repoWithScopes.getRecentScopes === "function") {
      return repoWithScopes.getRecentScopes();
    }
    return [];
  }

  /**
   * Truncate string with ellipsis
   */
  private truncate(str: string, maxLen: number): string {
    if (str.length <= maxLen) {
      return str;
    }
    return str.slice(0, maxLen - 3) + "...";
  }

  /**
   * Get file name from path
   */
  private getFileName(filePath: string): string {
    const parts = filePath.replace(/\\/g, "/").split("/");
    return parts[parts.length - 1] || filePath;
  }

  /**
   * Get relative path (simplified)
   */
  private getRelativePath(filePath: string): string {
    const parts = filePath.replace(/\\/g, "/").split("/");
    if (parts.length <= 2) {
      return "";
    }
    return parts.slice(0, -1).join("/");
  }
}
