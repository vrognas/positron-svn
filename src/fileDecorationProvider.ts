import {
  Disposable,
  EventEmitter,
  FileDecoration,
  FileDecorationProvider,
  ThemeColor,
  Uri
} from "vscode";
import { Status } from "./common/types";
import { Repository } from "./repository";

/**
 * Provides file decorations (badges and colors) for SVN-tracked files in Explorer view
 */
export class SvnFileDecorationProvider
  implements FileDecorationProvider, Disposable
{
  private _onDidChangeFileDecorations = new EventEmitter<Uri | Uri[]>();
  readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;
  private disposables: Disposable[] = [];

  constructor(private repository: Repository) {
    this.disposables.push(this._onDidChangeFileDecorations);
  }

  dispose(): void {
    this.disposables.forEach(d => d.dispose());
  }

  /**
   * Provide decoration for a file URI
   */
  provideFileDecoration(uri: Uri): FileDecoration | undefined {
    // Check if this is a historical file from repository log (has action query param)
    const queryParams = new URLSearchParams(uri.query);
    const action = queryParams.get('action');

    if (action) {
      // Historical file from repository log - use action directly
      const status = this.actionToStatus(action);
      if (!status) {
        return undefined;
      }

      const badge = this.getBadge(status, undefined);
      const color = this.getColor(status);
      const tooltip = this.getTooltip(status, undefined);

      if (!badge && !color) {
        return undefined;
      }

      return {
        badge,
        tooltip,
        color,
        propagate: true
      };
    }

    // Look up file status from repository (current working copy)
    const resource = this.repository.getResourceFromFile(uri.fsPath);

    if (!resource) {
      return undefined;
    }

    const status = resource.type;

    // Don't decorate external files
    if (status === Status.EXTERNAL) {
      return undefined;
    }

    const badge = this.getBadge(status, resource.renameResourceUri);
    const color = this.getColor(status);
    const tooltip = this.getTooltip(status, resource.renameResourceUri);

    if (!badge && !color) {
      return undefined;
    }

    return {
      badge,
      tooltip,
      color,
      propagate: true // Show on parent folders like Git
    };
  }

  /**
   * Refresh decorations for changed files
   */
  refresh(uris?: Uri | Uri[]): void {
    // Fire event with uris if provided, otherwise fire with empty array to refresh all
    this._onDidChangeFileDecorations.fire(uris || []);
  }

  /**
   * Convert repository log action to Status constant
   */
  private actionToStatus(action: string): string | undefined {
    switch (action) {
      case 'A':
        return Status.ADDED;
      case 'M':
        return Status.MODIFIED;
      case 'D':
        return Status.DELETED;
      case 'R':
        return Status.REPLACED;
      default:
        return undefined;
    }
  }

  private getBadge(status: string, renameUri?: Uri): string | undefined {
    // Renamed files (added with rename source) get R badge
    if (status === Status.ADDED && renameUri) {
      return "R";
    }

    switch (status) {
      case Status.ADDED:
        return "A";
      case Status.CONFLICTED:
        return "C";
      case Status.DELETED:
        return "D";
      case Status.MODIFIED:
        return "M";
      case Status.REPLACED:
        return "R";
      case Status.UNVERSIONED:
        return "U";
      case Status.MISSING:
        return "!";
      case Status.IGNORED:
        return "I";
      default:
        return undefined;
    }
  }

  private getColor(status: string): ThemeColor | undefined {
    switch (status) {
      case Status.MODIFIED:
      case Status.REPLACED:
        return new ThemeColor("gitDecoration.modifiedResourceForeground");
      case Status.DELETED:
      case Status.MISSING:
        return new ThemeColor("gitDecoration.deletedResourceForeground");
      case Status.ADDED:
      case Status.UNVERSIONED:
        return new ThemeColor("gitDecoration.untrackedResourceForeground");
      case Status.IGNORED:
        return new ThemeColor("gitDecoration.ignoredResourceForeground");
      case Status.CONFLICTED:
        return new ThemeColor("gitDecoration.conflictingResourceForeground");
      default:
        return undefined;
    }
  }

  private getTooltip(status: string, renameUri?: Uri): string | undefined {
    if (status === Status.ADDED && renameUri) {
      return `Renamed from ${renameUri.fsPath}`;
    }

    switch (status) {
      case Status.ADDED:
        return "Added";
      case Status.CONFLICTED:
        return "Conflicted";
      case Status.DELETED:
        return "Deleted";
      case Status.MODIFIED:
        return "Modified";
      case Status.REPLACED:
        return "Replaced";
      case Status.UNVERSIONED:
        return "Unversioned";
      case Status.MISSING:
        return "Missing";
      case Status.IGNORED:
        return "Ignored";
      default:
        return undefined;
    }
  }
}
