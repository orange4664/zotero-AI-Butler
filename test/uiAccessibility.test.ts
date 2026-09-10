import { expect } from "chai";
import { config } from "../package.json";
import { decodeMindmapExport } from "../src/modules/mindmapExport";
import { MainWindow } from "../src/modules/views/MainWindow";
import { ButlerStatus } from "../src/modules/views/DashboardView";
import { TaskStatus } from "../src/modules/taskQueue";
import { createMainWindowScaffold } from "../src/modules/views/layout/windowScaffold";
import {
  createFormGroup,
  createInput,
  createNotice,
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
      [{ id: "one", label: "<img src=x onerror=alert(1)>", icon: "document" }],
      () => {},
    );
    nav.setActiveTab("one");
    expect(host.querySelector("img")).to.equal(null);
    expect(host.querySelector("button")?.getAttribute("aria-pressed")).to.equal(
      "true",
    );
  });

  it("imports sanitized notice markup into Zotero's XML document without losing line breaks", function () {
    const notice = createNotice(
      'First<br/>Second &amp; third<img src="https://tracker.invalid/pixel" onerror="alert(1)"><a href="javascript:alert(1)">link</a>',
    );
    expect(notice.querySelectorAll("br").length).to.equal(1);
    expect(notice.textContent).to.contain("Second & third");
    expect(notice.querySelector("img, [onerror], a[href]")).to.equal(null);
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

  it("opens native views and preserves icons, navigation, responsive layouts and reduced motion", async function () {
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
    const theme = (dark: boolean) => {
      for (const root of win.document.querySelectorAll(".ai-butler-root"))
        root.classList.toggle("ai-butler-dark", dark);
    };
    const motionPref = "ui.prefersReducedMotion";
    const hadMotionPref = Services.prefs.prefHasUserValue(motionPref);
    const originalMotionPref = Services.prefs.getIntPref(motionPref, 0);
    const fixtureItems: Zotero.Item[] = [];
    let fixtureCollection: Zotero.Collection | undefined;
    try {
      win.resizeTo(950, 750);
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
      expect(action.querySelectorAll("svg").length).to.equal(2);
      expect(
        win.document.querySelectorAll(".tab-button > svg").length,
      ).to.equal(4);
      expect(action.querySelector("svg").getAttribute("aria-hidden")).to.equal(
        "true",
      );
      for (const button of win.document.querySelectorAll(
        ".ai-workflow-action",
      )) {
        const rect = button.getBoundingClientRect();
        const detailRect = button
          .querySelector(".ai-workflow-detail")
          .getBoundingClientRect();
        expect(detailRect.bottom).to.be.at.most(rect.bottom);
      }
      await capture("dashboard-light");
      for (const root of win.document.querySelectorAll(".ai-butler-root"))
        root.classList.add("ai-butler-dark");
      await capture("dashboard-dark");
      main
        .getDashboardView()
        .updateButlerStatus(
          ButlerStatus.WORKING,
          "Methods and evidence in scientific reading",
          3,
        );
      await capture("dashboard-working");
      theme(false);
      win.resizeTo(640, 740);
      await capture("dashboard-narrow");
      const dashboard = win.document.querySelector("#ai-butler-dashboard-view");
      expect(dashboard.scrollWidth).to.be.at.most(dashboard.clientWidth + 1);
      win.resizeTo(950, 750);

      // Exercise the actual quick action and arrow-key navigation.
      win.document.querySelector("#ai-butler-quick-action-tasks").click();
      expect(
        win.document.querySelector("#tab-tasks").getAttribute("aria-pressed"),
      ).to.equal("true");
      const titles = [
        "Research methods and reproducible evidence",
        "A practical guide to reading scientific papers",
        "Comparing models across experimental settings",
      ];
      const statuses = [
        TaskStatus.PROCESSING,
        TaskStatus.COMPLETED,
        TaskStatus.FAILED,
      ];
      for (let i = 0; i < titles.length; i++)
        main.getTaskQueueView().addTask({
          id: `ui-fixture-${i}`,
          itemId: -1 - i,
          title: titles[i],
          status: statuses[i],
          progress: i === 1 ? 100 : 42,
          createdAt: new Date(),
          retryCount: 0,
          maxRetries: 3,
          taskType: i === 0 ? "deepRead" : "summary",
          error:
            i === 2
              ? "Example: the configured endpoint is unavailable."
              : undefined,
        });
      await capture("tasks-light");
      theme(true);
      await capture("tasks-dark");
      theme(false);
      const taskTab = win.document.querySelector("#tab-tasks");
      taskTab.focus();
      taskTab.dispatchEvent(
        new win.KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }),
      );
      expect(
        win.document.querySelector("#tab-summary").getAttribute("aria-pressed"),
      ).to.equal("true");
      await capture("summary-light");
      theme(true);
      await capture("summary-dark");

      // Real library fixtures live only in the runner's isolated profile.
      fixtureCollection = new Zotero.Collection();
      fixtureCollection.name = "Reading workspace · UI fixtures";
      await fixtureCollection.saveTx();
      for (const title of titles) {
        const item = new Zotero.Item("journalArticle");
        item.setField("title", title);
        item.addToCollection(fixtureCollection.id);
        await item.saveTx();
        fixtureItems.push(item);
      }
      main.switchTab("dashboard");
      win.document
        .querySelector("#ai-butler-quick-action-scan-summary")
        .click();
      for (
        let i = 0;
        i < 50 && !win.document.querySelector(".ai-tree-toggle");
        i++
      )
        await Zotero.Promise.delay(100);
      const selectAll = win.document.querySelector(
        "#tree-container input[type='checkbox']",
      );
      selectAll.click();
      const toggle = win.document.querySelector(".ai-tree-toggle");
      expect(toggle.getAttribute("aria-expanded")).to.equal("true");
      expect(toggle.querySelector("svg")).not.to.equal(null);
      toggle.click();
      expect(toggle.getAttribute("aria-expanded")).to.equal("false");
      toggle.click();
      expect(toggle.getAttribute("aria-expanded")).to.equal("true");
      expect(toggle.querySelector("svg")).not.to.equal(null);
      theme(false);
      await capture("scanner-light");
      expect(
        win.document.querySelector("#scanner-confirm-btn svg"),
      ).not.to.equal(null);
      theme(true);
      await capture("scanner-dark");

      main.switchTab("settings");
      for (const root of win.document.querySelectorAll(".ai-butler-root"))
        root.classList.remove("ai-butler-dark");
      await capture("settings-light");
      theme(true);
      await capture("settings-dark");
      theme(false);
      for (const category of [
        "noteExport",
        "about",
        "deepReadPrompt",
        "imageSummary",
      ]) {
        win.document.querySelector(`#settings-nav-${category}`).click();
        await capture(`settings-${category}`);
      }
      win.document.querySelector("#settings-nav-modelPlatform").click();
      win.resizeTo(640, 740);
      await capture("settings-narrow");
      const sidebar = win.document.querySelector("#settings-sidebar");
      expect(win.getComputedStyle(sidebar).overflowX).to.equal("auto");
      const active = win.document.querySelector(".settings-nav-button.active");
      expect(active?.getAttribute("aria-pressed")).to.equal("true");
      expect(
        win.document.querySelectorAll(".settings-nav-button > svg").length,
      ).to.equal(11);

      Services.prefs.setIntPref(motionPref, 1);
      await Zotero.Promise.delay(150);
      expect(
        win.matchMedia("(prefers-reduced-motion: reduce)").matches,
      ).to.equal(true);
      main.switchTab("dashboard");
      main
        .getDashboardView()
        .updateButlerStatus(ButlerStatus.WORKING, "Motion preference check", 1);
      expect(
        win.getComputedStyle(win.document.querySelector("#status-icon"))
          .animationName,
      ).to.equal("none");
      expect(win.getComputedStyle(dashboard).animationName).to.equal("none");
    } catch (error) {
      await IOUtils.writeUTF8(
        PathUtils.join(dir, "native-error.txt"),
        `${String(error)}\n${(error as Error).stack}`,
      );
      throw error;
    } finally {
      if (hadMotionPref)
        Services.prefs.setIntPref(motionPref, originalMotionPref);
      else Services.prefs.clearUserPref(motionPref);
      main.close();
      for (const item of fixtureItems) await item.eraseTx();
      if (fixtureCollection) await fixtureCollection.eraseTx();
    }
  }).timeout(30_000);
});
