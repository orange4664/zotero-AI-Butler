import createDOMPurify, { type WindowLike } from "dompurify";

const purifiers = new WeakMap<WindowLike, ReturnType<typeof createDOMPurify>>();

/**
 * Model output and saved note HTML are data, even inside a privileged Zotero
 * window. Sanitize before inserting into a live document. Local KaTeX output
 * is added afterwards, with trust disabled, so its layout styles stay intact.
 */
export function sanitizeUntrustedHtml(
  html: string,
  win: WindowLike = Zotero.getMainWindow() as unknown as WindowLike,
): string {
  let purifier = purifiers.get(win);
  if (!purifier) {
    purifier = createDOMPurify(win);
    purifiers.set(win, purifier);
  }
  if (!purifier.isSupported) {
    // Never fall back to raw HTML on an unsupported document.
    return html
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  return purifier.sanitize(html, {
    USE_PROFILES: { html: true },
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    // No automatic network requests, CSS injection, embedded documents,
    // forms, or DOM names that can shadow privileged application objects.
    FORBID_TAGS: [
      "style",
      "img",
      "picture",
      "audio",
      "video",
      "source",
      "track",
      "iframe",
      "object",
      "embed",
      "form",
      "input",
      "button",
      "textarea",
      "select",
      "option",
      "link",
      "meta",
      "base",
    ],
    FORBID_ATTR: [
      "style",
      "id",
      "name",
      "srcset",
      "background",
      "ping",
      "target",
    ],
    // An explicit protocol is required. In particular, file:, chrome:,
    // resource:, data:, javascript: and protocol-relative URLs are rejected.
    ALLOWED_URI_REGEXP: /^(?:https?:\/\/|mailto:|#)/i,
  });
}
