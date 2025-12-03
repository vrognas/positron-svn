// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { Disposable } from "vscode";
import { Add } from "./commands/add";
import { AddToIgnoreExplorer } from "./commands/addToIgnoreExplorer";
import { AddToIgnoreSCM } from "./commands/addToIgnoreSCM";
import { ChangeList } from "./commands/changeList";
import { Checkout } from "./commands/checkout";
import { Cleanup } from "./commands/cleanup";
import { Close } from "./commands/close";
import { Commit } from "./commands/commit";
import { CommitWithMessage } from "./commands/commitWithMessage";
import { CommitAll } from "./commands/commitAll";
import { DeleteUnversioned } from "./commands/deleteUnversioned";
import { FileOpen } from "./commands/fileOpen";
import { FinishCheckout } from "./commands/finishCheckout";
import { GetSourceControlManager } from "./commands/get_source_control_manager";
import { Lock, StealLock } from "./commands/lock";
import { ToggleNeedsLock } from "./commands/needsLock";
import { Log } from "./commands/log";
import {
  OpenChangeBase,
  OpenChangeHead,
  OpenChangePrev,
  OpenResourceBase,
  OpenResourceHead
} from "./commands/openCommands";
import { OpenFile } from "./commands/openFile";
import { OpenHeadFile } from "./commands/openHeadFile";
import { Patch } from "./commands/patch";
import { PatchAll } from "./commands/patchAll";
import { PatchChangeList } from "./commands/patchChangeList";
import { PickCommitMessage } from "./commands/pickCommitMessage";
import { PromptAuth } from "./commands/promptAuth";
import { PromptRemove } from "./commands/promptRemove";
import { PullIncommingChange } from "./commands/pullIncomingChange";
import { ClearCredentials } from "./commands/clearCredentials";
import { Refresh } from "./commands/refresh";
import { RefreshRemoteChanges } from "./commands/refreshRemoteChanges";
import { Remove } from "./commands/remove";
import { RemoveUnversioned } from "./commands/removeUnversioned";
import { RenameExplorer } from "./commands/renameExplorer";
import { Resolve } from "./commands/resolve";
import { ResolveAll } from "./commands/resolveAll";
import { Resolved } from "./commands/resolved";
import { Revert } from "./commands/revert";
import { RevertAll } from "./commands/revertAll";
import { RevertChange } from "./commands/revertChange";
import { RevertExplorer } from "./commands/revertExplorer";
import { SetDepth } from "./commands/setDepth";
import { SwitchBranch } from "./commands/switchBranch";
import { Unlock, BreakLock } from "./commands/unlock";
import { Update } from "./commands/update";
import { Upgrade } from "./commands/upgrade";
import { SourceControlManager } from "./source_control_manager";
import { Command } from "./commands/command";
import { SearchLogByRevision } from "./commands/search_log_by_revision";
import { SearchLogByText } from "./commands/search_log_by_text";
import { RevealInExplorer } from "./commands/revealInExplorer";
import { Merge } from "./commands/merge";
import { DiffWithExternalTool } from "./commands/diffWithExternalTool";
import { Blame } from "./commands/blame";
import { ShowBlame } from "./commands/blame/showBlame";
import { ToggleBlame } from "./commands/blame/toggleBlame";
import { ClearBlame } from "./commands/blame/clearBlame";
import { EnableBlame } from "./commands/blame/enableBlame";
import { DisableBlame } from "./commands/blame/disableBlame";
import { UntrackedInfo } from "./commands/blame/untrackedInfo";
import { ApplyRecommendedSettings } from "./commands/applyRecommendedSettings";

export function registerCommands(
  sourceControlManager: SourceControlManager,
  disposables: Disposable[]
) {
  // Phase 10.2 perf fix - cache SourceControlManager
  Command.setSourceControlManager(sourceControlManager);

  disposables.push(new GetSourceControlManager(sourceControlManager));
  disposables.push(new FileOpen());
  disposables.push(new OpenFile());
  disposables.push(new RevealInExplorer());
  disposables.push(new PromptAuth());
  disposables.push(new CommitWithMessage());
  disposables.push(new CommitAll());
  disposables.push(new Add());
  disposables.push(new ChangeList());
  disposables.push(new Refresh());
  disposables.push(new ClearCredentials());
  disposables.push(new Commit());
  disposables.push(new OpenResourceBase());
  disposables.push(new OpenResourceHead());
  disposables.push(new OpenChangeBase());
  disposables.push(new SwitchBranch());
  disposables.push(new Merge());
  disposables.push(new Revert());
  disposables.push(new Update());
  disposables.push(new PullIncommingChange());
  disposables.push(new PatchAll());
  disposables.push(new Patch());
  disposables.push(new PatchChangeList());
  disposables.push(new Remove());
  disposables.push(new ResolveAll());
  disposables.push(new Resolve());
  disposables.push(new Resolved());
  disposables.push(new Lock());
  disposables.push(new StealLock());
  disposables.push(new ToggleNeedsLock());
  disposables.push(new Log());
  disposables.push(new RevertChange());
  disposables.push(new Close());
  disposables.push(new Cleanup());
  disposables.push(new RemoveUnversioned());
  disposables.push(new FinishCheckout());
  disposables.push(new AddToIgnoreSCM());
  disposables.push(new AddToIgnoreExplorer());
  disposables.push(new RenameExplorer());
  disposables.push(new Unlock());
  disposables.push(new BreakLock());
  disposables.push(new SetDepth());
  disposables.push(new Upgrade());
  disposables.push(new OpenChangePrev());
  disposables.push(new PromptRemove());
  disposables.push(new Checkout());
  disposables.push(new RefreshRemoteChanges());
  disposables.push(new DeleteUnversioned());
  disposables.push(new OpenChangeHead());
  disposables.push(new OpenHeadFile());
  disposables.push(new RevertAll());
  disposables.push(new PickCommitMessage(sourceControlManager.svn.version));
  disposables.push(new RevertExplorer());
  disposables.push(new SearchLogByRevision());
  disposables.push(new SearchLogByText());
  disposables.push(new DiffWithExternalTool());
  disposables.push(new Blame());
  disposables.push(new ShowBlame());
  disposables.push(new ToggleBlame());
  disposables.push(new ClearBlame());
  disposables.push(new EnableBlame());
  disposables.push(new DisableBlame());
  disposables.push(new UntrackedInfo());
  disposables.push(new ApplyRecommendedSettings());
}
