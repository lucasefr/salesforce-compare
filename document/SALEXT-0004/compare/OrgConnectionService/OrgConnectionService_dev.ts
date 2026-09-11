import * as vscode from 'vscode';
import { ListedOrg, SfCliAdapter } from '../infrastructure/SfCliAdapter';
import { isAuthenticationError, LOGIN_INSTANCE_PRESETS } from '../util/authErrors';
import { CONTEXT_HAS_COMPARISON_ORGS, CONTEXT_HAS_ORIGINAL_ORG, CONNECTED_ORGS_VIEW_ID } from '../util/constants';
import { SalesforcePathMapper } from '../util/SalesforcePathMapper';
import { ComparisonOrgEntry, ConnectedOrgsStore } from './ConnectedOrgsStore';
import { OrgAuthStatusStore } from './OrgAuthStatusStore';
import { OrgResolver } from './OrgResolver';

/** Known Salesforce Extension Pack command IDs for "Authorize an Org". */
const SF_EXTENSION_AUTHORIZE_COMMANDS = [
  'sfdx.force.auth.web.login',
  'sf.org.login.web',
] as const;

/**
 * Coordinates Original Org resolution and comparison-Org connect/disconnect.
 * Authorization mirrors Salesforce Extension Pack "Authorize an Org"
 * (org type → alias → optional default). Never deploys.
 * Auth failures mark the Org red in the sidebar until Reconnect Org succeeds.
 */
export class OrgConnectionService {
  /**
   * Creates the connection service.
   *
   * @param sfCli - Salesforce CLI adapter.
   * @param orgResolver - Resolves the Original (primary) Org.
   * @param store - Workspace comparison Org store.
   * @param authStatus - Per-Org auth health for sidebar coloring.
   */
  constructor(
    private readonly sfCli: SfCliAdapter,
    private readonly orgResolver: OrgResolver,
    private readonly store: ConnectedOrgsStore,
    private readonly authStatus: OrgAuthStatusStore
  ) {}

