// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { TreeItem, TreeItemCollapsibleState, ThemeIcon } from "vscode";
import { ISparseItem, SparseDepthKey } from "../../common/types";
import BaseNode from "./baseNode";

type ChildrenLoader = (path: string) => Promise<ISparseItem[]>;

const depthLabels: Record<SparseDepthKey, string> = {
  exclude: "Excluded",
  empty: "Empty",
  files: "Files Only",
  immediates: "Shallow",
  infinity: "Full"
};

export default class SparseItemNode extends BaseNode {
  constructor(
    private item: ISparseItem,
    private repoRoot: string,
    private loadChildren: ChildrenLoader
  ) {
    super();
  }

  public getTreeItem(): TreeItem {
    const isDir = this.item.kind === "dir";

    const treeItem = new TreeItem(
      this.item.name,
      isDir ? TreeItemCollapsibleState.Collapsed : TreeItemCollapsibleState.None
    );

    if (this.item.isGhost) {
      // Ghost item: cloud icon, italic description
      treeItem.iconPath = new ThemeIcon(isDir ? "cloud" : "cloud-download");
      treeItem.description = "(not checked out)";
      treeItem.contextValue = isDir ? "sparseGhostDir" : "sparseGhostFile";
    } else {
      // Local item
      treeItem.iconPath = new ThemeIcon(isDir ? "folder" : "file");
      if (isDir && this.item.depth) {
        treeItem.description = depthLabels[this.item.depth] || this.item.depth;
      }
      treeItem.contextValue = isDir ? "sparseLocalDir" : "sparseLocalFile";
    }

    return treeItem;
  }

  public async getChildren(): Promise<BaseNode[]> {
    if (this.item.kind !== "dir") {
      return [];
    }
    const fullPath = this.repoRoot + "/" + this.item.path;
    const items = await this.loadChildren(fullPath);
    return items.map(
      i =>
        new SparseItemNode(
          { ...i, path: this.item.path + "/" + i.name },
          this.repoRoot,
          this.loadChildren
        )
    );
  }

  public get path(): string {
    return this.item.path;
  }

  public get fullPath(): string {
    return this.repoRoot + "/" + this.item.path;
  }

  public get isGhost(): boolean {
    return this.item.isGhost;
  }

  public get kind(): "file" | "dir" {
    return this.item.kind;
  }
}
