import * as vscode from 'vscode';
import { SalesforcePathMapper } from '../util/SalesforcePathMapper';

export type FileSyncStatus =
  | 'synced'
  | 'outdated'
  | 'unknown'
  | 'checking'
  | 'error';

export interface FileStatusEntry {
  status: FileSyncStatus;
  lastCheckedAt?: number;
  targetOrg?: string;
  message?: string;
}

/**
 * In-memory store of per-file Org sync status. Emits events when status changes
 * so decorations and the status bar can refresh.
 */
export class FileStatusStore {
  private readonly entries = new Map<string, FileStatusEntry>();
  private readonly _onDidChange = new vscode.EventEmitter<vscode.Uri | undefined>();

  /** Fires with the affected URI, or undefined when the entire store changed. */
  public readonly onDidChange = this._onDidChange.event;

  /**
   * Returns the status entry for a URI, if present.
   *
   * @param uri - File URI.
   * @returns Status entry or undefined.
   */
  public get(uri: vscode.Uri): FileStatusEntry | undefined {
    return this.entries.get(SalesforcePathMapper.toCacheKey(uri));
  }

  /**
   * Sets or replaces the status for a URI and notifies listeners.
   *
   * @param uri - File URI.
   * @param entry - New status entry.
   */
  public set(uri: vscode.Uri, entry: FileStatusEntry): void {
    this.entries.set(SalesforcePathMapper.toCacheKey(uri), entry);
    this._onDidChange.fire(uri);
  }

  /**
   * Updates only the status field while preserving other metadata when possible.
   *
   * @param uri - File URI.
   * @param status - New sync status.
   * @param message - Optional message (cleared when omitted and status is not error).
   */
  public setStatus(uri: vscode.Uri, status: FileSyncStatus, message?: string): void {
    const existing = this.get(uri);
    this.set(uri, {
      status,
      lastCheckedAt: existing?.lastCheckedAt,
      targetOrg: existing?.targetOrg,
      message: message ?? (status === 'error' ? existing?.message : undefined),
    });
  }

  /**
   * Returns the most recent lastCheckedAt across all tracked files.
   *
   * @returns Epoch ms or undefined when nothing was checked yet.
   */
  public getLatestCheckTimestamp(): number | undefined {
    let latest: number | undefined;
    for (const entry of this.entries.values()) {
      if (entry.lastCheckedAt !== undefined) {
        if (latest === undefined || entry.lastCheckedAt > latest) {
          latest = entry.lastCheckedAt;
        }
      }
    }
    return latest;
  }

  /**
   * Lists all URIs currently tracked with a known status.
   *
   * @returns Array of URI strings (cache keys).
   */
  public getTrackedKeys(): string[] {
    return [...this.entries.keys()];
  }

  /**
   * Clears all status entries and notifies listeners.
   */
  public clear(): void {
    this.entries.clear();
    this._onDidChange.fire(undefined);
  }

  /**
   * Disposes the underlying event emitter.
   */
  public dispose(): void {
    this._onDidChange.dispose();
  }
}
