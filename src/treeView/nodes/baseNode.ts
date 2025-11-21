// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { TreeItem } from "vscode";

export default abstract class BaseNode {
  public abstract getChildren(): BaseNode[] | Promise<BaseNode[]>;
  public abstract getTreeItem(): TreeItem | Promise<TreeItem>;
}
