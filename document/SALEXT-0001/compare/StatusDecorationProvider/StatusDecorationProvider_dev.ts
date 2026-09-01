import * as vscode from 'vscode';
import { FileStatusStore, FileSyncStatus } from '../services/FileStatusStore';

/**
 * Decorates eligible files in the Explorer and editor tabs with a colored
 * badge indicating Org sync status (green synced / red outdated).
 */
export class StatusDecorationProvider implements vscode.FileDecorationProvider {
  private readonly _onDidChangeFileDecorations = new vscode.EventEmitter<
    vscode.Uri | vscode.Uri[] | undefined
  >();
  public readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

  /**
   * Creates the decoration provider.
   *
   * @param store - File status store to read sync state from.
   */
  constructor(private readonly store: FileStatusStore) {
    store.onDidChange((uri) => {
      this._onDidChangeFileDecorations.fire(uri);
    });
  }

  /**
   * Provides a file decoration for the given URI based on sync status.
   *
   * @param uri - File URI.
   * @returns FileDecoration or undefined when the file is not tracked.
   */
  public provideFileDecoration(
    uri: vscode.Uri
  ): vscode.ProviderResult<vscode.FileDecoration> {
    const entry = this.store.get(uri);
    if (!entry) {
      return undefined;
    }
    return this.decorationFor(entry.status, entry.message, entry.lastCheckedAt);
  }

  /**
   * Maps a sync status to a VS Code FileDecoration (badge + color + tooltip).
   *
   * @param status - Sync status.
   * @param message - Optional error/detail message.
   * @param lastCheckedAt - Optional last check timestamp.
   * @returns FileDecoration instance.
   */
  private decorationFor(
    status: FileSyncStatus,
    message?: string,
    lastCheckedAt?: number
  ): vscode.FileDecoration {
    const age =
      lastCheckedAt !== undefined
        ? ` · checked ${new Date(lastCheckedAt).toLocaleTimeString()}`
        : '';

    switch (status) {
      case 'synced':
        return {
          badge: '●',
          tooltip: `In sync with Org${age}`,
          color: new vscode.ThemeColor('salesforceCompare.synced'),
          propagate: false,
        };
      case 'outdated':
        return {
          badge: '●',
          tooltip: `Out of sync with Org${age}${message ? ` — ${message}` : ''}`,
          color: new vscode.ThemeColor('salesforceCompare.outdated'),
          propagate: false,
        };
      case 'checking':
        return {
          badge: '…',
          tooltip: 'Comparing with Org…',
          color: new vscode.ThemeColor('salesforceCompare.checking'),
          propagate: false,
        };
      case 'error':
        return {
          badge: '!',
          tooltip: `Compare error${message ? `: ${message}` : ''}`,
          color: new vscode.ThemeColor('salesforceCompare.error'),
          propagate: false,
        };
      case 'unknown':
      default:
        return {
          badge: '?',
          tooltip: message || 'Org sync status unknown',
          color: new vscode.ThemeColor('salesforceCompare.checking'),
          propagate: false,
        };
    }
  }

  /**
   * Disposes the decoration change emitter.
   */
  public dispose(): void {
    this._onDidChangeFileDecorations.dispose();
  }
}
