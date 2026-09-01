# Changelog

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
