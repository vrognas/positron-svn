// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { unlink as fsUnlink } from "original-fs";
import { promisify } from "util";

export const unlink = promisify(fsUnlink);
