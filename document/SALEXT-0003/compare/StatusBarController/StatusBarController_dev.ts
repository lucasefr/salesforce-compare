import * as vscode from 'vscode';
import { CompareService } from '../services/CompareService';
import { FileStatusStore, FileSyncStatus } from '../services/FileStatusStore';

/**
 * Status bar item showing the Org comparison result for the active file
 * (Equal / Different) with severity colors when possible.
 */
export class StatusBarController implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;
  private readonly subscriptions: vscode.Disposable[] = [];

  /**
   * Creates and shows the status bar controller.
   *
   * @param store - File status store.
   * @param compareService - Compare service for formatted last-check text.
   */
  constructor(
    private readonly store: FileStatusStore,
    private readonly compareService: CompareService
  ) {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      50
    );
    this.item.command = 'salesforceCompare.showLastCheck';
    this.item.show();

    this.subscriptions.push(
      this.store.onDidChange(() => this.refresh()),
      // SALEXT-0003 - start
      this.compareService.onQueueChanged(() => this.refresh()),
      // SALEXT-0003 - end
      vscode.window.onDidChangeActiveTextEditor(() => this.refresh())
    );
    this.refresh();
  }

  /**
   * Refreshes the status bar text, color, and tooltip for the active editor.
   */
  public refresh(): void {
    const editor = vscode.window.activeTextEditor;
    const backgroundJobs = this.compareService.getBackgroundJobCount();

    if (!editor || !this.compareService.isEligible(editor.document.uri)) {
      this.clearSeverityColors();
      // SALEXT-0003 - start
      if (backgroundJobs > 0) {
        this.item.text = `$(sync~spin) SF Compare (${backgroundJobs})`;
        this.item.tooltip = `Salesforce Compare — ${backgroundJobs} file(s) comparing in background`;
        return;
      }
      // SALEXT-0003 - end
      this.item.text = '$(git-compare) SF Compare';
      this.item.tooltip = 'Salesforce Compare — open a Salesforce source file';
      return;
    }

    const entry = this.store.get(editor.document.uri);
    const status = entry?.status;
    const resultLabel = this.compareService.formatCompareResultLabel(status);
    const icon = this.iconFor(status, backgroundJobs);
    const info = this.compareService.formatLastCheckInfo(editor.document.uri);
    const queueSuffix = backgroundJobs > 1 ? ` (${backgroundJobs})` : '';

    // SALEXT-0003 - start
    this.applySeverityColors(status);
    this.item.text = `${icon} ${this.shortResultText(status)}${queueSuffix}`;
    this.item.tooltip = `Salesforce Compare — ${resultLabel}\n${info}`;
    // SALEXT-0003 - end
  }

  /**
   * Short status bar label for the compare result.
   *
   * @param status - Sync status or undefined.
   * @returns Compact label shown next to the icon.
   */
  // SALEXT-0003 - start
  private shortResultText(status: FileSyncStatus | undefined): string {
    switch (status) {
      case 'synced':
        return 'SF Equal';
      case 'outdated':
        return 'SF Different';
      case 'checking':
        return 'SF Comparing…';
      case 'error':
        return 'SF Error';
      default:
        return 'SF Compare';
    }
  }

  /**
   * Applies status-bar background colors for different/error states.
   * VS Code only allows warning/error backgrounds on status bar items;
   * equal/synced uses the default bar (green is conveyed by the icon).
   *
   * @param status - Sync status or undefined.
   */
  private applySeverityColors(status: FileSyncStatus | undefined): void {
    switch (status) {
      case 'outdated':
        this.item.backgroundColor = new vscode.ThemeColor(
          'statusBarItem.errorBackground'
        );
        this.item.color = new vscode.ThemeColor('statusBarItem.errorForeground');
        break;
      case 'error':
        this.item.backgroundColor = new vscode.ThemeColor(
          'statusBarItem.errorBackground'
        );
        this.item.color = new vscode.ThemeColor('statusBarItem.errorForeground');
        break;
      case 'checking':
        this.item.backgroundColor = new vscode.ThemeColor(
          'statusBarItem.warningBackground'
        );
        this.item.color = new vscode.ThemeColor(
          'statusBarItem.warningForeground'
        );
        break;
      default:
        this.clearSeverityColors();
        break;
    }
  }

  /**
   * Clears status-bar severity colors (equal / idle states).
   */
  private clearSeverityColors(): void {
    this.item.backgroundColor = undefined;
    this.item.color = undefined;
  }
  // SALEXT-0003 - end

  /**
   * Maps status to a Codicon in the status bar text.
   *
   * @param status - Sync status or undefined.
   * @param backgroundJobs - Number of queued/running compares.
   * @returns Codicon markdown string.
   */
  private iconFor(status: string | undefined, backgroundJobs = 0): string {
    switch (status) {
      case 'synced':
        return '$(pass-filled)';
      case 'outdated':
        return '$(diff)';
      case 'checking':
        return '$(sync~spin)';
      case 'error':
        return '$(error)';
      default:
        return backgroundJobs > 0 ? '$(sync~spin)' : '$(git-compare)';
    }
  }

  /**
   * Disposes the status bar item and listeners.
   */
  public dispose(): void {
    for (const sub of this.subscriptions) {
      sub.dispose();
    }
    this.item.dispose();
  }
}
