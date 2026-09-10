import { expect } from "chai";
import { sanitizeUntrustedHtml } from "../src/utils/safeHtml";
import {
  markdownToDisplayHtml,
  markdownToZoteroNoteHtml,
} from "../src/modules/noteMarkdown";
import {
  exportSettings,
  parseSettingsImport,
  applySettingsImport,
} from "../src/modules/settingsTransfer";
import { validateEndpointUrl } from "../src/utils/endpointPolicy";
import { secureRequest, secureFetch } from "../src/utils/secureRequest";
import { decodeMindmapExport } from "../src/modules/mindmapExport";
import { APITestError } from "../src/modules/llmproviders/types";

const endpoint = {
  id: "model-1",
  name: "Local model",
  providerType: "openai",
  apiUrl: "https://api.example.test/v1",
  apiKey: "secret-fixture",
  model: "model",
  enabled: true,
};

const invalidImports = [
  [],
  null,
  { unknownPreference: true },
  { autoScan: "true" },
  { batchSize: "999999" },
  { requestTimeout: "Infinity" },
  { llmEndpoints: "{}" },
  { llmEndpoints: JSON.stringify([endpoint, endpoint]) },
].map((source) => [JSON.stringify(source), source] as const);

describe("security boundaries", function () {
  const parse = (html: string) =>
    new (Zotero.getMainWindow().DOMParser)().parseFromString(
      html,
      "text/html",
    ) as Document;

  for (const input of [
    '<img src="https://tracker.invalid/pixel" onerror="alert(1)"><p>Paper</p>',
    '<svg><a xlink:href="javascript:alert(1)">x</a></svg>',
    '<math><mtext><table><mglyph><style><!--</style><img title="--><img src=x onerror=alert(1)>">',
    '<iframe src="file:///etc/passwd"></iframe><object data="chrome://zotero/content/"></object>',
    '<form id="Zotero"><input name="Prefs"></form><p style="background:url(https://tracker.invalid/)">Paper</p>',
    '<a href="java&#x09;script:alert(1)" onclick="alert(1)">Read</a>',
  ]) {
    it(`removes executable and network-active markup: ${input}`, function () {
      const html = sanitizeUntrustedHtml(input);
      const doc = parse(html);
      expect(
        doc.querySelector(
          "img, svg, math, iframe, object, form, input, style, [onerror], [onclick], [style], [id], [name]",
        ),
      ).to.equal(null);
      expect(html).not.to.match(
        /href="(?:javascript|file|chrome|resource|data):/i,
      );
    });
  }

  for (const scheme of [
    "javascript:alert(1)",
    "data:text/html,hello",
    "file:///tmp/x",
    "chrome://zotero/content/",
    "resource://x",
    "//tracker.invalid/x",
  ]) {
    it(`rejects privileged or implicit links: ${scheme}`, function () {
      const doc = parse(markdownToDisplayHtml(`[Read](${scheme})`));
      expect(doc.querySelector("a[href]")).to.equal(null);
    });
  }

  it("preserves academic formatting, safe links, code, and local math", function () {
    const html = markdownToDisplayHtml(
      "# Paper\n\n**Result** [DOI](https://doi.org/10.1000/test)\n\n|a|b|\n|-|-|\n|1|2|\n\n```js\nconst x = 1;\n```\n\n$E=mc^2$",
    );
    const doc = parse(html);
    for (const selector of [
      "h1",
      "strong",
      "table",
      "pre code",
      "a[href]",
      ".katex",
    ])
      expect(doc.querySelector(selector), selector).not.to.equal(null);
    expect(doc.body?.textContent).to.contain("Result");
  });

  it("disables KaTeX trusted resource commands", function () {
    const doc = parse(
      markdownToDisplayHtml(
        String.raw`$\includegraphics{https://tracker.invalid/x}$ $\href{javascript:alert(1)}{x}$`,
      ),
    );
    expect(doc.querySelector("img, a[href^='javascript:']")).to.equal(null);
  });

  it("protects persisted notes while preserving Zotero math spans", function () {
    const doc = parse(
      markdownToZoteroNoteHtml("<img src=x onerror=alert(1)>\n\n$x^2$"),
    );
    expect(doc.querySelector("img")).to.equal(null);
    expect(doc.querySelector("span.math")?.textContent).to.equal("$x^2$");
  });

  it("redacts nested and legacy credentials in exports without mutating storage", function () {
    const prefs: Record<string, unknown> = {
      openaiApiKey: "legacy-fixture",
      llmEndpoints: JSON.stringify([endpoint]),
      autoScan: true,
      openaiApiUrl:
        "https://u:password@api.example.test/v1?key=secret-query&version=1",
    };
    const before = JSON.stringify(prefs);
    const exported = exportSettings((key) => prefs[key]);
    expect(JSON.stringify(exported)).not.to.match(
      /secret-fixture|legacy-fixture|secret-query|password/,
    );
    expect(JSON.parse(String(exported.llmEndpoints))[0].enabled).to.equal(
      false,
    );
    expect(JSON.stringify(prefs)).to.equal(before);
  });

  for (const [label, source] of invalidImports) {
    it(`rejects malformed imports before mutation: ${label}`, function () {
      expect(() => parseSettingsImport(JSON.stringify(source))).to.throw();
    });
  }

  it("does not bind an old credential to an imported destination or enable automatic work", function () {
    const imported = parseSettingsImport(
      JSON.stringify({
        openaiApiUrl: "https://new.example.test/v1",
        openaiApiKey: "untrusted-key",
        llmEndpoints: JSON.stringify([endpoint]),
        autoScan: true,
      }),
    );
    expect(imported.openaiApiKey).to.equal("");
    expect(imported.openaiApiKeysFallback).to.equal("[]");
    expect(parseSettingsImport('{"openaiApiUrl":""}').openaiApiKey).to.equal(
      "",
    );
    expect(imported.autoScan).to.equal(false);
    const models = JSON.parse(String(imported.llmEndpoints));
    expect(models[0].apiKey).to.equal("");
    expect(models[0].enabled).to.equal(false);
  });

  it("rolls back writes when storage fails and reports failure", function () {
    const prefs: Record<string, unknown> = { theme: "light", autoScan: true };
    let fail = true;
    expect(() =>
      applySettingsImport(
        { theme: "dark", autoScan: false },
        (key) => prefs[key],
        (key, value) => {
          if (key === "autoScan" && fail) {
            fail = false;
            throw new Error("disk error");
          }
          prefs[key] = value;
        },
        (key) => {
          delete prefs[key];
        },
      ),
    ).to.throw();
    expect(prefs).to.deep.equal({ theme: "light", autoScan: true });
  });

  for (const url of [
    "http://api.example.test/v1",
    "file:///tmp/key",
    "javascript:alert(1)",
    "https://user:pass@api.example.test/v1",
    "http://localhost.example.test/v1",
    "https://api.example.test/#secret",
  ]) {
    it(`blocks unsafe API transport: ${url}`, function () {
      expect(() => validateEndpointUrl(url)).to.throw();
    });
  }

  it("supports HTTPS and local inference", function () {
    for (const url of [
      "https://api.example.test/v1",
      "http://localhost:11434",
      "http://127.0.0.1:8000",
      "http://[::1]:11434",
    ])
      expect(validateEndpointUrl(url)).to.be.a("string");
  });

  it("turns off redirects and body logging without dropping cancellation observers", async function () {
    const original = Zotero.HTTP.request;
    const observer = () => {};
    let captured: any;
    try {
      Zotero.HTTP.request = (async (_method, _url, options) => {
        captured = options;
        return { status: 200 };
      }) as typeof original;
      await secureRequest("POST", "https://api.example.test/v1", {
        headers: { Authorization: "Bearer fixture" },
        body: "private paper",
        followRedirects: true,
        debug: true,
        logBodyLength: 1000,
        requestObserver: observer,
      });
      expect(captured.followRedirects).to.equal(false);
      expect(captured.logBodyLength).to.equal(0);
      expect(captured.debug).to.equal(false);
      expect(captured.requestObserver).to.equal(observer);
    } finally {
      Zotero.HTTP.request = original;
    }
  });

  it("never sends a request with an unsafe URL", async function () {
    const original = Zotero.HTTP.request;
    let called = false;
    try {
      Zotero.HTTP.request = (async () => {
        called = true;
      }) as unknown as typeof original;
      try {
        await secureRequest("POST", "http://remote.invalid", {});
      } catch {
        /* expected */
      }
      expect(called).to.equal(false);
      expect(() => secureFetch("file:///tmp/private")).to.throw();
    } finally {
      Zotero.HTTP.request = original;
    }
  });

  it("omits credential-bearing response data from connection reports", function () {
    const report = new APITestError("failed", {
      errorName: "HTTPError",
      errorMessage: "secret-fixture",
      statusCode: 401,
      requestUrl: "https://api.example.test/path?key=secret-fixture",
      requestBody: "secret-fixture",
      responseHeaders: { "set-cookie": "secret-fixture" },
      responseBody: "secret-fixture",
    }).formatReport();
    expect(report).not.to.contain("secret-fixture");
    expect(report).to.contain("401");
  });

  for (const filename of [
    "../profile.js",
    "../../test.png",
    "folder/test.png",
    "C:\\test.png",
    "hidden.js",
    ".test.png",
  ]) {
    it(`rejects export path/extension abuse: ${filename}`, function () {
      expect(() =>
        decodeMindmapExport({
          format: "png",
          filename,
          dataUrl: "data:image/png;base64,AAAA",
        }),
      ).to.throw();
    });
  }

  it("rejects forged PNG and active OPML documents", function () {
    expect(() =>
      decodeMindmapExport({
        format: "png",
        filename: "test.png",
        dataUrl: "data:image/png;base64,AAAA",
      }),
    ).to.throw();
    expect(() =>
      decodeMindmapExport({
        format: "opml",
        filename: "test.opml",
        content:
          '<!DOCTYPE opml [<!ENTITY x SYSTEM "file:///tmp/private">]><opml>&x;</opml>',
      }),
    ).to.throw();
  });

  it("accepts ordinary OPML while discarding executable outline attributes", function () {
    const output = decodeMindmapExport({
      format: "opml",
      filename: "paper.opml",
      content:
        '<opml version="2.0"><head><title>Paper</title></head><body><outline text="Result" url="javascript:alert(1)"/></body></opml>',
    });
    expect(new TextDecoder().decode(output.bytes)).to.contain('text="Result"');
    expect(new TextDecoder().decode(output.bytes)).not.to.contain("javascript");
  });
});
