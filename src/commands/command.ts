import * as path from "path";
import {
  commands,
  Disposable,
  Position,
  Range,
  SourceControlResourceState,
  TextDocumentShowOptions,
  TextEditor,
  Uri,
  ViewColumn,
  window,
  workspace,
  WorkspaceEdit
} from "vscode";
import {
  ICommandOptions,
  Status,
  SvnUriAction,
  LineChange
} from "../common/types";
import { exists, readFile, stat, unlink } from "../fs";
import { configuration } from "../helpers/configuration";
import { inputIgnoreList } from "../ignoreitems";
import { applyLineChanges } from "../lineChanges";
import { SourceControlManager } from "../source_control_manager";
import { Repository } from "../repository";
import { Resource } from "../resource";
import IncomingChangeNode from "../treeView/nodes/incomingChangeNode";
import { fromSvnUri, toSvnUri } from "../uri";
import { getSvnDir } from "../util";
import { logError } from "../util/errorLogger";

/**
 * Type-safe command argument patterns used across all commands.
 * Commands can accept various combinations of these argument types.
 */
export type CommandArgs =
  // Repository commands (e.g., refresh, update)
  | [Repository]
  // Resource state commands (e.g., commit, revert)
  | SourceControlResourceState[]
  // URI-based commands
  | [Uri]
  | [Uri, LineChange[], number] // revertChange
  // Resource/URI with optional states
  | [Resource | Uri | undefined, ...SourceControlResourceState[]]
  // IncomingChangeNode commands
  | [IncomingChangeNode, ...unknown[]]
  // Other variadic patterns
  | unknown[];

/**
 * Return type for command execution. Most commands return void or Promise<void>,
 * but some may return specific values.
 */
export type CommandResult = void | Promise<void> | Promise<unknown>;

export abstract class Command implements Disposable {
  // Phase 10.2 perf fix - cache SourceControlManager to avoid IPC overhead
  private static _sourceControlManager?: SourceControlManager;
  
  static setSourceControlManager(scm: SourceControlManager) {
    Command._sourceControlManager = scm;
  }

  private _disposable?: Disposable;

  constructor(commandName: string, options: ICommandOptions = {}) {
    if (options.repository) {
      const command = this.createRepositoryCommand(this.execute);

      this._disposable = commands.registerCommand(commandName, command);

      return;
    }

    this._disposable = commands.registerCommand(
      commandName,
      (...args: unknown[]) => this.execute(...args)
    );
  }

  public abstract execute(...args: unknown[]): CommandResult;

  public dispose() {
    this._disposable?.dispose();
  }

  private createRepositoryCommand(
    method: (...args: unknown[]) => CommandResult
  ): (...args: unknown[]) => Promise<unknown> {
    const result = async (...args: unknown[]) => {
      const sourceControlManager = Command._sourceControlManager || (await commands.executeCommand(
        "svn.getSourceControlManager",
        ""
      )) as SourceControlManager;
      const repository = sourceControlManager.getRepository(args[0]);
      let repositoryPromise;

      if (repository) {
        repositoryPromise = Promise.resolve(repository);
      } else if (sourceControlManager.repositories.length === 1) {
        repositoryPromise = Promise.resolve(
          sourceControlManager.repositories[0]
        );
      } else {
        repositoryPromise = sourceControlManager.pickRepository();
      }

      const result = repositoryPromise.then(repository => {
        if (!repository) {
          return Promise.resolve();
        }

        return Promise.resolve(method.apply(this, [repository, ...args]));
      });

      return result.catch(err => {
        logError("Command execution failed", err);
      });
    };

    return result;
  }

  protected async getResourceStates(
    resourceStates: SourceControlResourceState[]
  ): Promise<Resource[]> {
    if (
      resourceStates.length === 0 ||
      !(resourceStates[0].resourceUri instanceof Uri)
    ) {
      const resource = await this.getSCMResource();

      if (!resource) {
        return [];
      }

      resourceStates = [resource];
    }

    return resourceStates.filter(s => s instanceof Resource) as Resource[];
  }

  /**
   * Get resource states or return null if empty (Phase 13.2).
   * Replaces pattern: `if (selection.length === 0) return;`
   */
  protected async getResourceStatesOrExit(
    resourceStates: SourceControlResourceState[]
  ): Promise<Resource[] | null> {
    const selection = await this.getResourceStates(resourceStates);
    return selection.length === 0 ? null : selection;
  }

