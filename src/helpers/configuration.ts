// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

"use strict";

import {
  ConfigurationChangeEvent,
  ConfigurationTarget,
  Event,
  EventEmitter,
  workspace,
  WorkspaceConfiguration
} from "vscode";

const SVN = "svn";

class Configuration {
  private configuration: WorkspaceConfiguration;
  private _onDidChange = new EventEmitter<ConfigurationChangeEvent>();

  get onDidChange(): Event<ConfigurationChangeEvent> {
    return this._onDidChange.event;
  }

  constructor() {
    this.configuration = workspace.getConfiguration(SVN);
    workspace.onDidChangeConfiguration(this.onConfigurationChanged, this);
  }

  private onConfigurationChanged(event: ConfigurationChangeEvent) {
    if (!event.affectsConfiguration(SVN)) {
      return;
    }

    this.configuration = workspace.getConfiguration(SVN);

    this._onDidChange.fire(event);
  }

  public get<T>(section: string, defaultValue?: T): T {
    return this.configuration.get<T>(section, defaultValue!);
  }

  public update(
    section: string,
    value: unknown,
    configurationTarget?: ConfigurationTarget | boolean
  ): Thenable<void> {
    return this.configuration.update(section, value, configurationTarget);
  }

  public inspect(section: string) {
    return this.configuration.inspect(section);
  }
}

export const configuration = new Configuration();
