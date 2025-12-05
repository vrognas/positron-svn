// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { rename as fsRename } from "fs";
import { promisify } from "util";

export const rename = promisify(fsRename);
