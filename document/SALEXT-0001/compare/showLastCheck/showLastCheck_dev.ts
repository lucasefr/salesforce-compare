import * as vscode from 'vscode';
import { CompareService } from '../services/CompareService';

/**
 * Shows information about the last Org comparison for the active file.
 *
 * @param compareService - Compare orchestrator providing formatted info.
 * @returns Promise that resolves after the message is shown.
 */
export async function showLastCheck(compareService: CompareService): Promise<void> {
  const uri = vscode.window.activeTextEditor?.document.uri;
  const info = compareService.formatLastCheckInfo(
    uri && compareService.isEligible(uri) ? uri : undefined
  );
  await vscode.window.showInformationMessage(`Salesforce Compare — ${info}`);
}
