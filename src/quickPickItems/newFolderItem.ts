// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { QuickPickItem } from "vscode";

export default class NewFolderItem implements QuickPickItem {
  constructor(protected _parent: string) {}

  get label(): string {
    return `$(plus) Create new branch`;
  }

  get description(): string {
    return `Create new branch in "${this._parent}"`;
  }
}
