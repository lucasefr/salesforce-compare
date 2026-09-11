import * as vscode from 'vscode';
import { OrgSnapshotCache } from '../infrastructure/OrgSnapshotCache';
import { ORG_SCHEME } from '../util/constants';

/**
 * Virtual document provider that serves cached Org file content for
 * `vscode.diff` under the `salesforce-compare:` scheme.
 */
export class OrgContentProvider implements vscode.TextDocumentContentProvider {
  private readonly _onDidChange = new vscode.EventEmitter<vscode.Uri>();
  public readonly onDidChange = this._onDidChange.event;

  /**
   * Creates the provider.
   *
   * @param cache - Snapshot cache used to read Org content.
   */
  constructor(private readonly cache: OrgSnapshotCache) {}

  /**
   * Builds a virtual URI that maps back to a local file URI.
   *
   * @param localUri - Local file URI being compared.
   * @param targetOrg - Optional Org alias for secondary-org scoped snapshots.
   * @returns Virtual URI with scheme `salesforce-compare`.
   */
  public static toOrgUri(localUri: vscode.Uri, targetOrg?: string): vscode.Uri {
    // SALEXT-0004 - start
    const params = new URLSearchParams();
    params.set('local', localUri.toString());
    if (targetOrg) {
      params.set('org', targetOrg);
    }
    const baseName = localUri.path.split('/').pop() || 'file';
    // Distinct virtual path so the diff tab does not look like the local file.
    const labelPath = targetOrg
      ? `/comparison/${targetOrg}/${baseName}`
      : `/original/${baseName}`;
    return vscode.Uri.from({
      scheme: ORG_SCHEME,
      path: labelPath,
      query: params.toString(),
      fragment: localUri.fragment,
    });
    // SALEXT-0004 - end
  }

  /**
   * Parses the original local URI from a virtual Org URI.
   *
   * @param orgUri - Virtual URI.
   * @returns Local file URI, or undefined when the query is invalid.
   */
  public static toLocalUri(orgUri: vscode.Uri): vscode.Uri | undefined {
    const params = new URLSearchParams(orgUri.query);
    const local = params.get('local');
    if (!local) {
      return undefined;
    }
    return vscode.Uri.parse(local);
  }

  // SALEXT-0004 - start
  /**
   * Reads the Org alias from a virtual Org URI query, when present.
   *
   * @param orgUri - Virtual URI.
   * @returns Org alias/username or undefined for the primary (Original) snapshot.
   */
  public static toTargetOrg(orgUri: vscode.Uri): string | undefined {
    const params = new URLSearchParams(orgUri.query);
    const org = params.get('org');
    return org?.trim() || undefined;
  }
  // SALEXT-0004 - end

  /**
   * Provides the Org-side text content for a virtual URI.
   *
   * @param uri - Virtual `salesforce-compare:` URI.
   * @returns Org content string, or an error placeholder.
   */
  public async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    const localUri = OrgContentProvider.toLocalUri(uri);
    if (!localUri) {
      return '/* Unable to resolve local file for Org content */\n';
    }
    // SALEXT-0004 - start
    const targetOrg = OrgContentProvider.toTargetOrg(uri);
    const content = await this.cache.readContent(localUri, targetOrg);
    // SALEXT-0004 - end
    if (content === undefined) {
      return '/* Org snapshot not available. Run Recheck Current File first. */\n';
    }
    return content;
  }

  /**
   * Notifies editors that Org content for a local file changed.
   *
   * @param localUri - Local file whose Org snapshot was refreshed.
   * @param targetOrg - Optional Org alias for secondary-org scoped snapshots.
   */
  public notifyChanged(localUri: vscode.Uri, targetOrg?: string): void {
    this._onDidChange.fire(OrgContentProvider.toOrgUri(localUri, targetOrg));
  }

  /**
   * Disposes the change emitter.
   */
  public dispose(): void {
    this._onDidChange.dispose();
  }
}
