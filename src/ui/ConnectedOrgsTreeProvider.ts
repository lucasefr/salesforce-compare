import * as vscode from 'vscode';
import { OrgAuthStatusStore } from '../services/OrgAuthStatusStore';
import { OrgConnectionService } from '../services/OrgConnectionService';
import { OrgSidebarDecorationProvider } from '../providers/OrgSidebarDecorationProvider';

/** Sidebar guidance when the project has no default/Original Org yet. */
const NO_DEFAULT_ORG_LABEL =
  'Authorize the default Org first (CLI / Extension Pack)';
const NO_DEFAULT_ORG_TOOLTIP =
  'No default Org is configured for this project.\n\n' +
  '1. Use Salesforce CLI or Extension Pack: Authorize an Org\n' +
  '2. Set it as the default target org\n' +
  '3. Click Refresh here\n\n' +
  'Salesforce Compare Authorize is for additional comparison Orgs only ' +
  'and never changes the project default.';

/**
 * Tree item representing an Org in the Connected Orgs sidebar.
 * Label shows only the Org alias (no username).
 */
export class ConnectedOrgTreeItem extends vscode.TreeItem {
  /**
   * Creates a tree item for an Org row.
   *
   * @param label - Display label (Org alias only).
   * @param role - Whether this is the Original Org or a comparison Org.
   * @param alias - Org alias used for disconnect/reconnect commands.
   * @param hasAuthError - When true, label is decorated red until reconnect.
   * @param authMessage - Optional auth error detail for tooltip.
   */
  constructor(
    label: string,
    public readonly role: 'original' | 'comparison',
    public readonly alias: string,
    hasAuthError: boolean,
    authMessage?: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    // SALEXT-0004 - start
    this.description = hasAuthError
      ? role === 'original'
        ? 'Original · Auth error'
        : 'Comparison · Auth error'
      : role === 'original'
        ? 'Original'
        : 'Comparison';
    // SALEXT-0004 - end

    const baseTooltip =
      role === 'original'
        ? `${alias} — Original Org (auto-check / Diff with Org)`
        : `${alias} — Comparison Org (Local ↔ Org only; retrieve-only)`;
    this.tooltip = hasAuthError
      ? `${baseTooltip}\nAuthentication error — use Reconnect Org.${
          authMessage ? `\n${authMessage}` : ''
        }`
      : baseTooltip;

    // SALEXT-0004 - start
    if (alias && hasAuthError) {
      this.resourceUri = OrgSidebarDecorationProvider.toOrgUri(alias);
    } else {
      this.resourceUri = undefined;
    }
    // SALEXT-0004 - end

    if (hasAuthError) {
      this.contextValue =
        role === 'original'
          ? 'salesforceCompare.originalOrgError'
          : 'salesforceCompare.comparisonOrgError';
      this.iconPath = new vscode.ThemeIcon(
        'warning',
        new vscode.ThemeColor('salesforceCompare.orgAuthError')
      );
    } else {
      this.contextValue =
        role === 'original'
          ? 'salesforceCompare.originalOrg'
          : 'salesforceCompare.comparisonOrg';
      this.iconPath = new vscode.ThemeIcon(
        role === 'original' ? 'star-full' : 'cloud'
      );
    }
  }
}

/**
 * TreeDataProvider for the Salesforce Compare Connected Orgs sidebar.
 */
