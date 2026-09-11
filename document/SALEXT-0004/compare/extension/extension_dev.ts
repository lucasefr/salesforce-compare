import * as vscode from 'vscode';
import { diffWithOrg } from './commands/diffWithOrg';
import { diffWithOtherOrg } from './commands/diffWithOtherOrg';
import { recheckFile } from './commands/recheckFile';
import { showLastCheck } from './commands/showLastCheck';
import { OrgSnapshotCache } from './infrastructure/OrgSnapshotCache';
import { SfCliAdapter } from './infrastructure/SfCliAdapter';
import { OrgContentProvider } from './providers/OrgContentProvider';
import { ComparisonFileDecorationProvider } from './providers/ComparisonFileDecorationProvider';
import { StatusDecorationProvider } from './providers/StatusDecorationProvider';
import { CompareService } from './services/CompareService';
import { ComparisonTempFileService } from './services/ComparisonTempFileService';
import { ConnectedOrgsStore } from './services/ConnectedOrgsStore';
import { DeployWatcher } from './services/DeployWatcher';
import { FileStatusStore } from './services/FileStatusStore';
import { OrgAuthStatusStore } from './services/OrgAuthStatusStore';
import { OrgConnectionService } from './services/OrgConnectionService';
import { OrgResolver } from './services/OrgResolver';
import { OrgSidebarDecorationProvider } from './providers/OrgSidebarDecorationProvider';
import { ConnectedOrgTreeItem, ConnectedOrgsTreeProvider } from './ui/ConnectedOrgsTreeProvider';
import { StatusBarController } from './ui/StatusBarController';
import {
  COMMANDS,
  CONNECTED_ORGS_VIEW_ID,
  CONTEXT_IS_ELIGIBLE,
  ORG_SCHEME,
} from './util/constants';
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

  // SALEXT-0004 - start
  const connectedOrgsStore = new ConnectedOrgsStore(context.workspaceState);
  const orgAuthStatusStore = new OrgAuthStatusStore();
  const orgConnectionService = new OrgConnectionService(
    sfCli,
    orgResolver,
    connectedOrgsStore,
    orgAuthStatusStore
  );
  const connectedOrgsTree = new ConnectedOrgsTreeProvider(
    orgConnectionService,
    orgAuthStatusStore
  );
  const comparisonTempFiles = new ComparisonTempFileService(context.globalStorageUri);
  await comparisonTempFiles.initialize();
  const comparisonDecorationProvider = new ComparisonFileDecorationProvider(
    comparisonTempFiles
  );
  const orgSidebarDecorationProvider = new OrgSidebarDecorationProvider(
    orgAuthStatusStore
  );
  compareService.setAuthRecoveryHandler(orgConnectionService);
  await orgConnectionService.refreshHasComparisonOrgsContext();
  // SALEXT-0004 - end

  context.subscriptions.push(
    store,
    orgContentProvider,
    decorationProvider,
    statusBar,
    deployWatcher,
    // SALEXT-0004 - start
    connectedOrgsStore,
    orgAuthStatusStore,
    connectedOrgsTree,
    comparisonTempFiles,
    comparisonDecorationProvider,
    orgSidebarDecorationProvider,
    // SALEXT-0004 - end
    vscode.workspace.registerTextDocumentContentProvider(ORG_SCHEME, orgContentProvider),
    vscode.window.registerFileDecorationProvider(decorationProvider),
    // SALEXT-0004 - start
    vscode.window.registerFileDecorationProvider(comparisonDecorationProvider),
    vscode.window.registerFileDecorationProvider(orgSidebarDecorationProvider),
    vscode.window.registerTreeDataProvider(CONNECTED_ORGS_VIEW_ID, connectedOrgsTree),
    connectedOrgsStore.onDidChange(() => {
      void connectedOrgsTree.refresh();
      void orgConnectionService.refreshHasComparisonOrgsContext();
    })
    // SALEXT-0004 - end
  );

  // SALEXT-0004 - start
  // Register the tree first, then resolve Original Org so the first paint is correct.
  await connectedOrgsTree.initialize();
  // SALEXT-0004 - end

  context.subscriptions.push(
    vscode.commands.registerCommand(COMMANDS.diffWithOrg, (uri?: vscode.Uri) =>
      diffWithOrg(compareService, orgContentProvider, orgConnectionService, uri)
    ),
    vscode.commands.registerCommand(COMMANDS.recheckFile, (uri?: vscode.Uri) =>
      recheckFile(compareService, orgConnectionService, uri)
    ),
    vscode.commands.registerCommand(COMMANDS.showLastCheck, () =>
      showLastCheck(compareService)
    ),
    vscode.commands.registerCommand(COMMANDS.clearCache, async () => {
      await cache.clear();
      store.clear();
      await vscode.window.showInformationMessage('Salesforce Compare: cache cleared.');
    }),
    // SALEXT-0004 - start
    vscode.commands.registerCommand(COMMANDS.diffWithOtherOrg, (uri?: vscode.Uri) =>
      diffWithOtherOrg(compareService, orgConnectionService, comparisonTempFiles, uri)
    ),
    vscode.commands.registerCommand(
      COMMANDS.disconnectComparisonOrg,
      async (item?: ConnectedOrgTreeItem) => {
        const alias =
          item?.role === 'comparison'
            ? item.alias
            : (
                await vscode.window.showQuickPick(
                  orgConnectionService.getComparisonOrgs().map((org) => org.alias),
                  { placeHolder: 'Select Org to disconnect' }
                )
              );
        if (!alias) {
          return;
        }
        await orgConnectionService.disconnectComparisonOrg(alias);
        await connectedOrgsTree.refresh();
      }
    ),
    vscode.commands.registerCommand(
      COMMANDS.reconnectOrg,
      async (item?: ConnectedOrgTreeItem) => {
        const alias =
          item?.alias ||
          (await vscode.window.showInputBox({
            prompt: 'Org alias to reconnect',
            placeHolder: 'e.g. uat',
          }));
        if (!alias?.trim()) {
          return;
        }
        const role = item?.role ?? 'comparison';
        const ok = await orgConnectionService.reconnectOrg(alias.trim(), role);
        if (ok) {
          await connectedOrgsTree.refresh();
        }
      }
    ),
    vscode.commands.registerCommand(COMMANDS.loginOrg, async () => {
      await orgConnectionService.loginOrg();
      await connectedOrgsTree.refresh();
    }),
    vscode.commands.registerCommand(COMMANDS.refreshConnectedOrgs, async () => {
      await connectedOrgsTree.refreshFromCli();
      await orgConnectionService.refreshHasComparisonOrgsContext();
    })
    // SALEXT-0004 - end
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
