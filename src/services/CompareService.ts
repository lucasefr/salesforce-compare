import * as vscode from 'vscode';
import { ContentHashUtil } from '../infrastructure/ContentHashUtil';
import { OrgSnapshotCache } from '../infrastructure/OrgSnapshotCache';
import { SfCliAdapter } from '../infrastructure/SfCliAdapter';
import { SalesforcePathMapper } from '../util/SalesforcePathMapper';
import { FileStatusStore } from './FileStatusStore';
import { OrgResolver } from './OrgResolver';

/**
 * Orchestrates retrieve → cache → hash → status updates for eligible files.
 * Never performs deploy operations.
 */
export class CompareService {
  private readonly inFlight = new Map<string, Promise<void>>();
  private cliMissingNotified = false;

  /**
   * Creates the compare orchestrator.
   *
   * @param sfCli - Salesforce CLI adapter.
   * @param orgResolver - Resolves target org alias/username.
   * @param cache - Snapshot cache for Org content.
   * @param store - Per-file sync status store.
   */
  constructor(
    private readonly sfCli: SfCliAdapter,
    private readonly orgResolver: OrgResolver,
    private readonly cache: OrgSnapshotCache,
    private readonly store: FileStatusStore
  ) {}

  /**
   * Returns whether automatic checks are enabled in settings.
   *
   * @returns True when the extension is enabled.
   */
  public isEnabled(): boolean {
    return vscode.workspace
      .getConfiguration('salesforceCompare')
      .get<boolean>('enabled', true);
  }

  /**
   * Returns whether a URI is eligible based on path layout and configured extensions.
   *
   * @param uri - File URI.
   * @returns True when the file can be compared with the Org.
   */
  public isEligible(uri: vscode.Uri): boolean {
    const extensions = vscode.workspace
      .getConfiguration('salesforceCompare')
      .get<string[]>('supportedExtensions');
    return SalesforcePathMapper.isEligibleFile(uri, extensions);
  }

  /**
   * Compares a local file with the Org version (retrieve + hash).
   * Concurrent calls for the same URI share the same in-flight promise unless forced.
   *
   * @param uri - Local file URI to compare.
   * @param options - Optional flags; `force` starts a fresh compare even if one is running.
   * @returns Promise that resolves when status has been updated.
   */
  public async compareFile(
    uri: vscode.Uri,
    options?: { force?: boolean }
  ): Promise<void> {
    if (!this.isEnabled() || !this.isEligible(uri)) {
      return;
    }

    const key = SalesforcePathMapper.toCacheKey(uri);
    if (!options?.force) {
      const existing = this.inFlight.get(key);
      if (existing) {
        return existing;
      }
    }

    const work = this.runCompare(uri).finally(() => {
      this.inFlight.delete(key);
    });
    this.inFlight.set(key, work);
    return work;
  }

  /**
   * Ensures a fresh Org snapshot exists and returns the Org content for diffing.
   *
   * @param uri - Local file URI.
   * @returns Org content string.
   * @throws Error when retrieve fails.
   */
  public async ensureOrgContent(uri: vscode.Uri): Promise<string> {
    await this.compareFile(uri, { force: true });
    const content = await this.cache.readContent(uri);
    if (content === undefined) {
      const entry = this.store.get(uri);
      throw new Error(entry?.message || 'Unable to load Org content for diff.');
    }
    return content;
  }

  /**
   * Marks a file as synced by treating the current local content as the Org snapshot.
   * Used after successful deploy or retrieve when local and Org are known to match.
   *
   * @param uri - Local file URI.
   * @returns Promise that resolves when cache and status are updated.
   */
  public async syncLocalWithOrgSnapshot(uri: vscode.Uri): Promise<void> {
    if (!this.isEligible(uri)) {
      return;
    }

    const folder = SalesforcePathMapper.getWorkspaceFolder(uri);
    if (!folder) {
      return;
    }

    const localContent = await this.readLocalContent(uri);
    const orgHash = ContentHashUtil.hash(localContent);
    const targetOrg =
      (await this.orgResolver.resolveTargetOrg(folder.uri.fsPath)) ?? 'default';

    await this.cache.put(uri, localContent, orgHash, targetOrg);
    this.store.set(uri, {
      status: 'synced',
      lastCheckedAt: Date.now(),
      targetOrg,
    });
  }

  /**
   * Marks all open eligible files as synced with the Org using their local content.
   *
   * @returns Promise that resolves when all files are processed.
   */
  public async syncOpenEligibleFilesWithOrg(): Promise<void> {
    const docs = vscode.workspace.textDocuments.filter(
      (doc) => !doc.isUntitled && this.isEligible(doc.uri)
    );
    await Promise.all(docs.map((doc) => this.syncLocalWithOrgSnapshot(doc.uri)));
  }

