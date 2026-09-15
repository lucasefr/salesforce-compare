import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';

/**
 * Metadata for a comparison Org temp snapshot file.
 */
export interface ComparisonTempFileInfo {
  /** Absolute file URI of the temp snapshot. */
  uri: vscode.Uri;
  /** Comparison Org alias used for retrieve. */
  orgAlias: string;
  /** Original local file URI that was compared. */
  localUri: vscode.Uri;
}

/**
 * Creates and tracks temporary files that hold comparison-Org snapshots
 * (Local ↔ Other Org). Files live under extension storage and are decorated blue.
 * Never writes into the user's Salesforce project.
 */
export class ComparisonTempFileService {
  private readonly tempRoot: string;
  private readonly byUri = new Map<string, ComparisonTempFileInfo>();
  private readonly _onDidChangeFileDecorations = new vscode.EventEmitter<
    vscode.Uri | vscode.Uri[] | undefined
  >();
  /** Fires when blue decorations should refresh. */
  public readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

  /**
   * Creates the temp-file service.
   *
   * @param storageUri - Extension globalStorageUri (or storageUri) root.
   */
  constructor(storageUri: vscode.Uri) {
    this.tempRoot = path.join(storageUri.fsPath, 'comparison-org-temps');
  }

  /**
   * Ensures the temp directory exists.
   *
   * @returns Promise that resolves when the directory is ready.
   */
  public async initialize(): Promise<void> {
    await fs.mkdir(this.tempRoot, { recursive: true });
  }

  /**
   * Writes (or overwrites) a temp file with the comparison Org content and
   * registers it for blue tab/explorer labeling.
   *
   * @param localUri - Local workspace file being compared.
   * @param orgAlias - Comparison Org alias/username.
   * @param content - Retrieved Org file content.
   * @returns Info including the temp file URI.
   */
  public async createOrUpdate(
    localUri: vscode.Uri,
    orgAlias: string,
    content: string
  ): Promise<ComparisonTempFileInfo> {
    await this.initialize();

    const baseName = path.basename(localUri.fsPath);
    const parsed = path.parse(baseName);
    const safeOrg = this.sanitizeForFileName(orgAlias).toUpperCase();
    // SALEXT-0004 - start
    // Tab/diff label: MyClass.LOCAL_x_UAT.cls (Org snapshot; blue decoration).
    const fileName = `${parsed.name}.LOCAL_x_${safeOrg}${parsed.ext}`;
    // SALEXT-0004 - end
    const filePath = path.join(this.tempRoot, fileName);
    await fs.writeFile(filePath, content, 'utf8');

    const uri = vscode.Uri.file(filePath);
    const info: ComparisonTempFileInfo = {
      uri,
      orgAlias,
      localUri,
    };
    this.byUri.set(uri.toString(), info);
    this._onDidChangeFileDecorations.fire(uri);
    return info;
  }

  /**
   * Returns whether a URI is a tracked comparison-Org temp snapshot.
   *
   * @param uri - File URI to test.
   * @returns True when the file is a comparison temp snapshot.
   */
  public isComparisonTemp(uri: vscode.Uri): boolean {
    if (this.byUri.has(uri.toString())) {
      return true;
    }
    // Also match by path pattern after reload (decoration without in-memory map).
    const base = path.basename(uri.fsPath);
    return (
      uri.scheme === 'file' &&
      uri.fsPath.startsWith(this.tempRoot) &&
      (base.includes('.LOCAL_x_') || base.includes('.__from__'))
    );
  }

  /**
   * Returns metadata for a comparison temp URI, if tracked.
   *
   * @param uri - Temp file URI.
   * @returns Info or undefined.
   */
  public getInfo(uri: vscode.Uri): ComparisonTempFileInfo | undefined {
    return this.byUri.get(uri.toString());
  }

  /**
   * Builds the short compare label used in titles: `LOCAL x UAT`.
   *
   * @param orgAlias - Comparison Org alias.
   * @returns Label such as `LOCAL x UAT`.
   */
  public static formatLocalVsOrgLabel(orgAlias: string): string {
    const org = orgAlias.trim().toUpperCase() || 'ORG';
    return `LOCAL x ${org}`;
  }

  /**
   * Builds a human-readable label for tabs/tooltips.
   *
   * @param orgAlias - Comparison Org alias.
   * @returns Label such as `LOCAL x UAT (comparison snapshot)`.
   */
  public static formatOrgLabel(orgAlias: string): string {
    return `${ComparisonTempFileService.formatLocalVsOrgLabel(orgAlias)} (comparison snapshot)`;
  }

  /**
   * Disposes emitters.
   */
  public dispose(): void {
    this._onDidChangeFileDecorations.dispose();
  }

  /**
   * Sanitizes an Org alias for safe use in a Windows/Unix file name.
   *
   * @param value - Raw Org alias/username.
   * @returns Safe fragment for file names.
   */
  private sanitizeForFileName(value: string): string {
    const cleaned = value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim();
    return cleaned || 'org';
  }
}
