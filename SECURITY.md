# Security and privacy

This fork hardens identified boundaries in upstream main (`5df5c62`). It is not a guarantee that every possible vulnerability has been found.

## Fixed in 4.1.0-fork.1

- Untrusted Markdown and saved-note HTML are sanitized with DOMPurify before privileged UI insertion. Raw HTML cannot introduce scripts, event handlers, CSS, forms, embedded documents, remote image requests or privileged URL schemes. KaTeX runs with `trust: false`. Tables, code, safe web links and local formulas remain supported. Model-generated remote images embedded in ordinary Markdown are intentionally removed; the separate image-summary workflow still works.
- Settings exports omit primary and nested API keys and remove recognized credential query parameters/userinfo from API URLs. Imports use an allowlist, size/type/range checks, and validate the complete payload before writing. Imported endpoints are disabled and have empty keys. Changing legacy API URLs clears primary and fallback keys. Automatic scanning is disabled after import. Storage failure triggers rollback instead of a false success message.
- Provider and image API requests require HTTPS, with HTTP restricted to loopback for local inference. Redirect following, request-body logging and response debugging are disabled. MinerU requests and remote upload/download URLs require HTTPS and disallow redirects. Fetch requests receive a bounded timeout. Connection diagnostic reports omit request/response bodies, response headers and URL paths/queries.
- Mindmap messages require a per-frame random communication token, a matching source when Gecko exposes it, and a frame that is still showing the bundled page. Exports accept only bounded PNG/OPML payloads, reject unsafe names, create a unique new file without overwriting, and never automatically open exported files. Both sidebar and standalone viewer use the same export service. Mindmap node HTML is sanitized before rendering.
- Removed the unused `simple-mind-map` dependency and its vulnerable transitive packages. Build/test dependencies were updated. CI uses a lockfile, Node 24 and read-only repository permissions; release builds do not post issue comments.

## Remaining limitations

API keys remain in Zotero's local preference store. This fork does **not** encrypt them or move them to the operating system credential vault. Protect your Zotero profile, backups and account. An already-compromised machine or another privileged Zotero extension can still access local secrets.

Selected paper text/PDFs, prompts and conversation context are sent to the model endpoints you configure. MinerU receives PDFs when its extraction mode is selected. The fork has no added telemetry or relay service. Do not configure an endpoint you do not trust; transport validation cannot make an untrusted provider trustworthy.

The 2026-09-10 npm audit reports **0 production dependency advisories** and **2 moderate development dependency findings**: `adm-zip` and its dependent `zotero-plugin-scaffold` (GHSA-vwc7-r8mq-g2x9, extraction following destination symlinks). The latest available scaffold still depends on the affected ZIP library. It is not bundled into the installed plugin. Build in a clean checkout and use trusted SDK/download artifacts. We did not force a downgrade to an incompatible scaffold merely to remove the audit finding.

Existing local logs/backups and previously shared configuration files are not retroactively scrubbed. Rotate a key if you have already shared an old export. This release does not claim successful paid model requests: validation uses local fixtures and mocked transport, plus native Zotero rendering.

## Reporting

For a new suspected vulnerability, use a private GitHub security report if available. Avoid putting real keys, signed URLs or private papers into public issues.
