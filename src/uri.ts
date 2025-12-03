// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import * as path from "path";
import { Uri } from "vscode";
import {
  ISvnUriExtraParams,
  ISvnUriParams,
  SvnUriAction
} from "./common/types";
import { getSvnDir } from "./util";
import { logError } from "./util/errorLogger";

export function fromSvnUri(uri: Uri): ISvnUriParams {
  // Phase 20.C fix: Safe JSON.parse with prototype pollution protection
  try {
    const parsed = JSON.parse(uri.query);

    // Security: Validate structure and reject prototype pollution vectors
    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed) ||
      "__proto__" in parsed ||
      "constructor" in parsed ||
      "prototype" in parsed
    ) {
      logError("Invalid SVN URI params structure");
      return { action: SvnUriAction.SHOW, fsPath: "", extra: {} };
    }

    // Validate action is a known value
    if (!Object.values(SvnUriAction).includes(parsed.action)) {
      logError("Invalid SVN URI action");
      return { action: SvnUriAction.SHOW, fsPath: "", extra: {} };
    }

    return parsed as ISvnUriParams;
  } catch (error) {
    logError("Failed to parse SVN URI query", error);
    // Return safe default params to prevent extension crash
    return {
      action: SvnUriAction.SHOW,
      fsPath: "",
      extra: {}
    };
  }
}

export function toSvnUri(
  uri: Uri,
  action: SvnUriAction,
  extra: ISvnUriExtraParams = {},
  replaceFileExtension = false
): Uri {
  const params: ISvnUriParams = {
    action,
    fsPath: uri.fsPath,
    extra
  };

  return uri.with({
    scheme: "svn",
    path: replaceFileExtension ? uri.path + getSvnDir() : uri.path,
    query: JSON.stringify(params)
  });
}

export function getIconUri(iconName: string, theme: string): Uri {
  // Path needs to be relative from out/
  const iconsRootPath = path.join(__dirname, "..", "icons");
  return Uri.file(path.join(iconsRootPath, theme, `${iconName}.svg`));
}
