// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { access } from "original-fs";

export function exists(path: string): Promise<boolean> {
  return new Promise((resolve, _reject) => {
    access(path, err => (err ? resolve(false) : resolve(true)));
  });
}
