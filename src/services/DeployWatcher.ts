import * as vscode from 'vscode';
import {
  SF_DEPLOY_COMMANDS,
  SF_RETRIEVE_COMMANDS,
} from '../util/constants';
import { CompareService } from './CompareService';

type SyncOperation = 'deploy' | 'retrieve';

/**
 * Detects successful Salesforce deploys and retrieves, then marks affected
 * open files as synced with the Org. Never initiates deploy or retrieve.
 */
export class DeployWatcher implements vscode.Disposable {
  private readonly subscriptions: vscode.Disposable[] = [];
  private syncTimer: NodeJS.Timeout | undefined;
  private pendingOperation: SyncOperation | undefined;

  /**
   * Creates the deploy/retrieve watcher.
   *
   * @param compareService - Compare service used to sync status after Org operations.
   */
  constructor(private readonly compareService: CompareService) {}

  /**
   * Starts listening for deploy and retrieve success signals.
   */
  public start(): void {
    this.listenToTerminalShellExecutions();
    this.listenToSourceTrackingArtifacts();
    this.listenToSalesforceTasks();
    this.listenToSalesforceCommands();
    this.listenToEligibleFileChanges();
  }

  /**
   * Uses VS Code shell-integration events to detect successful deploy/retrieve CLI runs.
   */
  private listenToTerminalShellExecutions(): void {
    const windowAny = vscode.window as unknown as {
      onDidEndTerminalShellExecution?: (
        listener: (event: {
          exitCode: number | undefined;
          execution: { commandLine: { value: string } };
        }) => void
      ) => vscode.Disposable;
    };

    if (typeof windowAny.onDidEndTerminalShellExecution !== 'function') {
      return;
    }

    this.subscriptions.push(
      windowAny.onDidEndTerminalShellExecution((event) => {
        const line = event.execution?.commandLine?.value ?? '';
        if (event.exitCode !== 0) {
          return;
        }
        if (this.looksLikeDeployCommand(line)) {
          this.scheduleSync('deploy');
        } else if (this.looksLikeRetrieveCommand(line)) {
          this.scheduleSync('retrieve');
        }
      })
    );
  }

  /**
   * Watches Salesforce source-tracking and deploy result artifacts.
   */
  private listenToSourceTrackingArtifacts(): void {
    const patterns = [
      '**/{deploy-result.json,.deploy-result.json,deployResult.json}',
      '**/.sf/**/maxRevision.json',
      '**/.sfdx/**/maxRevision.json',
      '**/.sf/**/sourceTrackingConfig.json',
      '**/.sf/**/localSourceTracking.json',
      '**/.sf/**/remoteSourceTracking.json',
    ];
    for (const pattern of patterns) {
      const watcher = vscode.workspace.createFileSystemWatcher(pattern);
      const onArtifact = (): void => this.scheduleSync('deploy');
      this.subscriptions.push(
        watcher,
        watcher.onDidCreate(onArtifact),
        watcher.onDidChange(onArtifact)
      );
    }
  }

  /**
   * Subscribes to VS Code task completion for Salesforce deploy/retrieve tasks.
   */
  private listenToSalesforceTasks(): void {
    this.subscriptions.push(
      vscode.tasks.onDidEndTaskProcess((event) => {
        if (event.exitCode !== 0) {
          return;
        }
        const task = event.execution.task;
        const label = `${task.name} ${task.source}`.toLowerCase();
        if (this.looksLikeDeployTask(label)) {
          this.scheduleSync('deploy');
        } else if (this.looksLikeRetrieveTask(label)) {
          this.scheduleSync('retrieve');
        }
      })
    );
  }

  /**
   * Tracks Salesforce Extension Pack command invocations and schedules sync
   * after a delay so the CLI/extension can finish writing files.
   */
  private listenToSalesforceCommands(): void {
    const commandsAny = vscode.commands as unknown as {
      onDidExecuteCommand?: (
        listener: (event: { command: string; arguments: unknown[] }) => void
      ) => vscode.Disposable;
    };

    if (typeof commandsAny.onDidExecuteCommand === 'function') {
      this.subscriptions.push(
        commandsAny.onDidExecuteCommand((event) => {
          if (SF_DEPLOY_COMMANDS.includes(event.command as (typeof SF_DEPLOY_COMMANDS)[number])) {
            this.scheduleSync('deploy', 3000);
          } else if (
            SF_RETRIEVE_COMMANDS.includes(event.command as (typeof SF_RETRIEVE_COMMANDS)[number])
          ) {
            this.scheduleSync('retrieve', 3000);
          }
        })
      );
    }

    this.subscriptions.push(
      vscode.commands.registerCommand(
        'salesforceCompare.notifyDeploySucceeded',
        () => this.notifyDeploySucceeded()
      ),
      vscode.commands.registerCommand(
        'salesforceCompare.notifyRetrieveSucceeded',
        () => this.notifyRetrieveSucceeded()
      )
    );
  }

  /**
   * When eligible source files change on disk and the editor is not dirty,
   * treat it as an external retrieve/update and sync status from local content.
   */
  private listenToEligibleFileChanges(): void {
    const watcher = vscode.workspace.createFileSystemWatcher(
      '**/{force-app,src}/**/*.{cls,trigger,js,html,css,xml,page,component}'
    );

    const onExternalChange = (uri: vscode.Uri): void => {
      if (!this.compareService.isEligible(uri)) {
        return;
      }
      const openDoc = vscode.workspace.textDocuments.find(
        (doc) => doc.uri.toString() === uri.toString()
      );
      if (openDoc?.isDirty) {
        return;
      }
      this.scheduleFileSync(uri, 600);
    };

    this.subscriptions.push(
      watcher,
      watcher.onDidChange(onExternalChange),
      watcher.onDidCreate(onExternalChange)
    );
  }

