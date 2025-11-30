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
/** Callback to refresh tree; pass node for targeted refresh, undefined for full */
type RefreshCallback = (node?: BaseNode) => void;

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
    // For ghosts, add query param so FileDecorationProvider can gray them out
    const baseUri = Uri.file(fullPath);
    treeItem.resourceUri = this.item.isGhost
      ? baseUri.with({ query: "sparse=ghost" })
      : baseUri;

    // Add tooltip with full path
    treeItem.tooltip = this.item.path;

    if (this.item.isGhost) {
      // Ghost item: decoration provider de-emphasizes, no description needed
      treeItem.contextValue = isDir ? "sparseGhostDir" : "sparseGhostFile";
    } else {
      // Local item: let VS Code file icon theme show based on resourceUri
      if (isDir && this.item.depth) {
        // Show partial indicator if folder has excluded children
        if (this.item.hasExcludedChildren) {
          // Use descriptionForeground - partial is informational, not a warning
          treeItem.iconPath = new ThemeIcon(
            "folder",
            new ThemeColor("descriptionForeground")
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

    // Track if folder has excluded children (for partial indicator)
    // Only fire targeted refresh if flag actually changed (prevents loop)
    const hasGhosts = items.some(i => i.isGhost);
    const flagChanged = hasGhosts && !this.item.hasExcludedChildren;
    if (hasGhosts) {
      this.item.hasExcludedChildren = true;
    }
    if (flagChanged) {
      // Targeted refresh for just this node - updates icon without full rebuild
      this.onRefresh?.(this);
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
