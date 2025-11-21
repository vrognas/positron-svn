// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { Repository } from "../repository";
import { Command } from "./command";

export class FinishCheckout extends Command {
  constructor() {
    super("svn.finishCheckout", { repository: true });
  }

  public async execute(repository: Repository) {
    await repository.finishCheckout();
  }
}
