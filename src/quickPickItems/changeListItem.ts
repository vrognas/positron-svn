// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { QuickPickItem } from "vscode";
import { ISvnResourceGroup } from "../common/types";

export default class ChangeListItem implements QuickPickItem {
  constructor(protected group: ISvnResourceGroup) {}

  get label(): string {
    return this.group.id.replace(/^changelist-/, "");
  }

  get id(): string {
    return this.group.id;
  }

  get description(): string {
    return this.group.label;
  }
  get resourceGroup(): ISvnResourceGroup {
    return this.group;
  }
}
