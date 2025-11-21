// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { Disposable } from "vscode";
import * as semver from "semver";
import { setVscodeContext } from "../util";

export class IsSvn19orGreater implements Disposable {
  constructor(svnVersion: string) {
    const is19orGreater = semver.satisfies(svnVersion, ">= 1.9");

    setVscodeContext("isSvn19orGreater", is19orGreater);
  }

   
  dispose() {}
}
