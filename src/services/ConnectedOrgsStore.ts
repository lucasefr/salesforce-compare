import * as vscode from 'vscode';
import { COMPARISON_ORGS_STORAGE_KEY } from '../util/constants';

/**
 * Persisted comparison Org entry (secondary Orgs used only for Local ↔ Org diff).
 */
export interface ComparisonOrgEntry {
  /** Org alias or username used with `--target-org`. */
  alias: string;
  /** Login username when known. */
  username?: string;
  /** Epoch ms when the Org was added to this workspace. */
  addedAt: number;
}

/**
 * Workspace-scoped store of comparison Orgs for Salesforce Compare.
 * The Original Org is never stored here — it comes from OrgResolver.
 */
export class ConnectedOrgsStore {
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  /** Fires when the comparison Org list changes. */
  public readonly onDidChange = this._onDidChange.event;

  /**
   * Creates the store bound to the current workspace state.
   *
   * @param workspaceState - ExtensionContext.workspaceState for persistence.
   */
  constructor(private readonly workspaceState: vscode.Memento) {}

  /**
   * Returns all comparison Orgs configured for this workspace.
   *
   * @returns Copy of the comparison Org list (may be empty).
   */
  public getComparisonOrgs(): ComparisonOrgEntry[] {
    const stored = this.workspaceState.get<ComparisonOrgEntry[]>(
      COMPARISON_ORGS_STORAGE_KEY,
      []
    );
    return Array.isArray(stored) ? [...stored] : [];
  }

  /**
   * Returns whether at least one comparison Org is configured.
   *
   * @returns True when Diff with Other Org can be offered.
   */
  public hasComparisonOrgs(): boolean {
    return this.getComparisonOrgs().length > 0;
  }

  /**
   * Adds a comparison Org if it is not already present (match by alias).
   *
   * @param entry - Org alias/username to add.
   * @returns True when a new entry was added; false when it already existed.
   */
  public async addComparisonOrg(entry: ComparisonOrgEntry): Promise<boolean> {
    const current = this.getComparisonOrgs();
    const aliasKey = entry.alias.trim().toLowerCase();
    if (current.some((org) => org.alias.trim().toLowerCase() === aliasKey)) {
      return false;
    }
    current.push({
      alias: entry.alias.trim(),
      username: entry.username?.trim() || undefined,
      addedAt: entry.addedAt || Date.now(),
    });
    await this.workspaceState.update(COMPARISON_ORGS_STORAGE_KEY, current);
    this._onDidChange.fire();
    return true;
  }

  /**
   * Updates the username of an existing comparison Org without removing it.
   *
   * @param alias - Org alias to update.
   * @param username - Username to store.
   * @returns True when an entry was updated.
   */
  public async updateComparisonOrgUsername(
    alias: string,
    username: string
  ): Promise<boolean> {
    const aliasKey = alias.trim().toLowerCase();
    const current = this.getComparisonOrgs();
    const index = current.findIndex(
      (org) => org.alias.trim().toLowerCase() === aliasKey
    );
    if (index < 0) {
      return false;
    }
    const trimmedUsername = username.trim();
    if (current[index].username === trimmedUsername) {
      return false;
    }
    current[index] = {
      ...current[index],
      username: trimmedUsername || undefined,
    };
    await this.workspaceState.update(COMPARISON_ORGS_STORAGE_KEY, current);
    this._onDidChange.fire();
    return true;
  }

  /**
   * Removes a comparison Org by alias (case-insensitive).
   *
   * @param alias - Org alias/username to remove.
   * @returns True when an entry was removed.
   */
  public async removeComparisonOrg(alias: string): Promise<boolean> {
    const aliasKey = alias.trim().toLowerCase();
    const current = this.getComparisonOrgs();
    const next = current.filter((org) => org.alias.trim().toLowerCase() !== aliasKey);
    if (next.length === current.length) {
      return false;
    }
    await this.workspaceState.update(COMPARISON_ORGS_STORAGE_KEY, next);
    this._onDidChange.fire();
    return true;
  }

  /**
   * Disposes the change emitter.
   */
  public dispose(): void {
    this._onDidChange.dispose();
  }
}
