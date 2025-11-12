/**
 * Consolidated Open* commands using factory pattern
 * Reduces code duplication from 5 separate files (74 lines) to single file (~45 lines)
 */

import { SourceControlResourceState, Uri } from "vscode";
import { Resource } from "../resource";
import IncomingChangeNode from "../treeView/nodes/incomingChangeNode";
import { Command } from "./command";

/**
 * Factory function to create OpenChange* commands (BASE, HEAD, PREV)
 * These commands open diffs with specified ref
 */
function createOpenChangeCommand(commandName: string, ref: "BASE" | "HEAD" | "PREV") {
  return class extends Command {
    constructor() {
      super(commandName, {});
    }

    public async execute(
      arg?: Resource | Uri | IncomingChangeNode,
      ...resourceStates: SourceControlResourceState[]
    ) {
      return this.openChange(arg, ref, resourceStates);
    }
  };
}

/**
 * Factory function to create OpenResource* commands (BASE, HEAD)
 * These commands open resources with specified ref
 */
function createOpenResourceCommand(commandName: string, ref: "BASE" | "HEAD") {
  return class extends Command {
    constructor() {
      super(commandName);
    }

    public async execute(resource: Resource) {
      await this._openResource(resource, ref, undefined, true, false);
    }
  };
}

// Export command classes with proper command names
export const OpenChangeBase = createOpenChangeCommand("svn.openChangeBase", "BASE");
export const OpenChangeHead = createOpenChangeCommand("svn.openChangeHead", "HEAD");
export const OpenChangePrev = createOpenChangeCommand("svn.openChangePrev", "PREV");
export const OpenResourceBase = createOpenResourceCommand("svn.openResourceBase", "BASE");
export const OpenResourceHead = createOpenResourceCommand("svn.openResourceHead", "HEAD");
