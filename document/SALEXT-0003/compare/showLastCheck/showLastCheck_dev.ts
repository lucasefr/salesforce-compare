import * as vscode from 'vscode';
import { CompareService } from '../services/CompareService';
import { FileSyncStatus } from '../services/FileStatusStore';
import { COMMANDS } from '../util/constants';

/**
 * Shows the Org comparison result for the active file.
 * Uses notification severity as a visual cue (info = equal, warning = different,
 * error = failed) because VS Code toasts cannot render custom text colors.
 *
 * @param compareService - Compare orchestrator providing formatted info and status.
 * @returns Promise that resolves after the message is shown (and optional action handled).
 */
export async function showLastCheck(compareService: CompareService): Promise<void> {
  const uri = vscode.window.activeTextEditor?.document.uri;
  const eligible = !!uri && compareService.isEligible(uri);
  const entry = eligible && uri ? compareService.getFileStatus(uri) : undefined;
  const info = compareService.formatLastCheckInfo(eligible ? uri : undefined);
  const status = entry?.status;

  // SALEXT-0003 - start
  const actions = buildActions(status);
  const selection = await showResultNotification(status, info, actions);

  if (selection === 'Diff with Org') {
    await vscode.commands.executeCommand(COMMANDS.diffWithOrg, uri);
  } else if (selection === 'Recheck') {
    await vscode.commands.executeCommand(COMMANDS.recheckFile, uri);
  }
  // SALEXT-0003 - end
}

/**
 * Shows a notification whose type matches the compare result.
 *
 * @param status - Current file sync status.
 * @param message - Human-readable summary body.
 * @param actions - Optional action button labels.
 * @returns Selected action label, or undefined when dismissed.
 */
// SALEXT-0003 - start
async function showResultNotification(
  status: FileSyncStatus | undefined,
  message: string,
  actions: string[]
): Promise<string | undefined> {
  const titled = `Salesforce Compare — ${message}`;

  switch (status) {
    case 'synced':
      // Info toast (VS Code cannot color toast text green; status bar uses green check).
      return vscode.window.showInformationMessage(titled, ...actions);
    case 'outdated':
      // Error severity → red notification icon (closest to "different" color cue).
      return vscode.window.showErrorMessage(titled, ...actions);
    case 'error':
      return vscode.window.showErrorMessage(titled, ...actions);
    case 'checking':
    case 'unknown':
    default:
      return vscode.window.showInformationMessage(titled, ...actions);
  }
}

/**
 * Builds contextual action buttons for the result notification.
 *
 * @param status - Current file sync status.
 * @returns Action labels to offer in the toast.
 */
function buildActions(status: FileSyncStatus | undefined): string[] {
  if (status === 'outdated') {
    return ['Diff with Org', 'Recheck'];
  }
  if (status === 'error' || status === 'checking' || status === 'unknown') {
    return ['Recheck'];
  }
  if (status === 'synced') {
    return ['Recheck'];
  }
  return [];
}
// SALEXT-0003 - end
