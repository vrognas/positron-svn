import { clearInterval, setInterval } from "timers";
import { Disposable, Event } from "vscode";
import { Operation } from "../common/types";
import { debounce } from "../decorators";

/**
 * RemoteChangeService
 *
 * Manages remote change detection polling for SVN repository.
 * Extracts interval management and remote change logic from Repository class.
 *
 * Responsibilities:
 * - Interval lifecycle (create/clear based on config)
 * - Remote change polling at configured frequency
 * - Config change handling (remoteChanges.checkFrequency)
 * - Remote changes group disposal when disabled
 */
export class RemoteChangeService implements Disposable {
  private remoteChangedUpdateInterval?: NodeJS.Timeout;
  private disposables: Disposable[] = [];

  /**
   * @param repository Repository instance with run() and remoteChanges
   * @param getConfig Config getter: (key, defaultValue) => value
   * @param onConfigChange Event fired when config changes
   */
  constructor(
    private readonly repository: IRemoteChangeRepository,
    private readonly getConfig: <T>(key: string, defaultValue: T) => T,
    onConfigChange: Event<{ affectsConfiguration: (key: string) => boolean }>
  ) {
    this.createRemoteChangedInterval();

    // On change config, dispose current interval and create a new one
    this.disposables.push(
      onConfigChange(e => {
        if (e.affectsConfiguration("svn.remoteChanges.checkFrequency")) {
          this.remoteChangedUpdateInterval && clearInterval(this.remoteChangedUpdateInterval);
          this.createRemoteChangedInterval();
          this.updateRemoteChangedFiles();
        }
      })
    );
  }

  /**
   * Creates polling interval based on config frequency.
   * Default: 300 seconds (5 minutes)
   * If frequency = 0, no interval created (polling disabled)
   */
  private createRemoteChangedInterval(): void {
    const updateFreq = this.getConfig<number>(
      "remoteChanges.checkFrequency",
      300
    );

    if (!updateFreq) {
      return;
    }

    this.remoteChangedUpdateInterval = setInterval(() => {
      this.updateRemoteChangedFiles();
    }, 1000 * updateFreq);
  }

  /**
   * Updates remote changed files by running StatusRemote operation.
   * If frequency = 0, disposes remote changes group instead.
   *
   * Debounced to prevent excessive calls (1 second)
   */
  @debounce(1000)
  public async updateRemoteChangedFiles(): Promise<void> {
    const updateFreq = this.getConfig<number>(
      "remoteChanges.checkFrequency",
      300
    );

    if (updateFreq) {
      await this.repository.run(Operation.StatusRemote);
    } else {
      // Remove list of remote changes
      this.repository.remoteChanges?.dispose();
      this.repository.remoteChanges = undefined;
    }
  }

  /**
   * Cleans up interval and disposables.
   * Prevents memory leaks and stops polling.
   */
  public dispose(): void {
    if (this.remoteChangedUpdateInterval) {
      clearInterval(this.remoteChangedUpdateInterval);
      this.remoteChangedUpdateInterval = undefined;
    }

    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }
}

/**
 * Minimal interface for repository interaction.
 * Allows service to be tested without full Repository dependency.
 */
export interface IRemoteChangeRepository {
  run(operation: Operation): Promise<void>;
  remoteChanges?: { dispose(): void; resourceStates?: unknown[] };
}
