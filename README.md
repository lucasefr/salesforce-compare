# Salesforce Compare

VS Code / Cursor extension that compares local Salesforce DX source files with the connected Org (**retrieve-only**). It shows sync status on tabs/explorer and opens a Git-style diff against the Org version.

**Current version:** `1.0.0` · Publisher: [LeftConsult](https://marketplace.visualstudio.com/items?itemName=LeftConsult.salesforce-compare)

- **VS Code / Visual Studio Marketplace:** [LeftConsult.salesforce-compare](https://marketplace.visualstudio.com/items?itemName=LeftConsult.salesforce-compare)
- **Cursor (Open VSX):** [open-vsx.org/extension/LeftConsult/salesforce-compare](https://open-vsx.org/extension/LeftConsult/salesforce-compare) — after Open VSX publish, search **Salesforce Compare** in Cursor Extensions

## What's new in 1.0.0

- **First stable release** for VS Code Marketplace and Open VSX (Cursor)
- **Connected Orgs sidebar** — connect extra Orgs for comparison; Original Org is labeled and remains the source of Equal/Different status
- **Diff with Other Org…** — right-click an eligible file and compare **Local ↔** a selected comparison Org (retrieve-only)
- **Authorize an Org…** — Production / Sandbox / Custom URL + alias; auto-triggered on auth errors during compare
- **Metadata XML** — compare standalone Salesforce `*-meta.xml` files (objects, fields, layouts, flows, permission sets, profiles, flexipages, validation rules, etc.)
- **Background queue** — opening or switching files does not cancel prior compares; each file finishes in the background and updates its own badge
- Comparison Orgs are stored **per workspace**; the extension never deploys to any Org

See [CHANGELOG.md](CHANGELOG.md) for the full history.

## Features

- **Auto-check on open** — when you open an eligible Salesforce source file, the extension retrieves the Org version in the background and compares it locally. Opening another file queues a new job without cancelling previous ones; each file’s tab/explorer badge updates when its own compare finishes.
- **Tab / Explorer flags** — green `●` when equal to Org, red `●` when different, `…` while checking, `!` on error.
- **Status bar result** — `SF Equal` (green check), `SF Different` (red highlight), `SF Comparing…`, or `SF Error`. Click it for the detailed toast.
- **Show Compare Result** — toast with **Equal to Org** / **Different from Org** / **Comparing…**, last check age, Org, and background job count; Diff / Recheck actions when useful.
- **Diff with Org** — command and right-click menu open a side-by-side diff (Org ↔ Local).
- **Save awareness** — saving local changes marks the file as different when it no longer matches the last Org snapshot.
- **Deploy awareness** — after a successful `sf project deploy` (terminal) or known Salesforce Extension Pack deploy signals, open eligible files are rechecked.
- **Never deploys** — the extension only runs retrieve for comparison.
- **Multi-Org (comparison)** — Activity Bar view **Salesforce Compare → Connected Orgs** lists the **Original** Org (auto-check) and extra Orgs used only for **Diff with Other Org…** (Local ↔ selected Org).

## Status meanings

| UI label | Internal status | Meaning |
|----------|-----------------|--------|
| Equal to Org / `SF Equal` | `synced` | Local content matches the last Org snapshot |
| Different from Org / `SF Different` | `outdated` | Local content differs from the Org |
| Comparing with Org… / `SF Comparing…` | `checking` | Retrieve/compare in progress (or queued) |
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
3. Click **Install** (or **Update** to get `1.0.0`)

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

Then in VS Code / Cursor: **Extensions → … → Install from VSIX…** and select the generated `.vsix` (`salesforce-compare-1.0.0.vsix`).

## Commands

| Command | Description |
|---------|-------------|
| `Salesforce Compare: Diff with Org` | Retrieve (if needed) and open Org ↔ Local diff (Original Org) |
| `Salesforce Compare: Diff with Other Org…` | Pick a comparison Org and open Local ↔ that Org diff |
| `Salesforce Compare: Recheck Current File` | Force a fresh retrieve/compare against the Original Org |
| `Salesforce Compare: Show Compare Result` | Show Equal / Different result (toast + Diff/Recheck actions) |
| `Salesforce Compare: Clear Cache` | Clear Org snapshot cache and statuses |
| `Salesforce Compare: Authorize an Org…` | Authorize and automatically list the Org in Connected Orgs (Production / Sandbox / Custom URL + alias) |
| `Salesforce Compare: Disconnect Org` | Remove a comparison Org from this workspace |
| `Salesforce Compare: Disconnect Org` | Remove a comparison Org from this workspace |
| `Salesforce Compare: Refresh Connected Orgs` | Refresh the Connected Orgs sidebar |

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `salesforceCompare.enabled` | `true` | Enable the extension |
| `salesforceCompare.autoCheckOnOpen` | `true` | Compare when opening eligible files |
| `salesforceCompare.targetOrg` | `""` | Optional org override (alias/username) |
| `salesforceCompare.supportedExtensions` | `.cls`, `.trigger`, `.js`, `.html`, `.css`, `.xml`, … | Extensions considered for eligibility |
| `salesforceCompare.maxConcurrentCompares` | `2` | Parallel Org retrieve/compare jobs; extra files stay queued in background |

## Org resolution order

1. `salesforceCompare.targetOrg` setting
2. Salesforce Extension Pack default username / target org
3. `sf config get target-org` for the workspace

That resolved Org is the **Original** Org (badges / auto-check / Diff with Org). Additional Orgs added in the Connected Orgs sidebar are **comparison-only** and do not change the project default.

## Eligible files

Files under typical DX layouts (`force-app` / `main/default`), including:

- Apex: `.cls`, `.trigger`
- LWC / Aura: `.js`, `.html`, `.css` under `lwc/` or `aura/`
- Visualforce: `.page`, `.component`
- Metadata XML: standalone `*-meta.xml` (objects, fields, layouts, flows, permission sets, profiles, flexipages, validation rules, tabs, custom applications, etc.)
- Companion meta files (e.g. `MyClass.cls-meta.xml`, LWC `*.js-meta.xml`) are **not** compared on their own — compare the primary source file instead

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

- **SfCliAdapter** — only module that shells out to `sf` (retrieve / org list / login terminal; never deploy)
- **OrgResolver** — picks Original Org (setting → SF Extension → CLI)
- **OrgConnectionService / ConnectedOrgsStore** — comparison Orgs (workspace-scoped)
- **ConnectedOrgsTreeProvider** — Activity Bar sidebar
- **CompareService** — background queue → retrieve → cache → hash → status (Original); scoped retrieve for Other Org diffs
- **FileDecorationProvider** — green/red badges on tabs/explorer
- **StatusBarController** — Equal / Different / Comparing result + severity colors
- **DeployWatcher** — reacts to deploy success, never deploys

## License

MIT — see [LICENSE](LICENSE).
