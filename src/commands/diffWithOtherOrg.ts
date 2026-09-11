import * as path from 'path';
import * as vscode from 'vscode';
import { CompareService } from '../services/CompareService';
import { ComparisonTempFileService } from '../services/ComparisonTempFileService';
import { OrgConnectionService } from '../services/OrgConnectionService';
import { runRetrieveWithAuthRetry } from '../util/retrieveWithAuthRetry';

/**
 * Opens a Local x Other Org comparison:
 * 1) Writes a temporary Org snapshot named `File.LOCAL_x_ORG.ext` (blue label)
 * 2) Opens vscode.diff with the local file on the left and the Org temp on the right
 *    (no extra editor split)
 *
 * Never deploys. Requires at least one connected comparison Org.
 *
 * @param compareService - Compare orchestrator (retrieve + cache for the chosen Org).
 * @param orgConnectionService - Provides the list of comparison Orgs + auth recovery.
 * @param tempFiles - Writes/tracks comparison Org temp snapshot files.
 * @param uri - Optional URI from explorer context; falls back to active editor.
 * @returns Promise that resolves when the diff is shown (or aborts).
 */
export async function diffWithOtherOrg(
  compareService: CompareService,
  orgConnectionService: OrgConnectionService,
  tempFiles: ComparisonTempFileService,
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

  const comparisonOrgs = orgConnectionService.getComparisonOrgs();
  if (comparisonOrgs.length === 0) {
    await vscode.window.showInformationMessage(
      'Salesforce Compare: connect a comparison Org in the Salesforce Compare sidebar first.'
    );
    return;
  }

  const picks = comparisonOrgs.map((org) => ({
    label: org.alias,
    description: org.username && org.username !== org.alias ? org.username : undefined,
    detail: `Creates temp + diff (${ComparisonTempFileService.formatLocalVsOrgLabel(org.alias)})`,
    org,
  }));

  const selected = await vscode.window.showQuickPick(picks, {
    placeHolder: 'Select comparison Org',
    title: 'Salesforce Compare — Diff with Other Org',
  });
  if (!selected) {
    return;
  }

  const orgAlias = selected.org.alias;
  const localName = path.basename(target.fsPath);
  const compareLabel = ComparisonTempFileService.formatLocalVsOrgLabel(orgAlias);

  const content = await runRetrieveWithAuthRetry({
    progressTitle: `Salesforce Compare: retrieving "${localName}"…`,
    orgAlias,
    retrieve: () => compareService.ensureOrgContentForOrg(target, orgAlias),
    onAuthFailure: (alias, message) =>
      orgConnectionService.markAuthFailure(alias, message),
  });

  if (content === undefined) {
    return;
  }

  // SALEXT-0004 - start
  const tempInfo = await tempFiles.createOrUpdate(target, orgAlias, content);

  // Local workspace on the left, Org temp snapshot on the right — no separate split tab.
  const title = `${localName} — ${compareLabel}`;
  await vscode.commands.executeCommand(
    'vscode.diff',
    target,
    tempInfo.uri,
    title,
    { preview: false }
  );
  // SALEXT-0004 - end
}
