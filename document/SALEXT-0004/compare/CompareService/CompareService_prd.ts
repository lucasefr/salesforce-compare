import * as vscode from 'vscode';
import { ContentHashUtil } from '../infrastructure/ContentHashUtil';
import { OrgSnapshotCache } from '../infrastructure/OrgSnapshotCache';
import { SfCliAdapter } from '../infrastructure/SfCliAdapter';
import { SalesforcePathMapper } from '../util/SalesforcePathMapper';
import { FileStatusEntry, FileStatusStore, FileSyncStatus } from './FileStatusStore';
import { OrgResolver } from './OrgResolver';

/** Default parallel Org retrieves; keeps CLI stable while allowing overlap. */
const DEFAULT_MAX_CONCURRENT_COMPARES = 2;

/**
 * Queued compare job. Multiple waiters can share one job for the same URI.
 */
interface QueuedCompareJob {
  uri: vscode.Uri;
  force: boolean;
  resolvers: Array<() => void>;
}

/**
 * Orchestrates retrieve ÔåÆ cache ÔåÆ hash ÔåÆ status updates for eligible files.
 * Never performs deploy operations.
 *
 * Compares run on a background queue: opening another file enqueues a new job
 * without cancelling jobs already running or waiting.
 */
export class CompareService {
  // SALEXT-0003 - start
  private readonly queue: QueuedCompareJob[] = [];
  private readonly queuedByKey = new Map<string, QueuedCompareJob>();
  private readonly runningByKey = new Map<string, Promise<void>>();
  private activeWorkers = 0;
  private readonly _onQueueChanged = new vscode.EventEmitter<void>();
  /** Fires when the background compare queue depth or running set changes. */
  public readonly onQueueChanged = this._onQueueChanged.event;
  // SALEXT-0003 - end

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
   * Returns how many compare jobs are waiting or actively retrieving.
   *
   * @returns Count of queued + running background compares.
   */
  // SALEXT-0003 - start
  public getBackgroundJobCount(): number {
    return this.queuedByKey.size + this.runningByKey.size;
  }
  // SALEXT-0003 - end

  /**
   * Enqueues a compare of a local file with the Org version (retrieve + hash).
   * Does not cancel other files' jobs when a new file is opened or focused.
   * Concurrent requests for the same URI share one job unless `force` is set.
   *
   * @param uri - Local file URI to compare.
   * @param options - Optional flags; `force` schedules a fresh compare even if one is running/queued.
   * @returns Promise that resolves when this URI's status has been updated.
   */
  public async compareFile(
    uri: vscode.Uri,
    options?: { force?: boolean }
  ): Promise<void> {
    if (!this.isEnabled() || !this.isEligible(uri)) {
      return;
    }

    const key = SalesforcePathMapper.toCacheKey(uri);
    const force = options?.force === true;

    // SALEXT-0003 - start
    if (!force) {
      const running = this.runningByKey.get(key);
      if (running) {
        return running;
      }
      const queued = this.queuedByKey.get(key);
      if (queued) {
        return new Promise<void>((resolve) => {
          queued.resolvers.push(resolve);
        });
      }
    } else {
      const running = this.runningByKey.get(key);
      if (running) {
        await running;
        return this.compareFile(uri, { force: true });
      }
      const queued = this.queuedByKey.get(key);
      if (queued) {
        queued.force = true;
        return new Promise<void>((resolve) => {
          queued.resolvers.push(resolve);
        });
      }
    }

    this.store.setStatus(uri, 'checking');

    return new Promise<void>((resolve) => {
      const job: QueuedCompareJob = {
        uri,
        force,
        resolvers: [resolve],
      };
      this.queue.push(job);
      this.queuedByKey.set(key, job);
      this.emitQueueChanged();
      this.pumpQueue();
    });
    // SALEXT-0003 - end
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
   * Returns the stored sync status entry for a URI, if any.
   *
   * @param uri - File URI.
   * @returns Status entry or undefined when the file was never compared.
   */
  // SALEXT-0003 - start
  public getFileStatus(uri: vscode.Uri): FileStatusEntry | undefined {
    return this.store.get(uri);
  }

  /**
   * Maps a sync status to a short, user-facing compare result label.
   *
   * @param status - Sync status or undefined.
   * @returns Label such as "Equal to Org" or "Different from Org".
   */
  public formatCompareResultLabel(status: FileSyncStatus | undefined): string {
    switch (status) {
      case 'synced':
        return 'Equal to Org';
      case 'outdated':
        return 'Different from Org';
      case 'checking':
        return 'Comparing with OrgÔÇª';
      case 'error':
        return 'Compare failed';
      case 'unknown':
        return 'Status unknown';
      default:
        return 'Not compared yet';
    }
  }
  // SALEXT-0003 - end

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
    const background = this.getBackgroundJobCount();
    const backgroundPart =
      background > 0 ? ` ┬À Background: ${background} file(s) comparing` : '';
    // SALEXT-0003 - start
    const resultLabel = this.formatCompareResultLabel(entry?.status);
    if (timestamp === undefined && !entry) {
      return `No Org comparison has been run yet.${backgroundPart}`;
    }
    const age =
      timestamp !== undefined ? this.formatAge(timestamp) : 'n/a';
    const orgPart = org ? ` ┬À Org: ${org}` : '';
    const detail = entry?.message ? ` ÔÇö ${entry.message}` : '';
    return `${resultLabel} ┬À Last check: ${age}${orgPart}${detail}${backgroundPart}`;
    // SALEXT-0003 - end
  }

  /**
   * Starts queued compare workers up to the configured concurrency limit.
   * Never drops or cancels jobs already running or waiting.
   */
  // SALEXT-0003 - start
  private pumpQueue(): void {
    const maxConcurrent = this.getMaxConcurrentCompares();

    while (this.activeWorkers < maxConcurrent && this.queue.length > 0) {
      const job = this.queue.shift();
      if (!job) {
        break;
      }

      const key = SalesforcePathMapper.toCacheKey(job.uri);
      this.queuedByKey.delete(key);
      this.activeWorkers += 1;

      const work = this.runCompare(job.uri)
        .catch(() => undefined)
        .finally(() => {
          this.runningByKey.delete(key);
          this.activeWorkers = Math.max(0, this.activeWorkers - 1);
          for (const resolve of job.resolvers) {
            resolve();
          }
          this.emitQueueChanged();
          this.pumpQueue();
        });

      this.runningByKey.set(key, work);
      this.emitQueueChanged();
    }
  }

  /**
   * Reads the max concurrent compare setting (minimum 1).
   *
   * @returns Maximum number of parallel Org retrieves.
   */
  private getMaxConcurrentCompares(): number {
    const configured = vscode.workspace
      .getConfiguration('salesforceCompare')
      .get<number>('maxConcurrentCompares', DEFAULT_MAX_CONCURRENT_COMPARES);
    if (!Number.isFinite(configured) || configured < 1) {
      return DEFAULT_MAX_CONCURRENT_COMPARES;
    }
    return Math.floor(configured);
  }

  /**
   * Notifies listeners that queue/running job counts changed.
   */
  private emitQueueChanged(): void {
    this._onQueueChanged.fire();
  }
  // SALEXT-0003 - end

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
