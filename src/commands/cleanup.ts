// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { Repository } from "../repository";
import { Command } from "./command";

export class Cleanup extends Command {
  constructor() {
    super("svn.cleanup", { repository: true });
  }

  public async execute(repository: Repository) {
    await repository.cleanup();
  }
}