  /**
   * Resolves the Original Org for the active Salesforce workspace folder.
   *
   * @returns Org alias/username, or undefined when none can be resolved.
   */
  public async resolveOriginalOrg(): Promise<string | undefined> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
      return undefined;
    }
    // SALEXT-0004 - start
    // Workspace may be a parent folder; resolve the nested DX project root first.
    const projectRoot =
      (await SalesforcePathMapper.findSalesforceProjectRoot(folder.uri.fsPath)) ||
      folder.uri.fsPath;
    return this.orgResolver.resolveTargetOrg(projectRoot);
    // SALEXT-0004 - end
  }

  /**
   * Returns comparison Orgs configured for this workspace.
   *
   * @returns Comparison Org entries.
   */
  public getComparisonOrgs(): ComparisonOrgEntry[] {
    return this.store.getComparisonOrgs();
  }

  /**
   * Updates the VS Code context key used by menus for Diff with Other Org.
   *
   * @returns Promise that resolves when the context is set.
   */
  public async refreshHasComparisonOrgsContext(): Promise<void> {
    await vscode.commands.executeCommand(
      'setContext',
      CONTEXT_HAS_COMPARISON_ORGS,
      this.store.hasComparisonOrgs()
    );
  }

  /**
   * Updates the context key that shows/hides Authorize an Org in the sidebar.
   * Authorize is only available when a project default (Original) Org already exists.
   *
   * @param hasOriginalOrg - Whether the Original/default Org is resolved.
   * @returns Promise that resolves when the context is set.
   */
  public async refreshHasOriginalOrgContext(hasOriginalOrg: boolean): Promise<void> {
    await vscode.commands.executeCommand(
      'setContext',
      CONTEXT_HAS_ORIGINAL_ORG,
      hasOriginalOrg
    );
  }

  /**
   * Lists authenticated Orgs from the Salesforce CLI.
   *
   * @returns Listed Orgs from `sf org list`.
   * @throws Error when the CLI is missing or the command fails.
   */
  public async listAuthenticatedOrgs(): Promise<ListedOrg[]> {
    const available = await this.sfCli.isCliAvailable();
    if (!available) {
      await this.sfCli.notifyCliMissing();
      throw new Error('Salesforce CLI (sf) not found on PATH.');
    }
    return this.sfCli.listOrgs();
  }

  /**
   * Removes a comparison Org from the workspace list.
   *
   * @param alias - Org alias/username to disconnect.
   * @returns True when removed.
   */
  public async disconnectComparisonOrg(alias: string): Promise<boolean> {
    const removed = await this.store.removeComparisonOrg(alias);
    await this.refreshHasComparisonOrgsContext();
    if (removed) {
      await vscode.window.showInformationMessage(
        `Salesforce Compare: disconnected comparison Org "${alias}".`
      );
    }
    return removed;
  }

  /**
   * Starts the Authorize an Org flow (sidebar button for comparison Orgs).
   * Requires an Original/default Org already configured for the project.
   * Never sets the CLI default target org (`--set-default` is always false).
   *
   * @returns Promise that resolves when authorization finishes or is cancelled.
   */
  public async loginOrg(): Promise<void> {
    const original = await this.resolveOriginalOrg();
    if (!original) {
      await vscode.window.showWarningMessage(
        'Salesforce Compare: authorize the project default Org first (Salesforce CLI or Extension Pack → Authorize an Org → set as default), then click Refresh in Connected Orgs.'
      );
      await this.refreshHasOriginalOrgContext(false);
      return;
    }
    await this.refreshHasOriginalOrgContext(true);
    await this.authorizeOrgInteractive({ addToSidebar: true });
  }

  /**
   * Marks an Org as auth-failed so the Connected Orgs sidebar shows it in red.
   * Does NOT open the Authorize wizard automatically.
   *
   * @param orgAlias - Org that failed (Original or comparison).
   * @param errorMessage - CLI/API error text.
   */
  public markAuthFailure(orgAlias: string | undefined, errorMessage: string): void {
    if (!isAuthenticationError(errorMessage)) {
      return;
    }
    const alias = orgAlias?.trim();
    if (!alias) {
      return;
    }
    this.authStatus.markAuthError(alias, errorMessage);

    // Mirror the flag onto the comparison-Org alias when the failure was keyed by username.
    for (const org of this.store.getComparisonOrgs()) {
      const aliasMatch = org.alias.trim().toLowerCase() === alias.toLowerCase();
      const userMatch =
        !!org.username && org.username.trim().toLowerCase() === alias.toLowerCase();
      if (aliasMatch || userMatch) {
        this.authStatus.markAuthError(org.alias, errorMessage);
        if (org.username) {
          this.authStatus.markAuthError(org.username, errorMessage);
        }
      }
    }
  }

  /**
   * Reconnects a specific Org via Authorize an Org (user-initiated from sidebar).
   * On success, clears the red auth-error state for that Org (alias and username keys).
   * Never changes the CLI default target org.
   *
   * @param alias - Org alias to reconnect.
   * @param role - Whether this is the Original Org or a comparison Org.
   * @returns True when authorization completed successfully.
   */
  public async reconnectOrg(
    alias: string,
    role: 'original' | 'comparison' = 'comparison'
  ): Promise<boolean> {
    const comparison = this.store
      .getComparisonOrgs()
      .find((org) => org.alias.trim().toLowerCase() === alias.trim().toLowerCase());

    const authorizedAlias = await this.authorizeOrgInteractive({
      suggestedAlias: alias,
      // Original stays the CLI/Extension Pack default — extension never sets --set-default.
      addToSidebar: role === 'comparison',
    });

    if (authorizedAlias === undefined) {
      return false;
    }

    // Clear every key that may have been used when marking the auth error.
    this.authStatus.clearAuthErrors([
      alias,
      authorizedAlias,
      comparison?.alias,
      comparison?.username,
    ]);
    return true;
  }

  /**
   * Interactive Authorize an Org wizard (Production / Sandbox / Custom URL + alias).
   * On success, adds the Org to Connected Orgs as a comparison Org.
   * Never prompts for or applies `--set-default` — the project default Org must
   * come from Salesforce CLI / Extension Pack Authorize (first default Org).
   *
   * @param options - Suggested alias and sidebar behavior.
   * @returns Authorized alias on success; undefined when cancelled or failed.
   */
  public async authorizeOrgInteractive(options: {
    suggestedAlias?: string;
    preferSetDefault?: boolean;
    reason?: string;
    /** When true (default), add the Org to the Connected Orgs sidebar after success. */
    addToSidebar?: boolean;
  }): Promise<string | undefined> {
    const addToSidebar = options.addToSidebar !== false;
    const available = await this.sfCli.isCliAvailable();
    if (!available) {
      await this.sfCli.notifyCliMissing();
      return undefined;
    }

    const typePick = await vscode.window.showQuickPick(
      [
        {
          label: 'Production',
          description: LOGIN_INSTANCE_PRESETS.production,
          detail: 'login.salesforce.com',
          loginKind: 'production' as const,
        },
        {
          label: 'Sandbox',
          description: LOGIN_INSTANCE_PRESETS.sandbox,
          detail: 'test.salesforce.com (same as Authorize an Org → Sandbox)',
          loginKind: 'sandbox' as const,
        },
        {
          label: 'Custom URL / My Domain',
          description: 'Enter instance URL',
          detail: 'e.g. https://MyDomain--UAT.sandbox.my.salesforce.com',
          loginKind: 'custom' as const,
        },
        {
          label: 'Salesforce Extension Pack: Authorize an Org…',
          description: 'Opens the built-in SF Extension wizard when installed',
          detail: 'Uses the same command as SFDX: Authorize an Org',
          loginKind: 'extension' as const,
        },
      ],
      {
        title: 'Salesforce Compare — Authorize an Org',
        placeHolder: 'Select the login URL type',
        ignoreFocusOut: true,
      }
    );
    if (!typePick) {
      return undefined;
    }

    // SALEXT-0004 - start
    // Alias is always required so we can list the Org on success without `sf org list`.
    const alias = await vscode.window.showInputBox({
      title: 'Salesforce Compare — Org Alias',
      prompt: 'Enter an alias for this Org (it will appear in Connected Orgs after success)',
      value: options.suggestedAlias?.trim() || '',
      placeHolder: 'e.g. uat, dev, prod',
      ignoreFocusOut: true,
      validateInput: (value) =>
        value.trim() ? undefined : 'Alias is required',
    });
    if (!alias) {
      return undefined;
    }
    const aliasTrimmed = alias.trim();

    if (typePick.loginKind === 'extension') {
      const ok = await this.trySalesforceExtensionAuthorize();
      if (!ok) {
        return undefined;
      }
      const finished = await vscode.window.showInformationMessage(
        `Salesforce Compare: finish Authorize an Org in the browser for alias "${aliasTrimmed}", then click Done.`,
        'Done'
      );
      if (finished !== 'Done') {
        return undefined;
      }
      this.authStatus.clearAuthErrors([aliasTrimmed, options.suggestedAlias]);
      if (addToSidebar) {
        await this.addOrgToSidebarNow(aliasTrimmed);
      }
      return aliasTrimmed;
    }

    let instanceUrl: string = LOGIN_INSTANCE_PRESETS.production;
    if (typePick.loginKind === 'sandbox') {
      instanceUrl = LOGIN_INSTANCE_PRESETS.sandbox;
    } else if (typePick.loginKind === 'custom') {
      const custom = await vscode.window.showInputBox({
        title: 'Salesforce Compare — Custom Login URL',
        prompt: 'Enter the Org instance / My Domain login URL',
        placeHolder: 'https://MyDomain--Sandbox.sandbox.my.salesforce.com',
        ignoreFocusOut: true,
        validateInput: (value) => {
          const trimmed = value.trim();
          if (!trimmed) {
            return 'URL is required';
          }
          if (!/^https:\/\//i.test(trimmed)) {
            return 'URL must start with https://';
          }
          return undefined;
        },
      });
      if (!custom) {
        return undefined;
      }
      instanceUrl = custom.trim().replace(/\/+$/, '');
    }

    // Never set CLI default from this extension — default Org is the first one
    // authorized via Salesforce CLI / Extension Pack.
    try {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Salesforce Compare: authorize "${aliasTrimmed}" (${instanceUrl}) — complete login in the browser…`,
          cancellable: false,
        },
        async () => {
          await this.sfCli.loginOrgWeb({
            alias: aliasTrimmed,
            instanceUrl,
            setDefault: false,
          });
        }
      );
      this.authStatus.clearAuthErrors([aliasTrimmed, options.suggestedAlias]);
      if (addToSidebar) {
        await this.addOrgToSidebarNow(aliasTrimmed);
      }
      void vscode.window.showInformationMessage(
        `Salesforce Compare: Org "${aliasTrimmed}" authorized and listed in Connected Orgs.`
      );
      return aliasTrimmed;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await vscode.window.showErrorMessage(
        `Salesforce Compare: authorization failed — ${message}`
      );
      return undefined;
    }
    // SALEXT-0004 - end
  }

  /**
   * Persists an Org alias in the Connected Orgs sidebar immediately.
   * Never waits on `sf org list`.
   *
   * @param alias - Org alias to list.
   * @returns Promise that resolves when the store and context are updated.
   */
  public async addOrgToSidebarNow(alias: string): Promise<void> {
    const trimmed = alias.trim();
    if (!trimmed) {
      return;
    }
    await this.store.addComparisonOrg({
      alias: trimmed,
      addedAt: Date.now(),
    });
    await this.refreshHasComparisonOrgsContext();
    try {
      await vscode.commands.executeCommand(`${CONNECTED_ORGS_VIEW_ID}.focus`);
    } catch {
      // View focus is best-effort.
    }
    void this.enrichComparisonOrgUsername(trimmed);
  }

  /**
   * @deprecated Prefer {@link addOrgToSidebarNow}. Kept for call-site compatibility.
   * @param alias - Alias to list.
   * @returns Promise that resolves when listed.
   */
  public async ensureOrgListedInSidebar(alias?: string): Promise<void> {
    if (alias?.trim()) {
      await this.addOrgToSidebarNow(alias.trim());
      return;
    }
    const typed = await vscode.window.showInputBox({
      title: 'Salesforce Compare — Org Alias',
      prompt: 'Enter the alias of the Org you just authorized',
      placeHolder: 'e.g. uat, dev, prod',
      ignoreFocusOut: true,
      validateInput: (value) =>
        value.trim() ? undefined : 'Alias is required',
    });
    if (typed?.trim()) {
      await this.addOrgToSidebarNow(typed.trim());
    }
  }

  /**
   * Best-effort username enrichment for a comparison Org already in the store.
   * Never throws to the caller.
   *
   * @param alias - Org alias to enrich.
   * @returns Promise that resolves when enrichment finishes or is skipped.
   */
  private async enrichComparisonOrgUsername(alias: string): Promise<void> {
    try {
      const listed = await this.listAuthenticatedOrgs();
      const aliasKey = alias.trim().toLowerCase();
      const match = listed.find(
        (org) =>
          org.alias.trim().toLowerCase() === aliasKey ||
          org.username.trim().toLowerCase() === aliasKey
      );
      if (!match?.username) {
        return;
      }
      const current = this.store.getComparisonOrgs();
      const entry = current.find(
        (org) => org.alias.trim().toLowerCase() === aliasKey
      );
      if (!entry || entry.username === match.username) {
        return;
      }
      // Update in place — never remove+add (can drop Orgs if add fails mid-flight).
      await this.store.updateComparisonOrgUsername(entry.alias, match.username);
    } catch {
      // Ignore enrichment failures.
    }
  }

  /**
   * Invokes Salesforce Extension Pack Authorize an Org when the command exists.
   * Does not wait for the browser OAuth to finish — caller must confirm afterward.
   *
   * @returns True when a command was executed (user completes the SF wizard).
   */
  private async trySalesforceExtensionAuthorize(): Promise<boolean> {
    for (const commandId of SF_EXTENSION_AUTHORIZE_COMMANDS) {
      try {
        await vscode.commands.executeCommand(commandId);
        return true;
      } catch {
        // Command not registered — try next id.
      }
    }
    await vscode.window.showWarningMessage(
      'Salesforce Compare: Salesforce Extension Pack Authorize command was not found. Use Production / Sandbox / Custom URL instead.'
    );
    return false;
  }
}
