# Salesforce Compare

VS Code / Cursor extension that compares local Salesforce DX source files with the connected Org (retrieve-only). It shows sync status on tabs/explorer and opens a Git-style diff against the Org version.

## Features

- **Auto-check on open** â€” when you open an eligible Salesforce source file, the extension retrieves the Org version in the background and compares it locally.
- **Tab / Explorer flags** â€” green `â—` when in sync, red `â—` when outdated, `â€¦` while checking, `!` on error.
- **Diff with Org** â€” command and right-click menu open a side-by-side diff (Org â†” Local).
- **Save awareness** â€” saving local changes marks the file as outdated when it no longer matches the last Org snapshot.
- **Deploy awareness** â€” after a successful `sf project deploy` (terminal) or known Salesforce Extension Pack deploy signals, open eligible files are rechecked.
- **Last check info** â€” status bar + command show when the last comparison ran and which Org was used.
- **Never deploys** â€” the extension only runs retrieve for comparison.

## Prerequisites

- [Salesforce CLI](https://developer.salesforce.com/tools/salesforcecli) (`sf`) on PATH
- A project with `sfdx-project.json`
- An authenticated target org
- Recommended: [Salesforce Extension Pack](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode) so the default org can be reused

## Install

### From Visual Studio Marketplace (recommended)

1. Open **Extensions** in VS Code (`Ctrl+Shift+X`)
2. Search for **Salesforce Compare**
3. Click **Install**

Or install directly: [Salesforce Compare on Marketplace](https://marketplace.visualstudio.com/items?itemName=LeftConsult.salesforce-compare)

### From VSIX (manual)

```bash
npm install
npm run build
npm run package
```

Then in VS Code / Cursor: **Extensions â†’ â€¦ â†’ Install from VSIXâ€¦** and select the generated `.vsix`.

## Commands

| Command | Description |
|---------|-------------|
| `Salesforce Compare: Diff with Org` | Retrieve (if needed) and open Org â†” Local diff |
| `Salesforce Compare: Recheck Current File` | Force a fresh retrieve/compare |
| `Salesforce Compare: Show Last Check Info` | Show last comparison age / org / status |
| `Salesforce Compare: Clear Cache` | Clear Org snapshot cache and statuses |

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `salesforceCompare.enabled` | `true` | Enable the extension |
| `salesforceCompare.autoCheckOnOpen` | `true` | Compare when opening eligible files |
| `salesforceCompare.targetOrg` | `""` | Optional org override (alias/username) |
| `salesforceCompare.supportedExtensions` | `.cls`, `.trigger`, `.js`, â€¦ | Extensions considered for eligibility |

## Org resolution order

1. `salesforceCompare.targetOrg` setting
2. Salesforce Extension Pack default username / target org
3. `sf config get target-org` for the workspace

## Eligible files (MVP)

Files under typical DX layouts (`force-app` / `main/default`), including:

- Apex: `.cls`, `.trigger`
- LWC / Aura: `.js`, `.html`, `.css` under `lwc/` or `aura/`
- Other: `.page`, `.component`, relevant `.xml`

## Development

```bash
npm install
npm run watch
```

Press **F5** in VS Code/Cursor to launch an Extension Development Host.

## Architecture (short)

- **SfCliAdapter** â€” only module that shells out to `sf` (retrieve only)
- **OrgResolver** â€” picks target org (setting â†’ SF Extension â†’ CLI)
- **CompareService** â€” retrieve â†’ cache â†’ hash â†’ status
- **FileDecorationProvider** â€” green/red badges
- **DeployWatcher** â€” reacts to deploy success, never deploys

