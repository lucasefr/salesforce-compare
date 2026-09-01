import * as vscode from 'vscode';
import { CompareService } from '../services/CompareService';

/**
 * Forces a fresh retrieve/compare for the current or provided file.
 *
 * @param compareService - Compare orchestrator.
 * @param uri - Optional URI from explorer context; falls back to active editor.
 * @returns Promise that resolves when the recheck finishes.
 */
export async function recheckFile(
  compareService: CompareService,
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

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Salesforce Compare: rechecking with Org…',
      cancellable: false,
    },
    async () => {
      await compareService.compareFile(target, { force: true });
    }
  );
}
