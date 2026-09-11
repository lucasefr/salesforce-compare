import * as vscode from 'vscode';
import { ORG_SCHEME } from '../util/constants';
import { OrgContentProvider } from './OrgContentProvider';
import { ComparisonTempFileService } from '../services/ComparisonTempFileService';

/**
 * Colors comparison-Org temp files (and comparison-side virtual URIs) in blue
 * so they are visually distinct from Original Org / local workspace files.
 */
export class ComparisonFileDecorationProvider implements vscode.FileDecorationProvider {
  private readonly _onDidChangeFileDecorations = new vscode.EventEmitter<
    vscode.Uri | vscode.Uri[] | undefined
  >();
  public readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

  /**
   * Creates the provider.
   *
   * @param tempFiles - Service that tracks comparison Org temp snapshots.
   */
  constructor(private readonly tempFiles: ComparisonTempFileService) {
    tempFiles.onDidChangeFileDecorations((uri) => {
      this._onDidChangeFileDecorations.fire(uri);
    });
  }

  /**
   * Provides a blue decoration for comparison-Org files.
   *
   * @param uri - File or virtual URI.
   * @returns Blue FileDecoration when the URI is a comparison Org artifact.
   */
  public provideFileDecoration(
    uri: vscode.Uri
  ): vscode.ProviderResult<vscode.FileDecoration> {
    // SALEXT-0004 - start
    if (this.tempFiles.isComparisonTemp(uri)) {
      const info = this.tempFiles.getInfo(uri);
      const org = info?.orgAlias ?? this.extractOrgFromTempName(uri);
      return {
        badge: '⇄',
        tooltip: `Salesforce Compare — ${ComparisonTempFileService.formatOrgLabel(org)} (temporary snapshot, retrieve-only)`,
        color: new vscode.ThemeColor('salesforceCompare.comparisonOrg'),
        propagate: false,
      };
    }

    if (uri.scheme === ORG_SCHEME) {
      const targetOrg = OrgContentProvider.toTargetOrg(uri);
      if (targetOrg) {
        return {
          badge: '⇄',
          tooltip: `Salesforce Compare — ${ComparisonTempFileService.formatOrgLabel(targetOrg)}`,
          color: new vscode.ThemeColor('salesforceCompare.comparisonOrg'),
          propagate: false,
        };
      }
    }
    // SALEXT-0004 - end

    return undefined;
  }

  /**
   * Extracts the Org alias embedded in a `.__from__{alias}` temp file name.
   *
   * @param uri - Temp file URI.
   * @returns Org alias fragment or `comparison`.
   */
  private extractOrgFromTempName(uri: vscode.Uri): string {
    const base = uri.path.split('/').pop() ?? uri.fsPath;
    const marker = '.__from__';
    const idx = base.indexOf(marker);
    if (idx < 0) {
      return 'comparison';
    }
    const after = base.slice(idx + marker.length);
    const dot = after.lastIndexOf('.');
    return (dot > 0 ? after.slice(0, dot) : after) || 'comparison';
  }

  /**
   * Disposes the change emitter.
   */
  public dispose(): void {
    this._onDidChangeFileDecorations.dispose();
  }
}
