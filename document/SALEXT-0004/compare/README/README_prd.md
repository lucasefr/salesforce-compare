# Salesforce Compare

VS Code / Cursor extension that compares local Salesforce DX source files with the connected Org (**retrieve-only**). It shows sync status on tabs/explorer and opens a Git-style diff against the Org version.

**Current version:** `0.1.2` ┬À Publisher: [LeftConsult](https://marketplace.visualstudio.com/items?itemName=LeftConsult.salesforce-compare)

- **VS Code / Visual Studio Marketplace:** [LeftConsult.salesforce-compare](https://marketplace.visualstudio.com/items?itemName=LeftConsult.salesforce-compare)
- **Cursor (Open VSX):** [open-vsx.org/extension/LeftConsult/salesforce-compare](https://open-vsx.org/extension/LeftConsult/salesforce-compare) ÔÇö after Open VSX publish, search **Salesforce Compare** in Cursor Extensions

## What's new in 0.1.2

- **Metadata XML** ÔÇö compare standalone Salesforce `*-meta.xml` files (objects, fields, layouts, flows, permission sets, profiles, flexipages, validation rules, etc.), not only Apex classes/triggers
- **Background queue** ÔÇö opening or switching files does **not** cancel prior compares; each file finishes in the background and updates its own badge
- **Clear Equal / Different UI** ÔÇö status bar shows `SF Equal` / `SF Different` / `SF ComparingÔÇª`; Show Last Check toast states the result with color cues and optional Diff / Recheck actions
- **Setting** `salesforceCompare.maxConcurrentCompares` (default `2`) ÔÇö how many Org retrieves run in parallel

See [CHANGELOG.md](CHANGELOG.md) for the full history.

## Features

- **Auto-check on open** ÔÇö when you open an eligible Salesforce source file, the extension retrieves the Org version in the background and compares it locally. Opening another file queues a new job without cancelling previous ones; each fileÔÇÖs tab/explorer badge updates when its own compare finishes.
- **Tab / Explorer flags** ÔÇö green `ÔùÅ` when equal to Org, red `ÔùÅ` when different, `ÔÇª` while checking, `!` on error.
- **Status bar result** ÔÇö `SF Equal` (green check), `SF Different` (red highlight), `SF ComparingÔÇª`, or `SF Error`. Click it for the detailed toast.
- **Show Compare Result** ÔÇö toast with **Equal to Org** / **Different from Org** / **ComparingÔÇª**, last check age, Org, and background job count; Diff / Recheck actions when useful.
- **Diff with Org** ÔÇö command and right-click menu open a side-by-side diff (Org Ôåö Local).
- **Save awareness** ÔÇö saving local changes marks the file as different when it no longer matches the last Org snapshot.
- **Deploy awareness** ÔÇö after a successful `sf project deploy` (terminal) or known Salesforce Extension Pack deploy signals, open eligible files are rechecked.
- **Never deploys** ÔÇö the extension only runs retrieve for comparison.

## Status meanings

| UI label | Internal status | Meaning |
|----------|-----------------|--------|
| Equal to Org / `SF Equal` | `synced` | Local content matches the last Org snapshot |
| Different from Org / `SF Different` | `outdated` | Local content differs from the Org |
| Comparing with OrgÔÇª / `SF ComparingÔÇª` | `checking` | Retrieve/compare in progress (or queued) |
| Compare failed / `SF Error` | `error` | Retrieve or compare failed |

## Prerequisites

- [Salesforce CLI](https://developer.salesforce.com/tools/salesforcecli) (`sf`) on PATH
- A project with `sfdx-project.json`
- An authenticated target org
- Recommended: [Salesforce Extension Pack](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode) so the default org can be reused

## Install

### From Visual Studio Marketplace (VS Code)

1. Open **Extensions** in VS Code (`Ctrl+Shift+X`)
2. Search for **Salesforce Compare**
3. Click **Install** (or **Update** to get `0.1.2`)

Or install directly: [Salesforce Compare on Marketplace](https://marketplace.visualstudio.com/items?itemName=LeftConsult.salesforce-compare)

### From Cursor (Open VSX)

Cursor uses the [Open VSX](https://open-vsx.org/) registry (not the Microsoft Marketplace).

1. Open **Extensions** in Cursor (`Ctrl+Shift+X`)
2. Search for **Salesforce Compare** (publisher `LeftConsult`)
3. Click **Install**

Listing: [LeftConsult/salesforce-compare on Open VSX](https://open-vsx.org/extension/LeftConsult/salesforce-compare)

### From VSIX (manual)

```bash
npm install
npm run build
npm run package
```

Then in VS Code / Cursor: **Extensions ÔåÆ ÔÇª ÔåÆ Install from VSIXÔÇª** and select the generated `.vsix` (`salesforce-compare-0.1.2.vsix`).

## Commands

| Command | Description |
|---------|-------------|
| `Salesforce Compare: Diff with Org` | Retrieve (if needed) and open Org Ôåö Local diff |
| `Salesforce Compare: Recheck Current File` | Force a fresh retrieve/compare |
| `Salesforce Compare: Show Compare Result` | Show Equal / Different result (toast + Diff/Recheck actions) |
| `Salesforce Compare: Clear Cache` | Clear Org snapshot cache and statuses |

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `salesforceCompare.enabled` | `true` | Enable the extension |
| `salesforceCompare.autoCheckOnOpen` | `true` | Compare when opening eligible files |
| `salesforceCompare.targetOrg` | `""` | Optional org override (alias/username) |
| `salesforceCompare.supportedExtensions` | `.cls`, `.trigger`, `.js`, `.html`, `.css`, `.xml`, ÔÇª | Extensions considered for eligibility |
| `salesforceCompare.maxConcurrentCompares` | `2` | Parallel Org retrieve/compare jobs; extra files stay queued in background |

## Org resolution order

1. `salesforceCompare.targetOrg` setting
2. Salesforce Extension Pack default username / target org
3. `sf config get target-org` for the workspace

## Eligible files

Files under typical DX layouts (`force-app` / `main/default`), including:

- Apex: `.cls`, `.trigger`
- LWC / Aura: `.js`, `.html`, `.css` under `lwc/` or `aura/`
- Visualforce: `.page`, `.component`
- Metadata XML: standalone `*-meta.xml` (objects, fields, layouts, flows, permission sets, profiles, flexipages, validation rules, tabs, custom applications, etc.)
- Companion meta files (e.g. `MyClass.cls-meta.xml`, LWC `*.js-meta.xml`) are **not** compared on their own ÔÇö compare the primary source file instead

## Development

```bash
npm install
npm run watch
```

Press **F5** in VS Code/Cursor to launch an Extension Development Host.

```bash
npm run compile   # typecheck
npm run build     # production bundle
npm run package   # create VSIX
```

## Architecture (short)

- **SfCliAdapter** ÔÇö only module that shells out to `sf` (retrieve only)
- **OrgResolver** ÔÇö picks target org (setting ÔåÆ SF Extension ÔåÆ CLI)
- **CompareService** ÔÇö background queue ÔåÆ retrieve ÔåÆ cache ÔåÆ hash ÔåÆ status
- **FileDecorationProvider** ÔÇö green/red badges on tabs/explorer
- **StatusBarController** ÔÇö Equal / Different / Comparing result + severity colors
- **DeployWatcher** ÔÇö reacts to deploy success, never deploys

## License

MIT ÔÇö see [LICENSE](LICENSE).
