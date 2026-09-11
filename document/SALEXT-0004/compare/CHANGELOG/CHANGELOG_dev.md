# Changelog

All notable changes to **Salesforce Compare** are documented here.

## 0.2.0 — 2026-09-08

### Added

- **Multi-Org compare (Local ↔ Other Org)** — connect additional Orgs for retrieve-only diffs without changing the Original Org used for Equal/Different status
- **Connected Orgs sidebar** (Activity Bar) — shows the Original Org and comparison Orgs; Connect Org, Login…, Refresh, and Disconnect
- Command **Diff with Other Org…** (editor/explorer context when a comparison Org is connected) — QuickPick Org → retrieve → Git-style Local ↔ Org diff
- Comparison Orgs persist per workspace; Original Org remains the first/default target (`target-org` / SF Extension / setting)
- **Comparison Org temp file** — Diff with Other Org writes a temporary snapshot named `File.__from__OrgAlias.ext` (outside the project) and opens it alongside the diff
- **Blue labels** for comparison-Org temp files / comparison side (`salesforceCompare.comparisonOrg`) so they are distinct from Original Org
- Clearer diff titles: `LOCAL (workspace) ↔ COMPARISON ORG "alias"` and `ORIGINAL ORG "alias" ↔ LOCAL`

### Notes

- Auto-check badges and status bar still reflect **Local vs Original Org** only
- The extension never deploys to any Org

## 0.1.2 — 2026-09-08

### Added

- Support for Salesforce metadata `.xml` files (`*-meta.xml`): objects, fields, layouts, flows, permission sets, profiles, flexipages, validation rules, and other DX standalone metadata
- Background compare queue: opening or switching files does not cancel prior jobs; each file updates its own status when finished
- Setting `salesforceCompare.maxConcurrentCompares` (default `2`) for parallel Org retrieves
- Clear compare result UX:
  - Status bar: `SF Equal`, `SF Different`, `SF Comparing…`, `SF Error` (red highlight when different/error)
  - Show Last Check toast: **Equal to Org** / **Different from Org** with Diff / Recheck actions

### Fixed

- Eligibility no longer rejects standalone metadata XML; only companion meta files (e.g. `.cls-meta.xml`, `.js-meta.xml`, Aura companions) are skipped

## 0.1.1

- Fix: mark files green (synced) after successful deploy to the Org
- Fix: mark files green after retrieve from the Org updates local content
- Improve deploy/retrieve detection (SF Extension commands, tasks, terminal, source tracking)
- Sync Org snapshot cache from local content after deploy/retrieve instead of relying on stale cache

## 0.1.0

- Initial release of Salesforce Compare
- Background Org retrieve/compare on file open
- Green/red file decorations for sync status
- Diff with Org (command + context menu)
- Status bar last-check info
- Mark outdated on save when local differs from Org snapshot
- Deploy success detection (terminal shell execution, deploy artifacts, source tracking)
- Retrieve-only — never deploys to the Org
