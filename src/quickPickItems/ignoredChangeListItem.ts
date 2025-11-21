// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { QuickPickItem } from "vscode";

export default class IgnoredChangeListItem implements QuickPickItem {
  constructor(protected _id: string) {}

  get label(): string {
    return this._id;
  }

  get description(): string {
    return "Ignored on commit";
  }
}
