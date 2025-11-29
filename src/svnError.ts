// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { ISvnErrorData } from "./common/types";
import {
  sanitizeString,
  createSanitizedErrorLog
} from "./security/errorSanitizer";

export default class SvnError {
  public error?: Error;
  public message: string;
  public stdout?: string;
  public stderr?: string;
  public stderrFormated?: string;
  public exitCode?: number;
  public svnErrorCode?: string;
  public svnCommand?: string;

  constructor(data: ISvnErrorData) {
    if (data.error) {
      this.error = data.error;
      this.message = data.error.message;
    } else {
      this.error = void 0;
    }

    this.message = data.message || "SVN error";
    this.stdout = data.stdout;
    this.stderr = data.stderr;
    this.stderrFormated = data.stderrFormated;
    this.exitCode = data.exitCode;
    this.svnErrorCode = data.svnErrorCode;
    this.svnCommand = data.svnCommand;
  }

  public toString(): string {
    const errorLog = createSanitizedErrorLog(this);
    let result =
      sanitizeString(this.message) + " " + JSON.stringify(errorLog, null, 2);

    if (this.error && this.error.stack) {
      result += sanitizeString(this.error.stack);
    }

    return result;
  }
}
