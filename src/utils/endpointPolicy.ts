import { getString } from "./locale";
/** Only local services may receive credentials or papers over plain HTTP. */
export function validateEndpointUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(getString("security-invalid-endpoint"));
  }
  const local =
    url.hostname === "localhost" ||
    url.hostname === "[::1]" ||
    /^127\.(?:\d{1,3}\.){2}\d{1,3}$/.test(url.hostname);
  if (
    (url.protocol !== "https:" && !(url.protocol === "http:" && local)) ||
    url.username ||
    url.password ||
    url.hash
  ) {
    throw new Error(getString("security-invalid-endpoint"));
  }
  return url.href;
}

const SECRET_PARAM =
  /^(?:key|api[-_]?key|token|access[-_]?token|secret|password|authorization|signature)$/i;

export function publicEndpointUrl(raw: string): string {
  const url = new URL(raw);
  url.username = "";
  url.password = "";
  url.hash = "";
  for (const key of Array.from(url.searchParams.keys())) {
    if (SECRET_PARAM.test(key)) url.searchParams.delete(key);
  }
  return validateEndpointUrl(url.href);
}
