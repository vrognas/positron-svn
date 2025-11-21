// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { TreeItem, TreeItemCollapsibleState } from "vscode";
import BaseNode from "./baseNode";

export default class NoIncomingChangesNode implements BaseNode {
  public getTreeItem(): TreeItem {
    const item = new TreeItem(
      "No Incoming Changes",
      TreeItemCollapsibleState.None
    );

    return item;
  }

  public async getChildren(): Promise<BaseNode[]> {
    return [];
  }
}
