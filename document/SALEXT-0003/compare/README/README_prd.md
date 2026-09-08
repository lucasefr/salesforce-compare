# Salesforce Compare

VS Code / Cursor extension that compares local Salesforce DX source files with the connected Org (retrieve-only). It shows sync status on tabs/explorer and opens a Git-style diff against the Org version.

## Features

- **Auto-check on open** — when you open an eligible Salesforce source file, the extension retrieves the Org version in the background and compares it locally.
- **Tab / Explorer flags** — green `●` when in sync, red `●` when outdated, `…` while checking, `!` on error.
- **Diff with Org** — command and right-click menu open a side-by-side diff (Org ↔ Local).
- **Save awareness** — saving local changes marks the file as outdated when it no longer matches the last Org snapshot.
- **Deploy awareness** — after a successful `sf project deploy` (terminal) or known Salesforce Extension Pack deploy signals, open eligible files are rechecked.
- **Last check info** — status bar + command show when the last comparison ran and which Org was used.
- **Never deploys** — the extension only runs retrieve for comparison.

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

Then in VS Code / Cursor: **Extensions → … → Install from VSIX…** and select the generated `.vsix`.

## Commands

| Command | Description |
|---------|-------------|
| `Salesforce Compare: Diff with Org` | Retrieve (if needed) and open Org ↔ Local diff |
| `Salesforce Compare: Recheck Current File` | Force a fresh retrieve/compare |
| `Salesforce Compare: Show Last Check Info` | Show last comparison age / org / status |
| `Salesforce Compare: Clear Cache` | Clear Org snapshot cache and statuses |

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `salesforceCompare.enabled` | `true` | Enable the extension |
| `salesforceCompare.autoCheckOnOpen` | `true` | Compare when opening eligible files |
| `salesforceCompare.targetOrg` | `""` | Optional org override (alias/username) |
| `salesforceCompare.supportedExtensions` | `.cls`, `.trigger`, `.js`, … | Extensions considered for eligibility |

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

- **SfCliAdapter** — only module that shells out to `sf` (retrieve only)
- **OrgResolver** — picks target org (setting → SF Extension → CLI)
- **CompareService** — retrieve → cache → hash → status
- **FileDecorationProvider** — green/red badges
- **DeployWatcher** — reacts to deploy success, never deploys