  protected runByRepository<T>(
    resource: Uri,
    fn: (repository: Repository, resource: Uri) => Promise<T>
  ): Promise<T[]>;
  protected runByRepository<T>(
    resources: Uri[],
    fn: (repository: Repository, resources: Uri[]) => Promise<T>
  ): Promise<T[]>;
  protected async runByRepository<T>(
    arg: Uri | Uri[],
    fn:
      | ((repository: Repository, resource: Uri) => Promise<T>)
      | ((repository: Repository, resources: Uri[]) => Promise<T>)
  ): Promise<T[]> {
    const resources = arg instanceof Uri ? [arg] : arg;
    const isSingleResource = arg instanceof Uri;

    const sourceControlManager = Command._sourceControlManager || (await commands.executeCommand(
      "svn.getSourceControlManager",
      ""
    )) as SourceControlManager;

    const groups: Array<{ repository: Repository; resources: Uri[] }> = [];

    for (const resource of resources) {
      const repository = sourceControlManager.getRepository(resource);

      if (!repository) {
        console.warn("Could not find Svn repository for ", resource);
        continue;
      }

      const tuple = groups.filter(p => p.repository === repository)[0];

      if (tuple) {
        tuple.resources.push(resource);
      } else {
        groups.push({ repository, resources: [resource] });
      }
    }

    const promises = groups.map(({ repository, resources }) => {
      if (isSingleResource) {
        return (fn as (repository: Repository, resource: Uri) => Promise<T>)(
          repository as Repository,
          resources[0]
        );
      }
      return (fn as (repository: Repository, resources: Uri[]) => Promise<T>)(
        repository as Repository,
        resources
      );
    });

    return Promise.all(promises);
  }

  protected async getSCMResource(uri?: Uri): Promise<Resource | undefined> {
    uri = uri
      ? uri
      : window.activeTextEditor && window.activeTextEditor.document.uri;

    if (!uri) {
      return undefined;
    }

    if (uri.scheme === "svn") {
      const { fsPath } = fromSvnUri(uri);
      uri = Uri.file(fsPath);
    }

    if (uri.scheme === "file") {
      const sourceControlManager = Command._sourceControlManager || (await commands.executeCommand(
        "svn.getSourceControlManager",
        ""
      )) as SourceControlManager;
      const repository = sourceControlManager.getRepository(uri);

      if (!repository) {
        return undefined;
      }

      return repository.getResourceFromFile(uri);
    }

    return;
  }

  protected async _openResource(
    resource: Resource,
    against?: string,
    preview?: boolean,
    preserveFocus?: boolean,
    preserveSelection?: boolean
  ): Promise<void> {
    let left = await this.getLeftResource(resource, against);
    let right = this.getRightResource(resource, against);
    const title = this.getTitle(resource, against);

    if (resource.remote && left) {
      [left, right] = [right, left];
    }

    if (!right) {
      // TODO
      console.error("oh no");
      return;
    }

    if (
      (await exists(right.fsPath)) &&
      (await stat(right.fsPath)).isDirectory()
    ) {
      return;
    }

    const opts: TextDocumentShowOptions = {
      preserveFocus,
      preview,
      viewColumn: ViewColumn.Active
    };

    const activeTextEditor = window.activeTextEditor;

    if (
      preserveSelection &&
      activeTextEditor &&
      activeTextEditor.document.uri.toString() === right.toString()
    ) {
      opts.selection = activeTextEditor.selection;
    }

    if (!left) {
      return commands.executeCommand<void>("vscode.open", right, opts);
    }

    return commands.executeCommand<void>(
      "vscode.diff",
      left,
      right,
      title,
      opts
    );
  }

  protected async getLeftResource(
    resource: Resource,
    against: string = ""
  ): Promise<Uri | undefined> {
    if (resource.remote) {
      if (resource.type !== Status.DELETED) {
        return toSvnUri(resource.resourceUri, SvnUriAction.SHOW, {
          ref: against
        });
      }
      return;
    }

    if (resource.type === Status.ADDED && resource.renameResourceUri) {
      return toSvnUri(resource.renameResourceUri, SvnUriAction.SHOW, {
        ref: against
      });
    }

    // Show file if has conflicts marks
    if (
      resource.type === Status.CONFLICTED &&
      (await exists(resource.resourceUri.fsPath))
    ) {
      const text = (await readFile(resource.resourceUri.fsPath, {
        encoding: "utf8"
      })) as string;

      // Check for lines begin with "<<<<<<", "=======", ">>>>>>>"
      if (/^<{7}[^]+^={7}[^]+^>{7}/m.test(text)) {
        return undefined;
      }
    }

    switch (resource.type) {
      case Status.CONFLICTED:
      case Status.MODIFIED:
      case Status.REPLACED:
        return toSvnUri(resource.resourceUri, SvnUriAction.SHOW, {
          ref: against
        });
    }

    return;
  }