  /**
   * Re-evaluates status after a local save without calling retrieve.
   * Compares the saved buffer to the last Org snapshot hash.
   *
   * @param uri - Saved file URI.
   * @param localContent - Content that was saved.
   */
  public markFromLocalSave(uri: vscode.Uri, localContent: string): void {
    if (!this.isEligible(uri)) {
      return;
    }
    const snapshot = this.cache.get(uri);
    if (!snapshot) {
      this.store.setStatus(uri, 'outdated', 'Local file changed; Org not checked yet.');
      return;
    }
    const localHash = ContentHashUtil.hash(localContent);
    if (localHash === snapshot.orgHash) {
      this.store.set(uri, {
        status: 'synced',
        lastCheckedAt: snapshot.retrievedAt,
        targetOrg: snapshot.targetOrg,
      });
    } else {
      this.store.set(uri, {
        status: 'outdated',
        lastCheckedAt: snapshot.retrievedAt,
        targetOrg: snapshot.targetOrg,
        message: 'Local changes differ from the last Org snapshot.',
      });
    }
  }

  /**
   * Re-compares all currently open eligible text documents (used after deploy).
   *
   * @returns Promise that resolves when all open-file compares finish.
   */
  public async recheckOpenEligibleFiles(): Promise<void> {
    const docs = vscode.workspace.textDocuments.filter(
      (doc) => !doc.isUntitled && this.isEligible(doc.uri)
    );
    await Promise.all(docs.map((doc) => this.compareFile(doc.uri, { force: true })));
  }

  /**
   * Formats a human-readable last-check summary for a URI or the global latest.
   *
   * @param uri - Optional file URI; when omitted uses the latest global check.
   * @returns Summary string for UI display.
   */
  public formatLastCheckInfo(uri?: vscode.Uri): string {
    const entry = uri ? this.store.get(uri) : undefined;
    const timestamp = entry?.lastCheckedAt ?? this.store.getLatestCheckTimestamp();
    const org = entry?.targetOrg;
    if (timestamp === undefined) {
      return 'No Org comparison has been run yet.';
    }
    const age = this.formatAge(timestamp);
    const orgPart = org ? ` · Org: ${org}` : '';
    const statusPart = entry ? ` · Status: ${entry.status}` : '';
    return `Last check: ${age}${orgPart}${statusPart}`;
  }

  /**
   * Reads local file content from the open editor or from disk.
   *
   * @param uri - Local file URI.
   * @returns Local file content as UTF-8 string.
   */
  private async readLocalContent(uri: vscode.Uri): Promise<string> {
    const openDoc = vscode.workspace.textDocuments.find(
      (doc) => doc.uri.toString() === uri.toString()
    );
    if (openDoc) {
      return openDoc.getText();
    }
    const bytes = await vscode.workspace.fs.readFile(uri);
    return Buffer.from(bytes).toString('utf8');
  }

  /**
   * Internal compare implementation.
   *
   * @param uri - File URI.
   */
  private async runCompare(uri: vscode.Uri): Promise<void> {
    this.store.setStatus(uri, 'checking');

    const folder = SalesforcePathMapper.getWorkspaceFolder(uri);
    if (!folder) {
      this.store.set(uri, {
        status: 'error',
        message: 'File is outside the workspace.',
      });
      return;
    }

    const relative = SalesforcePathMapper.getRelativeSourcePath(uri);
    if (!relative) {
      this.store.set(uri, {
        status: 'unknown',
        message: 'Unable to resolve relative source path.',
      });
      return;
    }

    const available = await this.sfCli.isCliAvailable();
    if (!available) {
      if (!this.cliMissingNotified) {
        this.cliMissingNotified = true;
        await this.sfCli.notifyCliMissing();
      }
      this.store.set(uri, {
        status: 'error',
        message: 'Salesforce CLI (sf) not found on PATH.',
      });
      return;
    }

    try {
      const targetOrg = await this.orgResolver.resolveTargetOrg(folder.uri.fsPath);
      const retrieved = await this.sfCli.retrieveMetadataToTemp(
        folder.uri.fsPath,
        relative,
        uri.fsPath,
        targetOrg
      );

      const orgHash = ContentHashUtil.hash(retrieved.content);
      await this.cache.put(uri, retrieved.content, orgHash, targetOrg ?? 'default');

      const localContent = await this.readLocalContent(uri);
      const equal = ContentHashUtil.areEqual(localContent, retrieved.content);
      this.store.set(uri, {
        status: equal ? 'synced' : 'outdated',
        lastCheckedAt: Date.now(),
        targetOrg: targetOrg ?? 'default',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.store.set(uri, {
        status: 'error',
        lastCheckedAt: Date.now(),
        message,
      });
    }
  }

  /**
   * Formats a timestamp as a relative age string.
   *
   * @param timestamp - Epoch milliseconds.
   * @returns Relative age such as "just now" or "5 min ago".
   */
  private formatAge(timestamp: number): string {
    const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (seconds < 10) {
      return 'just now';
    }
    if (seconds < 60) {
      return `${seconds}s ago`;
    }
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return `${minutes} min ago`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `${hours}h ago`;
    }
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }
}
