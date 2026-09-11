import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';
import { SalesforcePathMapper } from '../util/SalesforcePathMapper';

export interface SnapshotEntry {
  /** Absolute path of the cached Org file copy. */
  cacheFilePath: string;
  /** SHA-256 of the Org content at retrieve time. */
  orgHash: string;
  /** Org alias/username used for the retrieve. */
  targetOrg: string;
  /** Epoch ms when the snapshot was stored. */
  retrievedAt: number;
}

/**
 * Persists retrieved Org file snapshots under the extension global storage
 * so they never pollute the user's Salesforce project.
 */
export class OrgSnapshotCache {
  private readonly cacheRoot: string;
  private readonly index = new Map<string, SnapshotEntry>();

  /**
   * Creates a cache bound to the extension's global storage path.
   *
   * @param storageUri - Extension globalStorageUri from ExtensionContext.
   */
  constructor(storageUri: vscode.Uri) {
    this.cacheRoot = path.join(storageUri.fsPath, 'org-snapshots');
  }

  /**
   * Ensures the cache directory exists on disk.
   *
   * @returns Promise that resolves when the directory is ready.
   */
  public async initialize(): Promise<void> {
    await fs.mkdir(this.cacheRoot, { recursive: true });
  }

  /**
   * Stores Org content for a local file URI and returns the snapshot metadata.
   *
   * @param uri - Local file URI being compared.
   * @param orgContent - Content retrieved from the Org.
   * @param orgHash - Precomputed hash of the Org content.
   * @param targetOrg - Org alias/username used for retrieve.
   * @param options - When `scopeByOrg` is true, the snapshot is keyed by URI+Org
   *   (used for secondary Org diffs). Primary auto-check keeps the default URI key.
   * @returns Snapshot entry written to disk.
   */
  public async put(
    uri: vscode.Uri,
    orgContent: string,
    orgHash: string,
    targetOrg: string,
    // SALEXT-0004 - start
    options?: { scopeByOrg?: boolean }
    // SALEXT-0004 - end
  ): Promise<SnapshotEntry> {
    const key = this.buildKey(uri, options?.scopeByOrg ? targetOrg : undefined);
    const safeName = Buffer.from(key).toString('base64url').slice(0, 100);
    const cacheFilePath = path.join(this.cacheRoot, `${safeName}.snapshot`);
    await fs.writeFile(cacheFilePath, orgContent, 'utf8');

    const entry: SnapshotEntry = {
      cacheFilePath,
      orgHash,
      targetOrg,
      retrievedAt: Date.now(),
    };
    this.index.set(key, entry);
    return entry;
  }

  /**
   * Returns the in-memory snapshot entry for a URI, if any.
   *
   * @param uri - Local file URI.
   * @param targetOrg - Optional Org alias for secondary-org scoped snapshots.
   * @returns Snapshot entry or undefined.
   */
  public get(uri: vscode.Uri, targetOrg?: string): SnapshotEntry | undefined {
    return this.index.get(this.buildKey(uri, targetOrg));
  }

  /**
   * Reads the cached Org content from disk for a URI.
   *
   * @param uri - Local file URI.
   * @param targetOrg - Optional Org alias for secondary-org scoped snapshots.
   * @returns Org content string, or undefined when missing.
   */
  public async readContent(
    uri: vscode.Uri,
    targetOrg?: string
  ): Promise<string | undefined> {
    const entry = this.get(uri, targetOrg);
    if (!entry) {
      return undefined;
    }
    try {
      return await fs.readFile(entry.cacheFilePath, 'utf8');
    } catch {
      this.index.delete(this.buildKey(uri, targetOrg));
      return undefined;
    }
  }

  /**
   * Removes all cached snapshots from memory and disk.
   *
   * @returns Promise that resolves when cleanup finishes.
   */
  public async clear(): Promise<void> {
    this.index.clear();
    await fs.rm(this.cacheRoot, { recursive: true, force: true });
    await fs.mkdir(this.cacheRoot, { recursive: true });
  }

  // SALEXT-0004 - start
  /**
   * Builds the cache index key for a local URI and optional Org scope.
   *
   * @param uri - Local file URI.
   * @param targetOrg - When set, scopes the key to that Org (comparison Orgs).
   * @returns Stable cache key string.
   */
  private buildKey(uri: vscode.Uri, targetOrg?: string): string {
    const base = SalesforcePathMapper.toCacheKey(uri);
    if (!targetOrg) {
      return base;
    }
    return `${base}::org=${targetOrg}`;
  }
  // SALEXT-0004 - end
}
