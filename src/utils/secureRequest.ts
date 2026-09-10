import { getString } from "./locale";
import { validateEndpointUrl } from "./endpointPolicy";

type RequestOptions = NonNullable<Parameters<typeof Zotero.HTTP.request>[2]>;

/** Keep streaming/abort observers intact, but never forward a request through a redirect. */
export async function secureRequest(
  method: string,
  url: string,
  options: RequestOptions = {},
): Promise<XMLHttpRequest> {
  validateEndpointUrl(url);
  try {
    return await Zotero.HTTP.request(method, url, {
      ...options,
      followRedirects: false,
      logBodyLength: 0,
      debug: false,
    });
  } catch (error) {
    const status = (error as { xmlhttp?: { status?: number } })?.xmlhttp
      ?.status;
    // Zotero HTTP exceptions contain an XHR with request/response details.
    // Do not propagate those objects into logs, dialogs, or saved task errors.
    const safe = new Error(
      getString("security-request-failed") +
        (status ? ` (HTTP ${status})` : ""),
    );
    Object.assign(safe, { xmlhttp: { status } });
    throw safe;
  }
}

/** Remote upload/download URLs are never allowed to downgrade to local HTTP. */
export function validateRemoteResourceUrl(raw: string): string {
  const url = validateEndpointUrl(raw);
  if (new URL(url).protocol !== "https:") {
    throw new Error(getString("security-request-failed"));
  }
  return url;
}

export function secureFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  validateRemoteResourceUrl(url);
  return fetch(url, {
    ...options,
    redirect: "error",
    credentials: "omit",
    signal: options.signal ?? AbortSignal.timeout(120_000),
  });
}