export class ConnectedOrgsTreeProvider
  implements vscode.TreeDataProvider<ConnectedOrgTreeItem>
{
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<
    ConnectedOrgTreeItem | undefined | void
  >();
  public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private cachedOriginalOrg: string | undefined;
  private resolveInFlight: Promise<string | undefined> | undefined;

  /**
   * Creates the tree provider.
   *
   * @param orgConnectionService - Resolves Original + comparison Orgs.
   * @param authStatus - Per-Org auth health (red label when failed).
   */
  constructor(
    private readonly orgConnectionService: OrgConnectionService,
    private readonly authStatus: OrgAuthStatusStore
  ) {
    authStatus.onDidChange(() => {
      this._onDidChangeTreeData.fire();
    });
  }

  /**
   * Resolves the Original Org once at startup and paints the sidebar.
   * Must run after the TreeDataProvider is registered.
   *
   * @returns Promise that resolves when the first resolve + refresh complete.
   */
  public async initialize(): Promise<void> {
    // SALEXT-0004 - start
    await this.resolveAndCacheOriginalOrg(true);
    this._onDidChangeTreeData.fire();
    // SALEXT-0004 - end
  }

  /**
   * Refreshes the tree view (re-resolves Original Org and comparison list).
   *
   * @returns Promise that resolves when the refresh is scheduled.
   */
  public async refresh(): Promise<void> {
    this._onDidChangeTreeData.fire();
  }

  /**
   * Forces a fresh Original Org resolve (Refresh button) then repaints.
   *
   * @returns Promise that resolves when resolve + repaint finish.
   */
  public async refreshFromCli(): Promise<void> {
    // SALEXT-0004 - start
    this.cachedOriginalOrg = undefined;
    this.resolveInFlight = undefined;
    await this.resolveAndCacheOriginalOrg(true);
    this._onDidChangeTreeData.fire();
    // SALEXT-0004 - end
  }

  /**
   * Returns the tree item for a given element.
   *
   * @param element - Tree item.
   * @returns The same tree item.
   */
  public getTreeItem(element: ConnectedOrgTreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * Returns children for the root (list of Orgs) or an empty array for leaves.
   * Comparison Orgs are always read synchronously from workspace storage.
   * Original Org uses cache; a background resolve updates the tree when ready.
   *
   * @param element - Parent element, or undefined for the root.
   * @returns Tree items to display.
   */
  public async getChildren(
    element?: ConnectedOrgTreeItem
  ): Promise<ConnectedOrgTreeItem[]> {
    if (element) {
      return [];
    }

    const items: ConnectedOrgTreeItem[] = [];

    // SALEXT-0004 - start
    // Prefer cache so comparison Orgs paint even while CLI resolve is slow.
    let original = this.cachedOriginalOrg;
    if (original === undefined) {
      original = await this.resolveAndCacheOriginalOrg(false);
    } else {
      // Revalidate in background without blocking the list of comparison Orgs.
      void this.resolveAndCacheOriginalOrg(false).then((resolved) => {
        if (resolved !== original) {
          this._onDidChangeTreeData.fire();
        }
      });
    }
    await this.orgConnectionService.refreshHasOriginalOrgContext(!!original);
    // SALEXT-0004 - end

    if (original) {
      const auth = this.authStatus.get(original);
      items.push(
        new ConnectedOrgTreeItem(
          original,
          'original',
          original,
          !!auth?.hasAuthError,
          auth?.message
        )
      );
    } else {
      // SALEXT-0004 - start
      const guidance = new ConnectedOrgTreeItem(
        NO_DEFAULT_ORG_LABEL,
        'original',
        '',
        false
      );
      guidance.description = 'Required';
      guidance.tooltip = NO_DEFAULT_ORG_TOOLTIP;
      guidance.contextValue = 'salesforceCompare.noOriginalOrg';
      guidance.iconPath = new vscode.ThemeIcon('info');
      items.push(guidance);
      // SALEXT-0004 - end
    }

    // Always append every persisted comparison Org (workspaceState).
    for (const org of this.orgConnectionService.getComparisonOrgs()) {
      const auth = this.authStatus.get(org.alias);
      const hasError =
        !!auth?.hasAuthError ||
        (!!org.username && this.authStatus.hasAuthError(org.username));
      items.push(
        new ConnectedOrgTreeItem(
          org.alias,
          'comparison',
          org.alias,
          hasError,
          auth?.message || this.authStatus.get(org.username || '')?.message
        )
      );
    }

    return items;
  }

  /**
   * Clears the cached Original Org so the next refresh re-resolves from CLI/settings.
   */
  public clearOriginalOrgCache(): void {
    this.cachedOriginalOrg = undefined;
    this.resolveInFlight = undefined;
  }

  /**
   * Resolves and caches the Original Org (dedupes concurrent calls).
   *
   * @param force - When true, starts a new resolve even if one is in flight.
   * @returns Resolved Original Org alias/username, or undefined.
   */
  private async resolveAndCacheOriginalOrg(
    force: boolean
  ): Promise<string | undefined> {
    if (!force && this.resolveInFlight) {
      return this.resolveInFlight;
    }

    this.resolveInFlight = (async () => {
      try {
        const resolved = await this.orgConnectionService.resolveOriginalOrg();
        this.cachedOriginalOrg = resolved;
        await this.orgConnectionService.refreshHasOriginalOrgContext(!!resolved);
        return resolved;
      } catch {
        await this.orgConnectionService.refreshHasOriginalOrgContext(
          !!this.cachedOriginalOrg
        );
        return this.cachedOriginalOrg;
      } finally {
        this.resolveInFlight = undefined;
      }
    })();

    return this.resolveInFlight;
  }

  /**
   * Disposes the change emitter.
   */
  public dispose(): void {
    this._onDidChangeTreeData.dispose();
  }
}
