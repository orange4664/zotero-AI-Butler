# Validation record

Validated on 2026-09-10 against upstream main `5df5c62` plus the changes in this fork. The suite runs in native Zotero on macOS with a separate profile and data directory under `.scaffold/test`; no personal papers, configured credentials, or paid model API calls are used.

- Native regressions: **250 passing**. Includes the existing offline suite, exploit-oriented security regressions, real window rendering, and the actual bundled mindmap renderer/export message path.
- Production build and TypeScript: `npm run build` (includes `tsc --noEmit` and built-locale verification).
- Formatting, ESLint and localization: `npm run lint:check`, `npm run i18n:check`.
- Dependency audit: zero production advisories. Two moderate development-only findings remain in the ZIP toolchain; see [SECURITY.md](../SECURITY.md).
- Native screenshots: [light overview](screenshots/dashboard-light.png), [dark overview](screenshots/dashboard-dark.png), [settings](screenshots/settings-light.png), [narrow settings](screenshots/settings-narrow.png). These show actual production UI code in native Zotero with an empty test library, not a browser mockup.

The native tests verify that sanitized academic tables/code/formulas still render, unsafe links and remote images are removed, configuration sharing cannot retain credentials for a changed destination, export payloads cannot select arbitrary paths or executable formats, and normal OPML export still works after message authentication. The live mindmap test rejects an unauthenticated external-window export while accepting the bundled frame's authenticated export.

Gecko suppresses `MessageEvent.source` for some privileged messages. The implementation uses a fresh random per-frame token, checks a non-null source when supplied, and checks that the frame still displays its bundled URL. Rejecting every null-source message broke real rendering and was caught by native testing before delivery.

The test runner must receive directories, not individual files; a zero-test run is not accepted. Do not run production build and native tests concurrently because both use `.scaffold/build`. The final XPI is rebuilt in production mode after the native suite.

Limits: no live provider connectivity/quality claims; no testing of all Zotero versions/platforms; no complete independent security audit. Existing profiles/logs/backups are not migrated or scrubbed. Native screenshot capture is a test capability and is not part of the installed plugin's user flow.
