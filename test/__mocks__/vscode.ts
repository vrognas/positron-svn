import { vi } from "vitest";

// Uri mock
export const Uri = {
  file: (path: string) => ({ fsPath: path, scheme: "file", path }),
  parse: (uri: string) => ({ fsPath: uri, scheme: "file", path: uri }),
  joinPath: (base: { fsPath: string }, ...segments: string[]) => ({
    fsPath: [base.fsPath, ...segments].join("/"),
    scheme: "file",
    path: [base.fsPath, ...segments].join("/")
  })
};

// Event mock
export type Event<T> = (
  listener: (e: T) => void,
  thisArgs?: unknown,
  disposables?: Disposable[]
) => Disposable;

// Disposable mock
export class Disposable {
  constructor(private callOnDispose: () => void) {}
  dispose(): void {
    this.callOnDispose();
  }
  static from(...disposables: { dispose(): void }[]): Disposable {
    return new Disposable(() => disposables.forEach(d => d.dispose()));
  }
}

// EventEmitter mock
export class EventEmitter<T> {
  private listeners: ((e: T) => void)[] = [];
  event: Event<T> = listener => {
    this.listeners.push(listener);
    return new Disposable(() => {
      const idx = this.listeners.indexOf(listener);
      if (idx >= 0) this.listeners.splice(idx, 1);
    });
  };
  fire(data: T): void {
    this.listeners.forEach(l => l(data));
  }
  dispose(): void {
    this.listeners = [];
  }
}

// window mock
export const window = {
  showInformationMessage: vi.fn(),
  showWarningMessage: vi.fn(),
  showErrorMessage: vi.fn(),
  showQuickPick: vi.fn(),
  showInputBox: vi.fn(),
  createOutputChannel: vi.fn(() => ({
    appendLine: vi.fn(),
    append: vi.fn(),
    show: vi.fn(),
    dispose: vi.fn()
  })),
  createTextEditorDecorationType: vi.fn(() => ({ dispose: vi.fn() })),
  activeTextEditor: undefined,
  onDidChangeActiveTextEditor: vi.fn(() => new Disposable(() => {})),
  createStatusBarItem: vi.fn(() => ({
    show: vi.fn(),
    hide: vi.fn(),
    dispose: vi.fn(),
    text: "",
    tooltip: "",
    command: undefined
  })),
  withProgress: vi.fn((_, task) => task({ report: vi.fn() }))
};

// workspace mock
export const workspace = {
  getConfiguration: vi.fn(() => ({
    get: vi.fn((_section: string, defaultValue?: unknown) => defaultValue),
    update: vi.fn(),
    has: vi.fn(),
    inspect: vi.fn()
  })),
  workspaceFolders: [],
  onDidChangeConfiguration: vi.fn(() => new Disposable(() => {})),
  onDidChangeWorkspaceFolders: vi.fn(() => new Disposable(() => {})),
  fs: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    stat: vi.fn(),
    readDirectory: vi.fn(),
    createDirectory: vi.fn(),
    delete: vi.fn()
  }
};

// commands mock
export const commands = {
  registerCommand: vi.fn(() => new Disposable(() => {})),
  executeCommand: vi.fn(),
  getCommands: vi.fn(() => Promise.resolve([]))
};

// extensions mock
export const extensions = {
  getExtension: vi.fn(),
  all: []
};

// Enums
export enum StatusBarAlignment {
  Left = 1,
  Right = 2
}

export enum ViewColumn {
  Active = -1,
  Beside = -2,
  One = 1,
  Two = 2,
  Three = 3
}

export enum ProgressLocation {
  SourceControl = 1,
  Window = 10,
  Notification = 15
}

export enum QuickPickItemKind {
  Separator = -1,
  Default = 0
}

export enum ThemeColor {
  id = ""
}

export enum FileType {
  Unknown = 0,
  File = 1,
  Directory = 2,
  SymbolicLink = 64
}

// Additional types
export interface Command {
  title: string;
  command: string;
  tooltip?: string;
  arguments?: unknown[];
}

export interface QuickPickItem {
  label: string;
  description?: string;
  detail?: string;
  picked?: boolean;
  alwaysShow?: boolean;
}
