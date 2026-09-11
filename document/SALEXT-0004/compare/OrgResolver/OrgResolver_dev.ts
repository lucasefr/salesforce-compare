import * as vscode from 'vscode';
import { SfCliAdapter } from '../infrastructure/SfCliAdapter';

/** Max wait for optional Salesforce Extension Pack API commands. */
const SF_EXTENSION_COMMAND_TIMEOUT_MS = 1500;

/**
 * Resolves the target Salesforce Org for comparisons.
 * Preference order:
 * 1. Extension setting `salesforceCompare.targetOrg`
 * 2. Salesforce Extension Pack settings (sync config keys)
 * 3. `sf config get target-org` for the workspace
 * 4. Optional Extension Pack API command (short timeout — must not block sidebar)
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
    // SALEXT-0004 - start
    const configured = vscode.workspace
      .getConfiguration('salesforceCompare')
      .get<string>('targetOrg', '')
      .trim();
    if (configured) {
      return configured;
    }

    const fromSfSettings = this.readSalesforceExtensionSettings(workspacePath);
    if (fromSfSettings) {
      return fromSfSettings;
    }

    // CLI before Extension Pack API — the API command can hang while SF Pack activates.
    const fromCli = await this.sfCli.getTargetOrg(workspacePath);
    if (fromCli) {
      return fromCli;
    }

    return this.trySalesforceExtensionCommand();
    // SALEXT-0004 - end
  }

  /**
   * Reads default username / target org from Salesforce Extension Pack settings (sync).
   *
   * @param workspacePath - Project root (used for workspace-scoped settings).
   * @returns Org identifier or undefined.
   */
  private readSalesforceExtensionSettings(
    workspacePath: string
  ): string | undefined {
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
    return undefined;
  }

  /**
   * Attempts the optional Extension Pack API command with a hard timeout.
   *
   * @returns Org identifier or undefined.
   */
  private async trySalesforceExtensionCommand(): Promise<string | undefined> {
    try {
      const result = await Promise.race([
        vscode.commands.executeCommand<unknown>('sf.org.get.default.username'),
        new Promise<undefined>((resolve) => {
          setTimeout(() => resolve(undefined), SF_EXTENSION_COMMAND_TIMEOUT_MS);
        }),
      ]);
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
