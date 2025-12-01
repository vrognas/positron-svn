// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import {
  commands,
  Event,
  EventEmitter,
  TreeDataProvider,
  TreeItem,
  Disposable,
  window
} from "vscode";
import { SourceControlManager } from "../../source_control_manager";
import BaseNode from "../nodes/baseNode";
import RepositoryNode from "../nodes/repositoryNode";
import { dispose } from "../../util";

export default class SvnProvider
  implements TreeDataProvider<BaseNode>, Disposable
{
  private _onDidChangeTreeData: EventEmitter<BaseNode | undefined> =
    new EventEmitter<BaseNode | undefined>();
  private _dispose: Disposable[] = [];
  public onDidChangeTreeData: Event<BaseNode | undefined> =
    this._onDidChangeTreeData.event;

  /** Track nodes by repo root to reuse and properly dispose */
  private repoNodes = new Map<string, RepositoryNode>();

  constructor(private sourceControlManager: SourceControlManager) {
    this._dispose.push(
      window.registerTreeDataProvider("svn", this),
      commands.registerCommand("svn.treeview.refreshProvider", () =>
        this.refresh()
      )
    );
  }

  public refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  public getTreeItem(element: RepositoryNode): TreeItem {
    return element.getTreeItem();
  }

  public async getChildren(element?: BaseNode): Promise<BaseNode[]> {
    if (
      !this.sourceControlManager ||
      this.sourceControlManager.openRepositories.length === 0
    ) {
      return Promise.resolve([]);
    }

    if (element) {
      return element.getChildren();
    }

    // Track which repos are still open
    const currentRoots = new Set<string>();

    const repositories = this.sourceControlManager.openRepositories.map(
      openRepo => {
        const root = openRepo.repository.root;
        currentRoots.add(root);

        // Reuse existing node or create new one
        let node = this.repoNodes.get(root);
        if (!node) {
          node = new RepositoryNode(openRepo.repository, this);
          this.repoNodes.set(root, node);
        }
        return node;
      }
    );

    // Dispose nodes for closed repos
    for (const [root, node] of this.repoNodes) {
      if (!currentRoots.has(root)) {
        node.dispose();
        this.repoNodes.delete(root);
      }
    }

    return repositories;
  }

  public update(node: BaseNode): void {
    this._onDidChangeTreeData.fire(node);
  }

  public dispose() {
    // Dispose all tracked nodes
    for (const node of this.repoNodes.values()) {
      node.dispose();
    }
    this.repoNodes.clear();
    dispose(this._dispose);
  }
}
