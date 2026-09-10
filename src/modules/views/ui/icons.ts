/** Local, trusted line icons. Never accept SVG markup from model output. */
const paths = {
  book: "M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Zm0 0v15",
  document: "M14 3H5v18h14V8Zm0 0v5h5M8 12h8M8 16h6",
  overview: "M3 3h7v7H3Zm11 0h7v7h-7ZM3 14h7v7H3Zm11 0h7v7h-7Z",
  queue: "m3 6 1 1 2-2m-3 7 1 1 2-2m-3 7 1 1 2-2M10 6h11M10 12h11M10 18h11",
  settings: "M4 6h7m4 0h5M4 12h1m4 0h11M4 18h11m4 0h1M11 3v6M5 9v6m10 0v6",
  play: "m8 4 12 8-12 8Z",
  pause: "M8 4v16M16 4v16",
  trash: "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7",
  compass: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4 6-2 6-6 2 2-6Z",
  help: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM9 9a3 3 0 0 1 6 0c0 2-3 2-3 5m0 3h.01",
  arrow: "M4 12h16m-6-6 6 6-6 6",
  back: "M20 12H4m6-6-6 6 6 6",
  chevron: "m9 5 7 7-7 7",
  folder: "M3 5h7l2 3h9v12H3Z",
  check: "m5 12 4 4L19 6",
  close: "m6 6 12 12M6 18 18 6",
  server: "M3 3h18v7H3Zm0 11h18v7H3ZM7 6.5h.01M7 17.5h.01",
  key: "M15 3a6 6 0 0 0-5 9L3 19v2h4v-3h3l3-3a6 6 0 1 0 2-12Zm2 4h.01",
  table: "M3 3h18v18H3Zm0 6h18M9 3v18",
  mindmap:
    "M9 9h6v6H9ZM3 3h4v4H3Zm14 0h4v4h-4Zm0 14h4v4h-4ZM7 7l2 2m6 0 2-2m-2 8 2 2",
  image: "M3 3h18v18H3Zm0 14 6-6 4 4 3-3 5 5M16 7h.01",
  export: "M12 15V3m-4 4 4-4 4 4M4 13v8h16v-8",
  display: "M3 3h18v14H3Zm9 14v4m-5 0h10",
  data: "M3 5c0-4 18-4 18 0s-18 4-18 0Zm0 0v14c0 4 18 4 18 0V5M3 12c0 4 18 4 18 0",
  info: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 9v6m0-10h.01",
} as const;

export type IconName = keyof typeof paths;

export function createIcon(doc: Document, name: IconName, size = 18): Element {
  const ns = "http://www.w3.org/2000/svg";
  const svg = doc.createElementNS(ns, "svg");
  for (const [key, value] of Object.entries({
    viewBox: "0 0 24 24",
    width: String(size),
    height: String(size),
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "1.65",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "aria-hidden": "true",
    focusable: "false",
    class: "ai-icon",
  }))
    svg.setAttribute(key, value);
  const path = doc.createElementNS(ns, "path");
  path.setAttribute("d", paths[name]);
  svg.appendChild(path);
  return svg;
}

export function createEmptyState(
  doc: Document,
  icon: IconName,
  title: string,
  detail: string,
): HTMLElement {
  const root = doc.createElement("div");
  root.className = "ai-empty-state";
  const heading = doc.createElement("h3");
  heading.textContent = title;
  const description = doc.createElement("p");
  description.textContent = detail;
  root.append(createIcon(doc, icon, 28), heading, description);
  return root;
}
