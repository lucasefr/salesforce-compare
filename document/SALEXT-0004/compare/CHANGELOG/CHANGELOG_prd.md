# Changelog

All notable changes to **Salesforce Compare** are documented here.

## 0.1.2 ÔÇö 2026-09-08

### Added

- Support for Salesforce metadata `.xml` files (`*-meta.xml`): objects, fields, layouts, flows, permission sets, profiles, flexipages, validation rules, and other DX standalone metadata
- Background compare queue: opening or switching files does not cancel prior jobs; each file updates its own status when finished
- Setting `salesforceCompare.maxConcurrentCompares` (default `2`) for parallel Org retrieves
- Clear compare result UX:
  - Status bar: `SF Equal`, `SF Different`, `SF ComparingÔÇª`, `SF Error` (red highlight when different/error)
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
- Retrieve-only ÔÇö never deploys to the Org