  protected getRightResource(
    resource: Resource,
    against: string = ""
  ): Uri | undefined {
    if (resource.remote) {
      if (resource.type !== Status.ADDED) {
        return resource.resourceUri;
      }
      return;
    }
    switch (resource.type) {
      case Status.ADDED:
      case Status.CONFLICTED:
      case Status.IGNORED:
      case Status.MODIFIED:
      case Status.UNVERSIONED:
      case Status.REPLACED:
        return resource.resourceUri;
      case Status.DELETED:
      case Status.MISSING:
        return toSvnUri(resource.resourceUri, SvnUriAction.SHOW, {
          ref: against
        });
    }

    return;
  }

  private getTitle(resource: Resource, against?: string): string {
    if (resource.type === Status.ADDED && resource.renameResourceUri) {
      const basename = path.basename(resource.renameResourceUri.fsPath);

      const newname = path.relative(
        path.dirname(resource.renameResourceUri.fsPath),
        resource.resourceUri.fsPath
      );
      if (against) {
        return `${basename} -> ${newname} (${against})`;
      }
      return `${basename} -> ${newname}`;
    }
    const basename = path.basename(resource.resourceUri.fsPath);

    if (against) {
      return `${basename} (${against})`;
    }

    return "";
  }

  protected async openChange(
    arg?: Resource | Uri | IncomingChangeNode,
    against?: string,
    resourceStates?: SourceControlResourceState[]
  ): Promise<void> {
    const preserveFocus = arg instanceof Resource;
    const preserveSelection = arg instanceof Uri || !arg;
    let resources: Resource[] | undefined;

    if (arg instanceof Uri) {
      const resource = await this.getSCMResource(arg);
      if (resource !== undefined) {
        resources = [resource];
      }
    } else if (arg instanceof IncomingChangeNode) {
      const resource = new Resource(
        arg.uri,
        arg.type,
        undefined,
        arg.props,
        true
      );

      resources = [resource];
    } else {
      let resource: Resource | undefined;

      if (arg instanceof Resource) {
        resource = arg;
      } else {
        resource = await this.getSCMResource();
      }

      if (resource) {
        resources = [...(resourceStates as Resource[]), resource];
      }
    }

    if (!resources) {
      return;
    }

    const preview = resources.length === 1 ? undefined : false;
    for (const resource of resources) {
      await this._openResource(
        resource,
        against,
        preview,
        preserveFocus,
        preserveSelection
      );
    }
  }

  protected async showDiffPath(repository: Repository, content: string) {
    try {
      const tempFile = path.join(
        repository.root,
        getSvnDir(),
        "tmp",
        "svn.patch"
      );

      if (await exists(tempFile)) {
        try {
          await unlink(tempFile);
        } catch (err) {
          // TODO(cjohnston)//log error
        }
      }

      const uri = Uri.file(tempFile).with({
        scheme: "untitled"
      });

      const document = await workspace.openTextDocument(uri);
      const textEditor = await window.showTextDocument(document);

      await textEditor.edit(e => {
        // if is opened, clear content
        e.delete(
          new Range(
            new Position(0, 0),
            new Position(Number.MAX_SAFE_INTEGER, 0)
          )
        );
        e.insert(new Position(0, 0), content);
      });
    } catch (error) {
      logError("Patch operation failed", error);
      window.showErrorMessage("Unable to patch");
    }
  }

  protected async _revertChanges(
    textEditor: TextEditor,
    changes: LineChange[]
  ): Promise<void> {
    const modifiedDocument = textEditor.document;
    const modifiedUri = modifiedDocument.uri;

    if (modifiedUri.scheme !== "file") {
      return;
    }

    const originalUri = toSvnUri(modifiedUri, SvnUriAction.SHOW, {
      ref: "BASE"
    });
    const originalDocument = await workspace.openTextDocument(originalUri);

    const result = applyLineChanges(
      originalDocument,
      modifiedDocument,
      changes
    );
    const edit = new WorkspaceEdit();
    edit.replace(
      modifiedUri,
      new Range(
        new Position(0, 0),
        modifiedDocument.lineAt(modifiedDocument.lineCount - 1).range.end
      ),
      result
    );
    workspace.applyEdit(edit);
    await modifiedDocument.save();
  }

  protected async addToIgnore(uris: Uri[]): Promise<void> {
    await this.runByRepository(uris, async (repository, resources) => {
      if (!repository) {
        return;
      }

      try {
        const ignored = await inputIgnoreList(repository, resources);

        if (ignored) {
          window.showInformationMessage(`File(s) is now being ignored`);
        }
      } catch (error) {
        logError("Property ignore operation failed", error);
        window.showErrorMessage("Unable to set property ignore");
      }
    });
  }

