// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import * as path from "path";
import {
  TreeItem,
  TreeItemCollapsibleState,
  ThemeIcon,
  ThemeColor,
  Uri
} from "vscode";
import { ISparseItem, SparseDepthKey } from "../../common/types";
import BaseNode from "./baseNode";

type ChildrenLoader = (path: string) => Promise<ISparseItem[]>;
type RefreshCallback = () => void;

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
    private loadChildren: ChildrenLoader,
    private onRefresh?: RefreshCallback
  ) {
    super();
  }

  public getTreeItem(): TreeItem {
    const isDir = this.item.kind === "dir";
    const fullPath = path.join(this.repoRoot, this.item.path);

    // Directories are expandable (both local and ghost)
    // Ghost dirs show server contents, local dirs show local + ghost
    const treeItem = new TreeItem(
      this.item.name,
      isDir ? TreeItemCollapsibleState.Collapsed : TreeItemCollapsibleState.None
    );

    // Set resourceUri to get file icons from VS Code's file icon theme
    treeItem.resourceUri = Uri.file(fullPath);

    // Add tooltip with full path
    treeItem.tooltip = this.item.path;

    if (this.item.isGhost) {
      // Ghost item: override icon with cloud, add description
      treeItem.iconPath = new ThemeIcon(isDir ? "cloud" : "cloud-download");
      treeItem.description = "(not checked out)";
      treeItem.contextValue = isDir ? "sparseGhostDir" : "sparseGhostFile";
    } else {
      // Local item: let VS Code file icon theme show based on resourceUri
      // Don't set iconPath - VS Code will use the file/folder icon theme
      if (isDir && this.item.depth) {
        // Show partial indicator if folder has excluded children
        if (this.item.hasExcludedChildren) {
          treeItem.iconPath = new ThemeIcon(
            "folder",
            new ThemeColor("list.warningForeground")
          );
          const label = depthLabels[this.item.depth] || this.item.depth;
          treeItem.description = `${label} (partial)`;
        } else {
          treeItem.description =
            depthLabels[this.item.depth] || this.item.depth;
        }
      }
      treeItem.contextValue = isDir ? "sparseLocalDir" : "sparseLocalFile";
    }

    return treeItem;
  }

  public async getChildren(): Promise<BaseNode[]> {
    if (this.item.kind !== "dir") {
      return [];
    }
    const fullPath = path.join(this.repoRoot, this.item.path);
    const items = await this.loadChildren(fullPath);

    // Check if any children are ghosts (excluded)
    const hasGhosts = items.some(i => i.isGhost);
    if (hasGhosts && !this.item.hasExcludedChildren) {
      this.item.hasExcludedChildren = true;
      // Trigger refresh to update this node's icon/description
      this.onRefresh?.();
    }

    return items.map(
      i =>
        new SparseItemNode(
          i, // Path is already correct from getItems()
          this.repoRoot,
          this.loadChildren,
          this.onRefresh
        )
    );
  }

  public get path(): string {
    return this.item.path;
  }

  public get fullPath(): string {
    return path.join(this.repoRoot, this.item.path);
  }

  public get isGhost(): boolean {
    return this.item.isGhost;
  }

  public get kind(): "file" | "dir" {
    return this.item.kind;
  }
}
