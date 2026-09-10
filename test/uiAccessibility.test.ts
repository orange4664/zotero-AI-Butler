import { expect } from "chai";
import { config } from "../package.json";
import { decodeMindmapExport } from "../src/modules/mindmapExport";
import { MainWindow } from "../src/modules/views/MainWindow";
import { createMainWindowScaffold } from "../src/modules/views/layout/windowScaffold";
import {
  createFormGroup,
  createInput,
  createStyledButton,
} from "../src/modules/views/ui/components";

describe("clear UI", function () {
  it("renders the bundled mindmap safely and accepts exports only from its own frame", async function () {
    const source = Zotero.getMainWindow();
    let exports = 0;
    const win = source.openDialog(
      `chrome://${config.addonRef}/content/mindmapViewer.html`,
      "",
      "chrome,resizable=yes,width=640,height=480",
      {
        markdown:
          '# Paper\n\n- Result\n- <img src="https://tracker.invalid/pixel" onerror="alert(1)">\n- [unsafe](javascript:alert(1))',
        onExport: async (payload: unknown) => {
          decodeMindmapExport(payload);
          exports++;
          return "test.opml";
        },
      },
    ) as any;
    try {
      let frame: any;
      for (let i = 0; i < 40; i++) {
        frame = win.document.querySelector("iframe");
        if (frame?.contentDocument?.querySelector(".markmap-node")) break;
        await Zotero.Promise.delay(100);
      }
      expect(frame.contentDocument.querySelector(".markmap-node")).not.to.equal(
        null,
      );
      expect(
        frame.contentDocument.querySelector("img, a[href^='javascript:']"),
      ).to.equal(null);
      win.postMessage(
        {
          type: "export-mindmap",
          format: "opml",
          filename: "untrusted.opml",
          content: "<opml/>",
        },
        "*",
      );
      await Zotero.Promise.delay(100);
      expect(exports).to.equal(0);
      frame.contentDocument.getElementById("export-opml").click();
      await Zotero.Promise.delay(300);
      expect(exports).to.equal(1);
    } finally {
      win.close();
    }
  }).timeout(10_000);

  it("keeps navigation labels as text and exposes selection state", function () {
    const doc = Zotero.getMainWindow().document;
    const host = doc.createElement("div");
    const nav = createMainWindowScaffold(
      host,
      [{ id: "one", label: "<img src=x onerror=alert(1)>", icon: "" }],
      () => {},
    );
    nav.setActiveTab("one");
    expect(host.querySelector("img")).to.equal(null);
    expect(host.querySelector("button")?.getAttribute("aria-pressed")).to.equal(
      "true",
    );
  });

  it("associates form labels and descriptions with the actual input", function () {
    const input = createInput("fixture", "password", "");
    const group = createFormGroup("API key", input, "Local profile only");
    expect(group.querySelector("label")?.getAttribute("for")).to.equal(
      input.id,
    );
    expect(input.getAttribute("aria-describedby")).to.equal(
      `${input.id}-description`,
    );
    expect(input.autocomplete).to.equal("off");
    const button = createStyledButton("Long readable action label", "#2196f3");
    expect(button.style.whiteSpace).to.equal("normal");
    expect(button.style.outline).not.to.equal("none");
  });

  it("opens the real Zotero window and captures native dashboard/settings layouts", async function () {
    (globalThis as any).ztoolkit = (Zotero as any).AIButler.data.ztoolkit;
    const main = MainWindow.getInstance();
    await main.open("dashboard");
    const win = main.getDialogWindow() as any;
    expect(win).not.to.equal(null);
    const dir = PathUtils.join(Zotero.DataDirectory.dir, "ui-qa");
    await IOUtils.makeDirectory(dir, { ignoreExisting: true });
    const capture = async (name: string) => {
      await Zotero.Promise.delay(350);
      const canvas = win.document.createElementNS(
        "http://www.w3.org/1999/xhtml",
        "canvas",
      );
      canvas.width = win.innerWidth;
      canvas.height = win.innerHeight;
      canvas
        .getContext("2d")
        .drawWindow(win, 0, 0, win.innerWidth, win.innerHeight, "white");
      const data = atob(canvas.toDataURL("image/png").split(",")[1]);
      await IOUtils.write(
        PathUtils.join(dir, `${name}.png`),
        Uint8Array.from(data, (c) => c.charCodeAt(0)),
      );
    };
    try {
      await Zotero.Promise.delay(500);
      const status = win.document.querySelector("#butler-status-card");
      expect(status).not.to.equal(null);
      expect(win.getComputedStyle(status).backgroundImage).to.equal("none");
      for (const root of win.document.querySelectorAll(".ai-butler-root"))
        root.classList.remove("ai-butler-dark");
      expect(win.getComputedStyle(status).backgroundColor).to.equal(
        "rgb(255, 255, 255)",
      );
      const action = win.document.querySelector(".ai-quick-actions button");
      expect(action.getBoundingClientRect().height).to.be.at.least(38);
      await capture("dashboard-light");
      for (const root of win.document.querySelectorAll(".ai-butler-root"))
        root.classList.add("ai-butler-dark");
      await capture("dashboard-dark");
      main.switchTab("settings");
      for (const root of win.document.querySelectorAll(".ai-butler-root"))
        root.classList.remove("ai-butler-dark");
      await capture("settings-light");
      win.resizeTo(640, 740);
      await capture("settings-narrow");
      const sidebar = win.document.querySelector("#settings-sidebar");
      expect(win.getComputedStyle(sidebar).overflowX).to.equal("auto");
      const active = win.document.querySelector(".settings-nav-button.active");
      expect(active?.getAttribute("aria-pressed")).to.equal("true");
    } finally {
      main.close();
    }
  }).timeout(20_000);
});
