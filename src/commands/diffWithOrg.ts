import * as path from 'path';
import * as vscode from 'vscode';
import { CompareService } from '../services/CompareService';
import { OrgContentProvider } from '../providers/OrgContentProvider';
import { OrgConnectionService } from '../services/OrgConnectionService';
import { runRetrieveWithAuthRetry } from '../util/retrieveWithAuthRetry';

/**
 * Opens a Git-style diff between the local file and the cached Org version.
 *
 * @param compareService - Compare orchestrator (ensures Org snapshot exists).
 * @param orgContentProvider - Virtual content provider for the Org side.
 * @param orgConnectionService - Optional auth recovery for Authorize an Org.
 * @param uri - Optional URI from explorer context; falls back to active editor.
 * @returns Promise that resolves when the diff editor is shown (or aborts).
 */
export async function diffWithOrg(
  compareService: CompareService,
  orgContentProvider: OrgContentProvider,
  orgConnectionService?: OrgConnectionService,
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

  const localName = path.basename(target.fsPath);
  const content = await runRetrieveWithAuthRetry({
    progressTitle: `Salesforce Compare: retrieving "${localName}"…`,
    orgAlias: compareService.getFileStatus(target)?.targetOrg,
    retrieve: () => compareService.ensureOrgContent(target),
    onAuthFailure: (orgAlias, message) => {
      orgConnectionService?.markAuthFailure(orgAlias, message);
    },
  });

  if (content === undefined) {
    return;
  }

  orgContentProvider.notifyChanged(target);
  const orgUri = OrgContentProvider.toOrgUri(target);
  // SALEXT-0004 - start
  const status = compareService.getFileStatus(target);
  const originalAlias = status?.targetOrg?.trim();
  const title = originalAlias
    ? `${localName} — LOCAL x ${originalAlias.toUpperCase()}`
    : `${localName} — LOCAL x ORIGINAL`;
  // SALEXT-0004 - end
  await vscode.commands.executeCommand('vscode.diff', orgUri, target, title);
}
