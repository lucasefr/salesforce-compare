import * as vscode from 'vscode';
import { OrgAuthStatusStore } from '../services/OrgAuthStatusStore';
import { ORG_SIDEBAR_SCHEME } from '../util/constants';

/**
 * Colors Connected Orgs sidebar labels red when the Org has an auth error.
 * Uses TreeItem.resourceUri + FileDecoration (VS Code pattern for tree label color).
 */
export class OrgSidebarDecorationProvider implements vscode.FileDecorationProvider {
  private readonly _onDidChangeFileDecorations = new vscode.EventEmitter<
    vscode.Uri | vscode.Uri[] | undefined
  >();
  public readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

  /**
   * Creates the sidebar decoration provider.
   *
   * @param authStatus - Per-Org auth health store.
   */
  constructor(private readonly authStatus: OrgAuthStatusStore) {
    authStatus.onDidChange(() => {
      // Refresh all sidebar org decorations so red clears after reconnect.
      this._onDidChangeFileDecorations.fire(undefined);
    });
  }

  /**
   * Builds a virtual URI used by Connected Orgs tree items for decoration.
   *
   * @param alias - Org alias.
   * @returns URI with scheme `salesforce-compare-org`.
   */
  public static toOrgUri(alias: string): vscode.Uri {
    return vscode.Uri.from({
      scheme: ORG_SIDEBAR_SCHEME,
      path: `/${encodeURIComponent(alias.trim())}`,
    });
  }

  /**
   * Provides a red decoration when the Org has an authentication error.
   *
   * @param uri - Sidebar org URI.
   * @returns Red FileDecoration or undefined.
   */
  public provideFileDecoration(
    uri: vscode.Uri
  ): vscode.ProviderResult<vscode.FileDecoration> {
    if (uri.scheme !== ORG_SIDEBAR_SCHEME) {
      return undefined;
    }
    const alias = decodeURIComponent(uri.path.replace(/^\//, ''));
    if (!this.authStatus.hasAuthError(alias)) {
      return undefined;
    }
    const entry = this.authStatus.get(alias);
    return {
      color: new vscode.ThemeColor('salesforceCompare.orgAuthError'),
      tooltip: entry?.message
        ? `Authentication error — use Reconnect Org. ${entry.message}`
        : 'Authentication error — use Reconnect Org',
      propagate: false,
    };
  }

  /**
   * Disposes the change emitter.
   */
  public dispose(): void {
    this._onDidChangeFileDecorations.dispose();
  }
}