  /**
   * Returns whether a command line looks like an sf/sfdx deploy invocation.
   *
   * @param commandLine - Shell command line text.
   * @returns True when the command appears to be a project deploy.
   */
  private looksLikeDeployCommand(commandLine: string): boolean {
    const lower = commandLine.toLowerCase();
    if (lower.includes('retrieve') || lower.includes('project delete')) {
      return false;
    }
    return (
      lower.includes('project deploy') ||
      lower.includes('force:source:deploy') ||
      lower.includes('force source deploy') ||
      lower.includes('force:source:push') ||
      lower.includes('project push') ||
      lower.includes('deploy start') ||
      (lower.includes('sf ') && lower.includes('deploy')) ||
      (lower.includes('sfdx ') && lower.includes('deploy'))
    );
  }

  /**
   * Returns whether a command line looks like an sf/sfdx retrieve invocation.
   *
   * @param commandLine - Shell command line text.
   * @returns True when the command appears to be a retrieve/pull.
   */
  private looksLikeRetrieveCommand(commandLine: string): boolean {
    const lower = commandLine.toLowerCase();
    if (lower.includes('deploy') || lower.includes('project delete')) {
      return false;
    }
    return (
      lower.includes('project retrieve') ||
      lower.includes('force:source:pull') ||
      lower.includes('force source pull') ||
      lower.includes('force:source:retrieve') ||
      lower.includes('force source retrieve') ||
      lower.includes('retrieve start') ||
      (lower.includes('sf ') && lower.includes('retrieve')) ||
      (lower.includes('sfdx ') && lower.includes('retrieve')) ||
      (lower.includes('sf ') && lower.includes(' pull'))
    );
  }

  /**
   * Returns whether a VS Code task label looks like a Salesforce deploy task.
   *
   * @param label - Lowercase task name and source combined.
   * @returns True when the task likely performed a deploy.
   */
  private looksLikeDeployTask(label: string): boolean {
    if (label.includes('retrieve') || label.includes('pull')) {
      return false;
    }
    const isSalesforceTask =
      label.includes('salesforce') ||
      label.includes('sfdx') ||
      label.includes('sf ') ||
      label.includes('sf:');
    const isDeployAction =
      label.includes('deploy') ||
      label.includes('push') ||
      label.includes('deploy this source');
    return isSalesforceTask && isDeployAction;
  }

  /**
   * Returns whether a VS Code task label looks like a Salesforce retrieve task.
   *
   * @param label - Lowercase task name and source combined.
   * @returns True when the task likely performed a retrieve.
   */
  private looksLikeRetrieveTask(label: string): boolean {
    if (label.includes('deploy') || label.includes('push')) {
      return false;
    }
    const isSalesforceTask =
      label.includes('salesforce') ||
      label.includes('sfdx') ||
      label.includes('sf ') ||
      label.includes('sf:');
    const isRetrieveAction =
      label.includes('retrieve') ||
      label.includes('pull') ||
      label.includes('retrieve this source') ||
      label.includes('retrieve source');
    return isSalesforceTask && isRetrieveAction;
  }

  private readonly fileSyncTimers = new Map<string, NodeJS.Timeout>();

  /**
   * Debounces sync for a single file changed externally on disk.
   *
   * @param uri - Changed file URI.
   * @param delayMs - Delay before syncing.
   */
  private scheduleFileSync(uri: vscode.Uri, delayMs: number): void {
    const key = uri.toString();
    const existing = this.fileSyncTimers.get(key);
    if (existing) {
      clearTimeout(existing);
    }
    this.fileSyncTimers.set(
      key,
      setTimeout(() => {
        this.fileSyncTimers.delete(key);
        void this.compareService.syncLocalWithOrgSnapshot(uri);
      }, delayMs)
    );
  }

  /**
   * Debounces sync of all open eligible files after deploy/retrieve signals.
   *
   * @param operation - Whether deploy or retrieve was detected.
   * @param delayMs - Delay before syncing (allows CLI/extension to finish).
   */
  private scheduleSync(operation: SyncOperation, delayMs = 2000): void {
    this.pendingOperation = operation;
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
    }
    this.syncTimer = setTimeout(() => {
      void this.runScheduledSync(this.pendingOperation ?? operation);
    }, delayMs);
  }

  /**
   * Syncs open eligible files after deploy or retrieve.
   *
   * @param operation - Detected operation type.
   */
  private async runScheduledSync(operation: SyncOperation): Promise<void> {
    if (operation === 'deploy' || operation === 'retrieve') {
      await this.compareService.syncOpenEligibleFilesWithOrg();
    }
  }

  /**
   * Manually notifies the watcher that a deploy succeeded.
   */
  public notifyDeploySucceeded(): void {
    this.scheduleSync('deploy', 500);
  }

  /**
   * Manually notifies the watcher that a retrieve succeeded.
   */
  public notifyRetrieveSucceeded(): void {
    this.scheduleSync('retrieve', 500);
  }

  /**
   * Disposes timers and subscriptions.
   */
  public dispose(): void {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
    }
    for (const timer of this.fileSyncTimers.values()) {
      clearTimeout(timer);
    }
    this.fileSyncTimers.clear();
    for (const sub of this.subscriptions) {
      sub.dispose();
    }
  }
}
