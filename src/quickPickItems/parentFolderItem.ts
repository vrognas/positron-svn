// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { QuickPickItem } from "vscode";

export default class ParentFolderItem implements QuickPickItem {
  constructor(public path?: string) {}

  get label(): string {
    return `$(arrow-left) back to /${this.path}`;
  }
  get description(): string {
    return `Back to parent`;
  }
}
