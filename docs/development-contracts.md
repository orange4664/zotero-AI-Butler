# Fork development contracts

## 1. Scope and triggers

These contracts apply to untrusted model output, external URLs, imported configuration, renderer messages, shared controls and release builds. Baseline: upstream main `5df5c62`. Preserve upstream AGPL-3.0-or-later attribution.

## 2. Signatures

- `sanitizeUntrustedHtml(html, win?): string` is the HTML trust boundary. Call before live DOM insertion and before adding locally generated KaTeX layout with `trust: false`.
- `validateEndpointUrl(raw): string`, `secureRequest(method, url, options)` and `secureFetch(url, options)` own transport constraints.
- `exportSettings(read)`, `parseSettingsImport(text)` and `applySettingsImport(settings, read, write, clear)` own configuration transfer.
- `decodeMindmapExport(payload)` returns a safe filename and bytes. `saveMindmapExport(payload)` writes a unique new file and returns its path.

## 3. Contracts

- Imported preferences: only `TRANSFER_KEYS`, correctly typed primitives, at most 1 MB input. Endpoints: at most 100 entries, bounded string fields, unique IDs, supported provider, valid URL/model. Strip keys; disable imported endpoints and auto-scan. Changing a legacy URL clears its primary and fallback key stores, including an empty/default URL.
- Requests: HTTPS or loopback HTTP for explicitly configured local APIs. Remote resource URLs use HTTPS. Set `followRedirects: false`, `logBodyLength: 0`, `debug: false` after caller options. Keep request observers and cancellation callbacks intact.
- Export message: `type: "export-mindmap"`, `format: "png" | "opml"`, safe basename with matching extension, bounded `dataUrl`/`content`. Verify the per-frame random token, source window (when non-null) and current frame URL before invoking the writer. Gecko intentionally returns null event sources for privileged postMessage, so source equality alone breaks normal rendering. PNG needs a valid signature; OPML disallows DTD/entities and executable elements/attributes.
- UI: local system/CJK font stack, neutral surfaces, one accent, semantic colors for actual status. No automatic font shrinking. Controls have visible focus, readable wrapping and appropriate hit areas. Respect reduced motion. Settings sidebar scrolls independently and becomes horizontal below 700px.
- Native tests require `ZOTERO_PLUGIN_ZOTERO_BIN_PATH`. `npm run test:offline` creates its own profile/data under `.scaffold/test`, ignores `.env` model credentials, excludes paid provider tests and never globally kills Zotero.

## 4. Validation and error matrix

| Input                                                                    | Required result                                    |
| ------------------------------------------------------------------------ | -------------------------------------------------- |
| HTML event handler, remote image, privileged link, trusted KaTeX command | Removed or rendered as inert text                  |
| Unknown pref, wrong type, duplicate endpoint, out-of-range count         | Reject before any write                            |
| Imported destination with old primary/fallback keys                      | Clear associated keys                              |
| Insecure remote API or URL userinfo                                      | Reject before network I/O                          |
| HTTP redirect                                                            | Do not follow                                      |
| Message from unrelated/navigated window                                  | Ignore                                             |
| Path traversal, wrong extension, forged PNG or active OPML               | Reject before writing                              |
| No completed tasks                                                       | Show an em dash for undefined average/success rate |
| Failed async action                                                      | Report failure; always release busy/disabled state |

## 5. Good, base and bad cases

Good: GFM tables and `$E=mc^2$` still render inside Zotero. Base: HTTPS APIs and `http://localhost:11434` remain configurable. Bad: importing an attacker-selected API URL while retaining an old key, trusting raw `marked.parse` output, or writing `event.data.filename` directly.

## 6. Required tests

Run `npm ci`, `npm run lint:check`, `npm run build`, `npm audit --omit=dev`, and `npm run test:offline` with a Zotero binary. Security regressions cover malicious HTML, link protocols, trusted math commands, settings redaction/validation/rollback, transport options and export formats. Native UI tests open the actual plugin, check control sizing/accessibility, capture light/dark/narrow layouts, and exercise the bundled mindmap message boundary.

`zotero-plugin-scaffold` expects test **directories**, not a list of files. The offline runner creates import wrappers in `.scaffold/offline-tests`. A run reporting zero tests is not a pass. Do not run build and native test processes concurrently: both write `.scaffold/build`. Final production packaging must run after native tests.

The markmap asset is generated from `scripts/markmap-entry.ts`; `npm run build` rebuilds it. Do not edit the minified file manually. Exclude generated vendor code from source lint, but validate it in the native viewer.

## 7. Wrong versus correct

```ts
// Wrong: raw HTML survives Markdown conversion.
container.innerHTML = marked.parse(remoteMarkdown);

// Correct: untrusted HTML is removed before local math is rendered.
container.innerHTML = markdownToDisplayHtml(remoteMarkdown);
```

```ts
// Wrong: arbitrary preference assignment and false partial success.
Object.entries(JSON.parse(text)).forEach(([key, value]) => setPref(key, value));

// Correct: validate the full payload first and roll back failed writes.
applySettingsImport(parseSettingsImport(text), read, write, clear);
```
