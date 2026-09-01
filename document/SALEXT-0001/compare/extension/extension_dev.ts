import * as vscode from 'vscode';
import { diffWithOrg } from './commands/diffWithOrg';
import { recheckFile } from './commands/recheckFile';
import { showLastCheck } from './commands/showLastCheck';
import { OrgSnapshotCache } from './infrastructure/OrgSnapshotCache';
import { SfCliAdapter } from './infrastructure/SfCliAdapter';
import { OrgContentProvider } from './providers/OrgContentProvider';
import { StatusDecorationProvider } from './providers/StatusDecorationProvider';
import { CompareService } from './services/CompareService';
import { DeployWatcher } from './services/DeployWatcher';
import { FileStatusStore } from './services/FileStatusStore';
import { OrgResolver } from './services/OrgResolver';
import { StatusBarController } from './ui/StatusBarController';
import { COMMANDS, CONTEXT_IS_ELIGIBLE, ORG_SCHEME } from './util/constants';
import { SalesforcePathMapper } from './util/SalesforcePathMapper';

/** URIs currently being saved by the user (to ignore external-sync handlers). */
const userSaveInProgress = new Set<string>();

/** Debounced external content sync timers per file URI. */
const externalSyncTimers = new Map<string, NodeJS.Timeout>();

/**
 * Activates the Salesforce Compare extension: wires services, UI providers,
 * commands, open/save listeners, and deploy/retrieve detection.
 *
 * @param context - VS Code extension context.
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const sfCli = new SfCliAdapter();
  const orgResolver = new OrgResolver(sfCli);
  const store = new FileStatusStore();
  const cache = new OrgSnapshotCache(context.globalStorageUri);
  await cache.initialize();

  const compareService = new CompareService(sfCli, orgResolver, cache, store);
  const orgContentProvider = new OrgContentProvider(cache);
  const decorationProvider = new StatusDecorationProvider(store);
  const statusBar = new StatusBarController(store, compareService);
  const deployWatcher = new DeployWatcher(compareService);
  deployWatcher.start();

  context.subscriptions.push(
    store,
    orgContentProvider,
    decorationProvider,
    statusBar,
    deployWatcher,
    vscode.workspace.registerTextDocumentContentProvider(ORG_SCHEME, orgContentProvider),
    vscode.window.registerFileDecorationProvider(decorationProvider)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(COMMANDS.diffWithOrg, (uri?: vscode.Uri) =>
      diffWithOrg(compareService, orgContentProvider, uri)
    ),
    vscode.commands.registerCommand(COMMANDS.recheckFile, (uri?: vscode.Uri) =>
      recheckFile(compareService, uri)
    ),
    vscode.commands.registerCommand(COMMANDS.showLastCheck, () =>
      showLastCheck(compareService)
    ),
    vscode.commands.registerCommand(COMMANDS.clearCache, async () => {
      await cache.clear();
      store.clear();
      await vscode.window.showInformationMessage('Salesforce Compare: cache cleared.');
    })
  );

  const updateEligibleContext = (uri: vscode.Uri | undefined): void => {
    const eligible = !!uri && compareService.isEligible(uri);
    void vscode.commands.executeCommand('setContext', CONTEXT_IS_ELIGIBLE, eligible);
  };

  updateEligibleContext(vscode.window.activeTextEditor?.document.uri);

  /**
   * Schedules a sync when document content was updated externally (e.g. Org retrieve).
   *
   * @param uri - File URI to sync.
   */
  const scheduleExternalContentSync = (uri: vscode.Uri): void => {
    const key = SalesforcePathMapper.toCacheKey(uri);
    if (userSaveInProgress.has(key)) {
      return;
    }

    const existing = externalSyncTimers.get(key);
    if (existing) {
      clearTimeout(existing);
    }

    externalSyncTimers.set(
      key,
      setTimeout(() => {
        externalSyncTimers.delete(key);
        if (userSaveInProgress.has(key)) {
          return;
        }
        const doc = vscode.workspace.textDocuments.find(
          (d) => d.uri.toString() === uri.toString()
        );
        if (doc?.isDirty) {
          return;
        }
        void compareService.syncLocalWithOrgSnapshot(uri);
      }, 700)
    );
  };

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      updateEligibleContext(editor?.document.uri);
    }),
    vscode.workspace.onWillSaveTextDocument((event) => {
      if (event.document.uri.scheme !== 'file') {
        return;
      }
      if (!compareService.isEligible(event.document.uri)) {
        return;
      }
      // Only ignore external-sync handlers for user-initiated saves.
      if (
        event.reason === vscode.TextDocumentSaveReason.AfterDelay ||
        event.reason === vscode.TextDocumentSaveReason.FocusOut ||
        event.reason === vscode.TextDocumentSaveReason.Manual
      ) {
        const key = SalesforcePathMapper.toCacheKey(event.document.uri);
        userSaveInProgress.add(key);
        setTimeout(() => userSaveInProgress.delete(key), 3000);
      }
    }),
    vscode.workspace.onDidOpenTextDocument((document) => {
      if (document.uri.scheme !== 'file') {
        return;
      }
      const autoCheck = vscode.workspace
        .getConfiguration('salesforceCompare')
        .get<boolean>('autoCheckOnOpen', true);
      if (autoCheck && compareService.isEligible(document.uri)) {
        void compareService.compareFile(document.uri);
      }
    }),
    vscode.workspace.onDidSaveTextDocument((document) => {
      if (document.uri.scheme !== 'file') {
        return;
      }
      if (compareService.isEligible(document.uri)) {
        compareService.markFromLocalSave(document.uri, document.getText());
      }
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.uri.scheme !== 'file') {
        return;
      }
      if (!compareService.isEligible(event.document.uri)) {
        return;
      }
      if (event.document.isDirty) {
        return;
      }
      scheduleExternalContentSync(event.document.uri);
    })
  );

  const autoCheck = vscode.workspace
    .getConfiguration('salesforceCompare')
    .get<boolean>('autoCheckOnOpen', true);
  if (autoCheck) {
    for (const document of vscode.workspace.textDocuments) {
      if (document.uri.scheme === 'file' && compareService.isEligible(document.uri)) {
        void compareService.compareFile(document.uri);
      }
    }
  }
}

/**
 * Disposes resources when the extension is deactivated.
 */
export function deactivate(): void {
  for (const timer of externalSyncTimers.values()) {
    clearTimeout(timer);
  }
  externalSyncTimers.clear();
  userSaveInProgress.clear();
}
