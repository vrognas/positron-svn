// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { Disposable } from "vscode";
import * as semver from "semver";
import { setVscodeContext } from "../util";

export class IsSvn18orGreater implements Disposable {
  constructor(svnVersion: string) {
    const is18orGreater = semver.satisfies(svnVersion, ">= 1.8");

    setVscodeContext("isSvn18orGreater", is18orGreater);
  }

   
  dispose() {}
}
