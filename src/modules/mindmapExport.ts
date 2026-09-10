import { getString } from "../utils/locale";
import { getPref } from "../utils/prefs";

export function decodeMindmapExport(payload: unknown): {
  filename: string;
  bytes: Uint8Array;
} {
  if (!payload || typeof payload !== "object")
    throw new Error(getString("security-invalid-export"));
  const data = payload as Record<string, unknown>;
  if (data.format !== "png" && data.format !== "opml")
    throw new Error(getString("security-invalid-export"));
  const filename = String(data.filename || `mindmap.${data.format}`);
  if (
    // Control characters are deliberately rejected in filesystem names.
    // eslint-disable-next-line no-control-regex
    !/^[^\\/\x00-\x1f\x7f:]{1,180}$/.test(filename) ||
    filename.startsWith(".") ||
    filename.includes("..") ||
    !filename.endsWith(`.${data.format}`)
  ) {
    throw new Error(getString("security-invalid-export"));
  }
  let bytes: Uint8Array;
  if (data.format === "png") {
    if (
      typeof data.dataUrl !== "string" ||
      data.dataUrl.length > 64_000_000 ||
      !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(data.dataUrl)
    ) {
      throw new Error(getString("security-invalid-export"));
    }
    bytes = Uint8Array.from(
      atob(data.dataUrl.slice("data:image/png;base64,".length)),
      (char) => char.charCodeAt(0),
    );
    const magic = [137, 80, 78, 71, 13, 10, 26, 10];
    if (bytes.length < 24 || !magic.every((value, i) => bytes[i] === value))
      throw new Error(getString("security-invalid-export"));
  } else {
    if (
      typeof data.content !== "string" ||
      data.content.length > 5_000_000 ||
      /<!DOCTYPE|<!ENTITY|<\?xml-stylesheet/i.test(data.content)
    ) {
      throw new Error(getString("security-invalid-export"));
    }
    const win = Zotero.getMainWindow();
    const doc = new win.DOMParser().parseFromString(
      data.content,
      "application/xml",
    ) as Document;
    if (
      doc.documentElement?.localName !== "opml" ||
      doc.querySelector("parsererror")
    )
      throw new Error(getString("security-invalid-export"));
    for (const node of Array.from(doc.querySelectorAll("*")) as Element[]) {
      if (
        !["opml", "head", "title", "dateCreated", "body", "outline"].includes(
          node.localName,
        ) ||
        node.namespaceURI
      )
        throw new Error(getString("security-invalid-export"));
      for (const attr of Array.from(node.attributes) as Attr[]) {
        if (attr.name !== "text" && attr.name !== "version")
          node.removeAttribute(attr.name);
      }
    }
    bytes = new TextEncoder().encode(
      new win.XMLSerializer().serializeToString(doc),
    );
  }
  return { filename, bytes };
}

/** Only called after verifying the renderer window as the message source. */
export async function saveMindmapExport(payload: unknown): Promise<string> {
  const { filename, bytes } = decodeMindmapExport(payload);
  let directory = String(getPref("mindmapExportPath") || "").trim();
  if (!directory) {
    try {
      directory = Services.dirsvc.get("Desk", Ci.nsIFile).path;
    } catch {
      directory = PathUtils.join(Zotero.DataDirectory.dir, "mindmaps");
    }
  }
  await IOUtils.makeDirectory(directory, { ignoreExisting: true });
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const safeName = filename.replace(/\.(png|opml)$/, `-${suffix}.$1`);
  const path = PathUtils.join(directory, safeName);
  // Exclusive creation protects existing files, including destination symlinks.
  await IOUtils.write(path, bytes, { mode: "create" });
  return path;
}
