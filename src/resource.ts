// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import {
  Command,
  SourceControlResourceDecorations,
  SourceControlResourceState,
  ThemeColor,
  Uri
} from "vscode";
import { LockStatus, PropStatus, Status } from "./common/types";
import { memoize } from "./decorators";
import { configuration } from "./helpers/configuration";

export class Resource implements SourceControlResourceState {
  constructor(
    private _resourceUri: Uri,
    private _type: string,
    private _renameResourceUri?: Uri,
    private _props?: string,
    private _remote: boolean = false,
    private _locked: boolean = false,
    private _lockOwner?: string,
    private _hasLockToken: boolean = false,
    private _lockStatus?: LockStatus,
    private _changelist?: string,
    private _kind?: "file" | "dir"
  ) {}

  get kind(): "file" | "dir" | undefined {
    return this._kind;
  }

  get changelist(): string | undefined {
    return this._changelist;
  }

  @memoize
  get resourceUri(): Uri {
    return this._resourceUri;
  }

  @memoize
  get type(): string {
    return this._type;
  }
  get renameResourceUri(): Uri | undefined {
    return this._renameResourceUri;
  }
  get props(): string | undefined {
    return this._props;
  }

  get remote(): boolean {
    return this._remote;
  }

  get locked(): boolean {
    return this._locked;
  }

  get lockOwner(): string | undefined {
    return this._lockOwner;
  }

  /** True if we hold the lock token (K), false if locked by others (O) */
  get hasLockToken(): boolean {
    return this._hasLockToken;
  }

  /** Lock status: K=mine, O=other, B=broken, T=stolen */
  get lockStatus(): LockStatus | undefined {
    return this._lockStatus;
  }

  get contextValue(): string {
    return this._kind === "dir" ? "folder" : "file";
  }

  get decorations(): SourceControlResourceDecorations {
    // No iconPath - VS Code uses file extension icons for files
    // FileDecorationProvider adds badges (A/M/D for files, FA/FM/FD for folders)
    return {
      strikeThrough: this.strikeThrough,
      faded: this.faded,
      tooltip: this.tooltip
    };
  }

  @memoize
  get command(): Command {
    const diffHead = configuration.get<boolean>("diff.withHead", true);
    const changesLeftClick = configuration.get<string>(
      "sourceControl.changesLeftClick",
      "open diff"
    );

    if (!this.remote && changesLeftClick === "open") {
      return {
        command: "svn.openFile",
        title: "Open file",
        arguments: [this]
      };
    }

    if (this.remote || diffHead) {
      return {
        command: "svn.openResourceHead",
        title: "Open Diff With Head",
        arguments: [this]
      };
    }

    return {
      command: "svn.openResourceBase",
      title: "Open Diff With Base",
      arguments: [this]
    };
  }

  private get tooltip(): string {
    let tip = "";

    if (this.type === Status.ADDED && this.renameResourceUri) {
      tip = "Renamed from " + this.renameResourceUri.fsPath;
    } else if (
      this.type === Status.NORMAL &&
      this.props &&
      this.props !== PropStatus.NONE
    ) {
      tip =
        "Property " + this.props.charAt(0).toUpperCase() + this.props.slice(1);
    } else {
      tip = this.type.charAt(0).toUpperCase() + this.type.slice(1);
    }

    // Add lock info to tooltip
    if (this._locked) {
      const lockInfo = this._lockOwner
        ? `Locked by ${this._lockOwner}`
        : "Locked";
      tip = `${tip} (${lockInfo})`;
    }

    return tip;
  }

  private get strikeThrough(): boolean {
    if (this.type === Status.DELETED) {
      return true;
    }

    return false;
  }

  private get faded(): boolean {
    return false;
  }

  get letter(): string | undefined {
    switch (this.type) {
      case Status.ADDED:
        if (this.renameResourceUri) {
          return "R";
        }
        return "A";
      case Status.CONFLICTED:
        return "C";
      case Status.DELETED:
        return "D";
      case Status.EXTERNAL:
        return "E";
      case Status.IGNORED:
        return "I";
      case Status.MODIFIED:
        return "M";
      case Status.REPLACED:
        return "R";
      case Status.UNVERSIONED:
        return "U";
      case Status.MISSING:
        return "!";
      default:
        return undefined;
    }
  }

  get color(): ThemeColor | undefined {
    switch (this.type) {
      case Status.MODIFIED:
      case Status.REPLACED:
        return new ThemeColor("gitDecoration.modifiedResourceForeground");
      case Status.DELETED:
      case Status.MISSING:
        return new ThemeColor("gitDecoration.deletedResourceForeground");
      case Status.ADDED:
      case Status.UNVERSIONED:
        return new ThemeColor("gitDecoration.untrackedResourceForeground");
      case Status.EXTERNAL:
      case Status.IGNORED:
        return new ThemeColor("gitDecoration.ignoredResourceForeground");
      case Status.CONFLICTED:
        return new ThemeColor("gitDecoration.conflictingResourceForeground");
      default:
        return undefined;
    }
  }

  get priority(): number {
    switch (this.type) {
      case Status.MODIFIED:
        return 2;
      case Status.IGNORED:
        return 3;
      case Status.DELETED:
      case Status.ADDED:
      case Status.REPLACED:
      case Status.MISSING:
        return 4;
      default:
        return 1;
    }
  }
}
