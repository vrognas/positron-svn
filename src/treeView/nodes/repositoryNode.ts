// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import * as path from "path";
import { Disposable, TreeItem, TreeItemCollapsibleState } from "vscode";
import { Repository } from "../../repository";
import { getIconUri } from "../../uri";
import SvnProvider from "../dataProviders/svnProvider";
import BaseNode from "./baseNode";
import IncomingChangesNode from "./incomingChangesNode";

export default class RepositoryNode implements BaseNode, Disposable {
  private subscription: Disposable;

  constructor(
    private repository: Repository,
    private svnProvider: SvnProvider
  ) {
    this.subscription = repository.onDidChangeStatus(() => {
      this.svnProvider.update(this);
    });
  }

  public dispose(): void {
    this.subscription.dispose();
  }

  get label() {
    return path.basename(this.repository.workspaceRoot);
  }

  /** Repository root path for node tracking */
  get repoRoot(): string {
    return this.repository.root;
  }

  public getTreeItem(): TreeItem {
    const item = new TreeItem(this.label, TreeItemCollapsibleState.Collapsed);
    item.iconPath = {
      dark: getIconUri("repo", "dark"),
      light: getIconUri("repo", "light")
    };

    return item;
  }

  public async getChildren(): Promise<BaseNode[]> {
    return [new IncomingChangesNode(this.repository)];
  }
}
