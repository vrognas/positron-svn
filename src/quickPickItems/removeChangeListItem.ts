// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { QuickPickItem } from "vscode";

export default class RemoveChangeListItem implements QuickPickItem {
  get label(): string {
    return "$(dash) Remove changelist";
  }

  get description(): string {
    return "Remove changelist of file(s)";
  }
}
