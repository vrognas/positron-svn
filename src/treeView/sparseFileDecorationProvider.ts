// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import {
  Disposable,
  FileDecoration,
  FileDecorationProvider,
  ThemeColor,
  Uri,
  window
} from "vscode";

/**
 * Provides file decorations for sparse checkout tree items.
 * Ghost items (not checked out) are grayed out with a cloud badge.
 */
export class SparseFileDecorationProvider
  implements FileDecorationProvider, Disposable
{
  private disposable: Disposable;

  constructor() {
    this.disposable = window.registerFileDecorationProvider(this);
  }

  dispose(): void {
    this.disposable.dispose();
  }

  provideFileDecoration(uri: Uri): FileDecoration | undefined {
    // Only decorate items with sparse=ghost query param
    if (uri.query !== "sparse=ghost") {
      return undefined;
    }

    return {
      badge: "☁",
      tooltip: "Not checked out (on server only)",
      // Use list.deemphasizedForeground - VS Code's semantic color for
      // de-emphasized tree items (readable but visually secondary)
      color: new ThemeColor("list.deemphasizedForeground")
    };
  }
}
