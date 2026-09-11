import * as vscode from 'vscode';

/**
 * Auth health entry for a connected Org shown in the sidebar.
 */
export interface OrgAuthStatus {
  /** Org alias/username key. */
  alias: string;
  /** True when the last operation failed due to authentication. */
  hasAuthError: boolean;
  /** Last auth-related error message, when any. */
  message?: string;
  /** Epoch ms of the last status update. */
  updatedAt: number;
}

/**
 * In-memory store of per-Org authentication health for the Connected Orgs sidebar.
 * Auth errors turn the Org label red until the user reconnects successfully.
 */
export class OrgAuthStatusStore {
  private readonly byAlias = new Map<string, OrgAuthStatus>();
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  /** Fires when any Org auth status changes. */
  public readonly onDidChange = this._onDidChange.event;

  /**
   * Marks an Org as having an authentication failure (sidebar label turns red).
   *
   * @param alias - Org alias/username.
   * @param message - Error text from the CLI/API.
   */
  public markAuthError(alias: string, message: string): void {
    const key = this.normalize(alias);
    if (!key) {
      return;
    }
    this.byAlias.set(key, {
      alias: alias.trim(),
      hasAuthError: true,
      message,
      updatedAt: Date.now(),
    });
    this._onDidChange.fire();
  }

  /**
   * Clears the authentication error for an Org (sidebar label returns to normal).
   * Deletes the entry so FileDecoration does not stick on the previous URI.
   *
   * @param alias - Org alias/username.
   */
  public clearAuthError(alias: string): void {
    const key = this.normalize(alias);
    if (!key) {
      return;
    }
    this.byAlias.delete(key);
    this._onDidChange.fire();
  }

  /**
   * Clears auth errors for one or more aliases (e.g. sidebar alias + username).
   *
   * @param aliases - Org aliases/usernames to clear.
   */
  public clearAuthErrors(aliases: Array<string | undefined>): void {
    let changed = false;
    for (const alias of aliases) {
      const key = this.normalize(alias ?? '');
      if (!key) {
        continue;
      }
      if (this.byAlias.delete(key)) {
        changed = true;
      }
    }
    if (changed) {
      this._onDidChange.fire();
    } else {
      // Still notify listeners so decorations/tree refresh after reconnect.
      this._onDidChange.fire();
    }
  }

  /**
   * Returns whether the Org currently has an auth error.
   *
   * @param alias - Org alias/username.
   * @returns True when the sidebar should render the Org in red.
   */
  public hasAuthError(alias: string): boolean {
    const entry = this.byAlias.get(this.normalize(alias));
    return entry?.hasAuthError === true;
  }

  /**
   * Returns the stored auth status for an Org, if any.
   *
   * @param alias - Org alias/username.
   * @returns Status entry or undefined.
   */
  public get(alias: string): OrgAuthStatus | undefined {
    return this.byAlias.get(this.normalize(alias));
  }

  /**
   * Disposes the change emitter.
   */
  public dispose(): void {
    this._onDidChange.dispose();
  }

  /**
   * Normalizes an Org alias for map lookups.
   *
   * @param alias - Raw alias.
   * @returns Lowercase trimmed key.
   */
  private normalize(alias: string): string {
    return alias.trim().toLowerCase();
  }
}
