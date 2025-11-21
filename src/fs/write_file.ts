// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { writeFile as fsWriteFile } from "original-fs";
import { promisify } from "util";

export const writeFile = promisify(fsWriteFile);
