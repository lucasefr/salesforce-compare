import * as vscode from 'vscode';
import { SfCliAdapter } from '../infrastructure/SfCliAdapter';

/**
 * Resolves the target Salesforce Org for comparisons.
 * Preference order:
 * 1. Extension setting `salesforceCompare.targetOrg`
 * 2. Salesforce Extension Pack default username (when available)
 * 3. `sf config get target-org` for the workspace
 */
export class OrgResolver {
  /**
   * Creates an OrgResolver.
   *
   * @param sfCli - Salesforce CLI adapter used for fallback resolution.
   */
  constructor(private readonly sfCli: SfCliAdapter) {}

  /**
   * Resolves the target org alias or username for a workspace folder.
   *
   * @param workspacePath - Absolute path to the Salesforce project root.
   * @returns Org identifier string, or undefined when none can be resolved.
   */
  public async resolveTargetOrg(workspacePath: string): Promise<string | undefined> {
    const configured = vscode.workspace
      .getConfiguration('salesforceCompare')
      .get<string>('targetOrg', '')
      .trim();
    if (configured) {
      return configured;
    }

    const fromSfExtension = await this.trySalesforceExtensionDefault(workspacePath);
    if (fromSfExtension) {
      return fromSfExtension;
    }

    return this.sfCli.getTargetOrg(workspacePath);
  }

  /**
   * Attempts to read the default username / target org from the Salesforce
   * Extension Pack configuration and known APIs.
   *
   * @param workspacePath - Project root (used for workspace-scoped settings).
   * @returns Org identifier or undefined.
   */
  private async trySalesforceExtensionDefault(
    workspacePath: string
  ): Promise<string | undefined> {
    const folder = vscode.workspace.workspaceFolders?.find(
      (f) => f.uri.fsPath === workspacePath
    );

    const scopes: Array<vscode.ConfigurationScope | undefined> = folder
      ? [folder, undefined]
      : [undefined];

    for (const scope of scopes) {
      const core = vscode.workspace.getConfiguration(
        'salesforcedx-vscode-core',
        scope
      );
      const candidates = [
        core.get<string>('defaultusername'),
        core.get<string>('target-org'),
        core.get<string>('targetOrg'),
      ];
      for (const value of candidates) {
        if (value && value.trim()) {
          return value.trim();
        }
      }
    }

    // Some Salesforce extension builds expose an API command.
    try {
      const result = await vscode.commands.executeCommand<unknown>(
        'sf.org.get.default.username'
      );
      if (typeof result === 'string' && result.trim()) {
        return result.trim();
      }
      if (result && typeof result === 'object' && 'username' in result) {
        const username = (result as { username?: string }).username;
        if (username?.trim()) {
          return username.trim();
        }
      }
    } catch {
      // Command not registered — Extension Pack may be absent.
    }

    return undefined;
  }
}
