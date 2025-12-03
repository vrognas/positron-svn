// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { commands, window, workspace } from "vscode";
import { Command } from "./command";
import { logError } from "../util/errorLogger";

/**
 * Recommended settings profiles for different use cases.
 */
const PROFILES = {
  datascience: {
    name: "Data Science (Recommended)",
    description: "Optimized for large repos with binary files",
    settings: {
      "svn.autorefresh": true,
      "svn.blame.enabled": true,
      "svn.blame.autoBlame": false, // Don't auto-blame (slow on large files)
      "svn.blame.largeFileLimit": 1000, // Warn earlier for large files
      "svn.remoteChanges.checkFrequency": 600, // 10 min (less frequent)
      "svn.update.ignoreExternals": true,
      "svn.sourceControl.countUnversioned": false, // Faster status
      "svn.diff.withHead": false, // Use BASE (faster, no network)
      "svn.performance.maxXmlTags": 500000
    }
  },
  minimal: {
    name: "Minimal",
    description: "Essential features only, maximum performance",
    settings: {
      "svn.autorefresh": true,
      "svn.blame.enabled": false,
      "svn.remoteChanges.checkFrequency": 0, // Disabled
      "svn.update.ignoreExternals": true,
      "svn.sourceControl.countUnversioned": false,
      "svn.sourceControl.hideUnversioned": true,
      "svn.diff.withHead": false
    }
  },
  full: {
    name: "Full Features",
    description: "All features enabled (may be slower)",
    settings: {
      "svn.autorefresh": true,
      "svn.blame.enabled": true,
      "svn.blame.autoBlame": true,
      "svn.remoteChanges.checkFrequency": 300, // 5 min
      "svn.update.ignoreExternals": false,
      "svn.sourceControl.countUnversioned": true,
      "svn.diff.withHead": true
    }
  }
};

type ProfileKey = keyof typeof PROFILES;

export class ApplyRecommendedSettings extends Command {
  constructor() {
    super("svn.applyRecommendedSettings");
  }

  public async execute(): Promise<void> {
    // Show profile picker
    const items = Object.entries(PROFILES).map(([key, profile]) => ({
      label: profile.name,
      description: profile.description,
      key: key as ProfileKey
    }));

    const selected = await window.showQuickPick(items, {
      placeHolder: "Select a settings profile",
      title: "SVN: Apply Recommended Settings"
    });

    if (!selected) {
      return; // User cancelled
    }

    const profile = PROFILES[selected.key];
    const config = workspace.getConfiguration();

    // Apply settings
    let appliedCount = 0;
    for (const [key, value] of Object.entries(profile.settings)) {
      try {
        await config.update(key, value, true); // true = global settings
        appliedCount++;
      } catch (err) {
        // Log but continue
        logError(`Failed to set ${key}`, err);
      }
    }

    // Show confirmation
    const reloadAction = "Reload Window";
    const result = await window.showInformationMessage(
      `Applied "${profile.name}" profile (${appliedCount} settings). Reload to apply changes.`,
      reloadAction
    );

    if (result === reloadAction) {
      await commands.executeCommand("workbench.action.reloadWindow");
    }
  }
}
