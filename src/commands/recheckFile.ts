import * as path from 'path';
import * as vscode from 'vscode';
import { CompareService } from '../services/CompareService';
import { OrgConnectionService } from '../services/OrgConnectionService';
import {
  AuthenticationRequiredError,
  isAuthenticationError,
} from '../util/authErrors';
import { runRetrieveWithAuthRetry } from '../util/retrieveWithAuthRetry';

/**
 * Forces a fresh retrieve/compare for the current or provided file.
 *
 * @param compareService - Compare orchestrator.
 * @param orgConnectionService - Optional auth recovery for Authorize an Org.
 * @param uri - Optional URI from explorer context; falls back to active editor.
 * @returns Promise that resolves when the recheck finishes.
 */
export async function recheckFile(
  compareService: CompareService,
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
  await runRetrieveWithAuthRetry({
    progressTitle: `Salesforce Compare: retrieving "${localName}"…`,
    orgAlias: compareService.getFileStatus(target)?.targetOrg,
    retrieve: async () => {
      await compareService.compareFile(target, {
        force: true,
        skipAuthRecovery: true,
      });
      const entry = compareService.getFileStatus(target);
      if (entry?.status === 'error') {
        const message = entry.message || 'Compare failed.';
        if (isAuthenticationError(message)) {
          throw new AuthenticationRequiredError(message, entry.targetOrg);
        }
        throw new Error(message);
      }
      return true;
    },
    onAuthFailure: (orgAlias, message) => {
      orgConnectionService?.markAuthFailure(orgAlias, message);
    },
  });
}
