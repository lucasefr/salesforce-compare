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
   * @returns Snapshot entry written to disk.
   */
  public async put(
    uri: vscode.Uri,
    orgContent: string,
    orgHash: string,
    targetOrg: string
  ): Promise<SnapshotEntry> {
    const key = SalesforcePathMapper.toCacheKey(uri);
    const safeName = Buffer.from(key).toString('base64url').slice(0, 80);
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
   * @returns Snapshot entry or undefined.
   */
  public get(uri: vscode.Uri): SnapshotEntry | undefined {
    return this.index.get(SalesforcePathMapper.toCacheKey(uri));
  }

  /**
   * Reads the cached Org content from disk for a URI.
   *
   * @param uri - Local file URI.
   * @returns Org content string, or undefined when missing.
   */
  public async readContent(uri: vscode.Uri): Promise<string | undefined> {
    const entry = this.get(uri);
    if (!entry) {
      return undefined;
    }
    try {
      return await fs.readFile(entry.cacheFilePath, 'utf8');
    } catch {
      this.index.delete(SalesforcePathMapper.toCacheKey(uri));
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
}
