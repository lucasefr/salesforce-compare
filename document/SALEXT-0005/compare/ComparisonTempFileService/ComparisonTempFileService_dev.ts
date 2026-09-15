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
   * Forces any already-open editor model for this path to match disk content
   * (VS Code otherwise keeps a stale buffer and Diff shows old Org text).
   *
   * @param localUri - Local workspace file being compared.
   * @param orgAlias - Comparison Org alias/username.
   * @param content - Retrieved Org file content (empty when missing in Org).
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
    // SALEXT-0005 - start
    // Distinct name when missing so Diff never reuses a prior non-empty buffer URI.
    const missingMarker = content.length === 0 ? '.MISSING' : '';
    const fileName = `${parsed.name}.LOCAL_x_${safeOrg}${missingMarker}${parsed.ext}`;
    // SALEXT-0005 - end
    // SALEXT-0004 - end
    const filePath = path.join(this.tempRoot, fileName);
    await fs.writeFile(filePath, content, 'utf8');

    const uri = vscode.Uri.file(filePath);
    // SALEXT-0005 - start
    await this.syncOpenDocumentContent(uri, content);
    // SALEXT-0005 - end
    const info: ComparisonTempFileInfo = {
      uri,
      orgAlias,
      localUri,
    };
    this.byUri.set(uri.toString(), info);
    this._onDidChangeFileDecorations.fire(uri);
    return info;
  }

  // SALEXT-0005 - start
  /**
   * Closes any open Diff tabs that already use this temp snapshot URI so the
   * next `vscode.diff` opens a fresh editor with the content just written.
   *
   * @param tempUri - Comparison temp file URI on the Org side.
   * @returns Promise that resolves when matching tabs are closed.
   */
  public async closeExistingDiffTabs(tempUri: vscode.Uri): Promise<void> {
    const targetPath = tempUri.fsPath;
    const tabsToClose: vscode.Tab[] = [];
    for (const group of vscode.window.tabGroups.all) {
      for (const tab of group.tabs) {
        if (!(tab.input instanceof vscode.TabInputTextDiff)) {
          continue;
        }
        const originalPath = tab.input.original.fsPath;
        const modifiedPath = tab.input.modified.fsPath;
        if (originalPath === targetPath || modifiedPath === targetPath) {
          tabsToClose.push(tab);
        }
      }
    }
    if (tabsToClose.length > 0) {
      await vscode.window.tabGroups.close(tabsToClose, true);
    }
  }

  /**
   * Ensures the in-memory text document for a temp URI matches the given content.
   *
   * @param uri - Temp file URI.
   * @param content - Expected file content (may be empty).
   * @returns Promise that resolves when the editor model matches `content`.
   */
  public async syncOpenDocumentContent(
    uri: vscode.Uri,
    content: string
  ): Promise<void> {
    const openDoc = vscode.workspace.textDocuments.find(
      (doc) => doc.uri.fsPath === uri.fsPath
    );
    if (!openDoc) {
      return;
    }
    if (openDoc.getText() === content) {
      return;
    }
    await this.replaceDocumentContent(openDoc, content);
  }

  /**
   * Replaces the full text of an open document and saves it to disk.
   *
   * @param document - Open text document to update.
   * @param content - New full content (may be empty).
   * @returns Promise that resolves when the edit is applied and saved.
   */
  private async replaceDocumentContent(
    document: vscode.TextDocument,
    content: string
  ): Promise<void> {
    const edit = new vscode.WorkspaceEdit();
    const fullRange = new vscode.Range(
      document.positionAt(0),
      document.positionAt(document.getText().length)
    );
    edit.replace(document.uri, fullRange, content);
    await vscode.workspace.applyEdit(edit);
    if (document.isDirty) {
      await document.save();
    }
  }
  // SALEXT-0005 - end

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
