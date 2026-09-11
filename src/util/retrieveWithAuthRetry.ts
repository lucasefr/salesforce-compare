import * as vscode from 'vscode';
import {
  AuthenticationRequiredError,
  isAuthenticationError,
} from './authErrors';

/**
 * Runs a retrieve inside a progress notification. On failure, dismisses the
 * progress and shows the error. Auth failures are reported via `onAuthFailure`
 * so the Connected Orgs sidebar can mark the Org in red — Authorize is NOT
 * opened automatically.
 *
 * @param options - Progress title, retrieve callback, and optional auth marker.
 * @returns Retrieve result, or undefined when retrieve failed.
 */
export async function runRetrieveWithAuthRetry<T>(options: {
  progressTitle: string;
  orgAlias?: string;
  retrieve: () => Promise<T>;
  /** Marks the Org as auth-failed in the sidebar (no auto wizard). */
  onAuthFailure?: (orgAlias: string | undefined, errorMessage: string) => void;
}): Promise<T | undefined> {
  try {
    return await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: options.progressTitle,
        cancellable: false,
      },
      async () => options.retrieve()
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const orgAlias =
      error instanceof AuthenticationRequiredError
        ? error.orgAlias ?? options.orgAlias
        : options.orgAlias;

    // Progress is already closed here — show error only.
    await vscode.window.showErrorMessage(`Salesforce Compare: ${message}`);

    if (
      isAuthenticationError(message) ||
      error instanceof AuthenticationRequiredError
    ) {
      options.onAuthFailure?.(orgAlias, message);
    }

    return undefined;
  }
}
