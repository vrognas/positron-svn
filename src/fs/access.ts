// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { access as fsAccess } from "original-fs";

export function access(
  path: string,
  mode: number | undefined
): Promise<boolean> {
  return new Promise((resolve, _reject) => {
    fsAccess(path, mode, err => (err ? resolve(false) : resolve(true)));
  });
}
