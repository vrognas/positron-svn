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
  // Phase 20.C fix: Safe JSON.parse to prevent crash on malformed URI queries
  try {
    return JSON.parse(uri.query);
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
