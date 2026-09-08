import * as vscode from 'vscode';
import { CompareService } from '../services/CompareService';
import { FileStatusStore } from '../services/FileStatusStore';

/**
 * Status bar item showing the last Org comparison age and current file status.
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
      vscode.window.onDidChangeActiveTextEditor(() => this.refresh())
    );
    this.refresh();
  }

  /**
   * Refreshes the status bar text for the active editor.
   */
  public refresh(): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !this.compareService.isEligible(editor.document.uri)) {
      this.item.text = '$(git-compare) SF Compare';
      this.item.tooltip = 'Salesforce Compare — open a Salesforce source file';
      return;
    }

    const entry = this.store.get(editor.document.uri);
    const icon = this.iconFor(entry?.status);
    const info = this.compareService.formatLastCheckInfo(editor.document.uri);
    this.item.text = `${icon} SF Compare`;
    this.item.tooltip = info;
  }

  /**
   * Maps status to a Codicon in the status bar text.
   *
   * @param status - Sync status or undefined.
   * @returns Codicon markdown string.
   */
  private iconFor(status: string | undefined): string {
    switch (status) {
      case 'synced':
        return '$(pass-filled)';
      case 'outdated':
        return '$(warning)';
      case 'checking':
        return '$(sync~spin)';
      case 'error':
        return '$(error)';
      default:
        return '$(git-compare)';
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
