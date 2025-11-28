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

  public async execute(prevUsername?: string, prevPassword?: string) {
    const username = await window.showInputBox({
      placeHolder: "Svn repository username",
      prompt: "Please enter your username",
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
      placeHolder: "Svn repository password",
      prompt: "Please enter your password",
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
