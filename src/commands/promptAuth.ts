// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { window } from "vscode";
import { IAuth } from "../common/types";
import { Command } from "./command";

export class PromptAuth extends Command {
  constructor() {
    super("svn.promptAuth");
  }

  public async execute(
    prevUsername?: string,
    prevPassword?: string,
    repoUrl?: string
  ) {
    const urlHint = repoUrl ? ` for ${repoUrl}` : "";
    const username = await window.showInputBox({
      placeHolder: "SVN username",
      prompt: `Enter username${urlHint}`,
      ignoreFocusOut: true,
      value: prevUsername,
      validateInput: value => {
        if (!value || !value.trim()) {
          return "Username cannot be empty";
        }
        return null;
      }
    });

    if (username === undefined) {
      return;
    }

    const password = await window.showInputBox({
      placeHolder: "SVN password",
      prompt: `Enter password${urlHint}`,
      value: prevPassword,
      ignoreFocusOut: true,
      password: true,
      validateInput: value => {
        if (!value) {
          return "Password cannot be empty";
        }
        return null;
      }
    });

    if (password === undefined) {
      return;
    }

    const auth: IAuth = {
      username: username.trim(),
      password
    };

    return auth;
  }
}
