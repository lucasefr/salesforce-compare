import * as path from 'path';
import * as vscode from 'vscode';
import { CompareService } from '../services/CompareService';
import { OrgContentProvider } from '../providers/OrgContentProvider';

/**
 * Opens a Git-style diff between the local file and the cached Org version.
 *
 * @param compareService - Compare orchestrator (ensures Org snapshot exists).
 * @param orgContentProvider - Virtual content provider for the Org side.
 * @param uri - Optional URI from explorer context; falls back to active editor.
 * @returns Promise that resolves when the diff editor is shown (or aborts).
 */
export async function diffWithOrg(
  compareService: CompareService,
  orgContentProvider: OrgContentProvider,
  uri?: vscode.Uri
): Promise<void> {
  const target = uri ?? vscode.window.activeTextEditor?.document.uri;
  if (!target) {
    await vscode.window.showInformationMessage(
      'Salesforce Compare: open a Salesforce source file first.'
    );
    return;
  }

  if (!compareService.isEligible(target)) {
    await vscode.window.showInformationMessage(
      'Salesforce Compare: this file is not eligible for Org comparison.'
    );
    return;
  }

  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Salesforce Compare: retrieving Org version…',
        cancellable: false,
      },
      async () => {
        await compareService.ensureOrgContent(target);
      }
    );

    orgContentProvider.notifyChanged(target);
    const orgUri = OrgContentProvider.toOrgUri(target);
    const title = `${path.basename(target.fsPath)} (Org ↔ Local)`;
    await vscode.commands.executeCommand('vscode.diff', orgUri, target, title);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await vscode.window.showErrorMessage(`Salesforce Compare: ${message}`);
  }
}