  /**
   * Execute operation on resource states grouped by repository.
   * Pattern: getResourceStates → map → runByRepository → error handling
   */
  protected async executeOnResources(
    resourceStates: SourceControlResourceState[],
    operation: (repository: Repository, paths: string[]) => Promise<void>,
    errorMsg: string
  ): Promise<void> {
    const selection = await this.getResourceStates(resourceStates);

    if (selection.length === 0) {
      return;
    }

    const uris = selection.map(resource => resource.resourceUri);

    await this.runByRepository(uris, async (repository, resources) => {
      if (!repository) {
        return;
      }

      const paths = resources.map(resource => resource.fsPath);

      try {
        await operation(repository, paths);
      } catch (error) {
        logError("Repository resource operation failed", error);
        window.showErrorMessage(errorMsg);
      }
    });
  }

  /**
   * Sanitize stderr to prevent information disclosure.
   * Strips file paths, credentials, and internal URLs.
   * WARNING: When debug.disableSanitization enabled, returns raw stderr
   */
  private sanitizeStderr(stderr: string): string {
    if (!stderr) {
      return "";
    }

    // ⚠️ DEBUG MODE: Return raw stderr when sanitization disabled
    if (configuration.get<boolean>("debug.disableSanitization", false)) {
      return stderr;
    }

    return stderr
      // Strip absolute file paths (Unix and Windows)
      .replace(/\/[^\s:]+/g, "[PATH]")
      .replace(/[A-Za-z]:\\[^\s:]+/g, "[PATH]")
      // Remove password parameters
      .replace(/password[=:]\s*\S+/gi, "password=[REDACTED]")
      .replace(/--password\s+\S+/gi, "--password [REDACTED]")
      // Remove username parameters
      .replace(/username[=:]\s*\S+/gi, "username=[REDACTED]")
      .replace(/--username\s+\S+/gi, "--username [REDACTED]")
      // Sanitize URLs (preserve protocol and domain, strip credentials)
      .replace(/https?:\/\/[^:@\s]+:[^@\s]+@/g, "https://[CREDENTIALS]@")
      // Strip internal IP addresses
      .replace(/\b(?:10|127|172\.(?:1[6-9]|2[0-9]|3[01])|192\.168)\.\d{1,3}\.\d{1,3}\b/g, "[INTERNAL_IP]");
  }

  /**
   * Format user-friendly error message based on error type.
   * Provides actionable guidance for common errors (network, timeout, auth).
   */
  private formatErrorMessage(error: any, fallbackMsg: string): string {
    const errorStr = error?.message || error?.toString() || "";
    const rawStderr = error?.stderr || error?.stderrFormated || "";
    const stderr = this.sanitizeStderr(rawStderr);
    const fullError = `${errorStr} ${stderr}`.toLowerCase();

    // Network/connection errors (E170013)
    if (
      fullError.includes("e170013") ||
      fullError.includes("unable to connect") ||
      fullError.includes("connection refused") ||
      fullError.includes("could not resolve host")
    ) {
      return "Network error: Unable to connect to the repository. Check your network connection and repository URL.";
    }

    // Timeout errors (E175002)
    if (
      fullError.includes("e175002") ||
      fullError.includes("timed out") ||
      fullError.includes("timeout") ||
      fullError.includes("operation timed out")
    ) {
      return "Network timeout: The operation took too long. Try again or check your network connection.";
    }

    // Authentication errors (E170001)
    if (
      fullError.includes("e170001") ||
      fullError.includes("authorization failed") ||
      fullError.includes("authentication failed")
    ) {
      return "Authentication failed: Please check your credentials and try again.";
    }

    // Repository locked (E155004)
    if (fullError.includes("e155004") || fullError.includes("locked")) {
      return "Working copy is locked: Run 'SVN: Cleanup' to unlock.";
    }

    // Use fallback message for other errors
    return fallbackMsg;
  }

  /**
   * Handle repository operation with consistent error handling.
   * Pattern: try/catch with console.log + showErrorMessage
   */
  protected async handleRepositoryOperation<T>(
    operation: () => Promise<T>,
    errorMsg: string
  ): Promise<T | undefined> {
    try {
      return await operation();
    } catch (error) {
      logError("Repository operation failed", error);
      const userMessage = this.formatErrorMessage(error, errorMsg);
      window.showErrorMessage(userMessage);
      return undefined;
    }
  }

  /**
   * Execute revert operation with depth check and confirmation.
   * Shared by revert and revertExplorer commands.
   */
  protected async executeRevert(
    uris: Uri[],
    depth: keyof typeof import("../common/types").SvnDepth
  ): Promise<void> {
    await this.runByRepository(uris, async (repository, resources) => {
      if (!repository) {
        return;
      }

      const paths = resources.map(resource => resource.fsPath).reverse();

      try {
        await repository.revert(paths, depth);
      } catch (error) {
        logError("Revert operation failed", error);
        window.showErrorMessage("Unable to revert");
      }
    });
  }
}
