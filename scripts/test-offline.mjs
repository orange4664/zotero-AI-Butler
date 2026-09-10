// Native Zotero regression suite using an isolated profile and no provider calls.
import { readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { Config, Test } from "zotero-plugin-scaffold";

process.env.NODE_ENV = "test";
// The runner already terminates its own child. Never kill the user's Zotero.
process.env.ZOTERO_PLUGIN_KILL_COMMAND =
  process.platform === "win32" ? "ver > nul" : "true";
const entries = readdirSync("test")
  .filter(
    (name) => name.endsWith(".test.ts") && name !== "llmProviders.test.ts",
  )
  .map((name) => `test/${name}`);
mkdirSync(".scaffold/offline-tests", { recursive: true });
for (const entry of entries) {
  const name = entry.split("/").pop();
  writeFileSync(
    `.scaffold/offline-tests/${name}`,
    `import "../../${entry}";\n`,
  );
}
const ctx = await Config.loadConfig({
  test: { entries: ".scaffold/offline-tests", watch: false },
  server: { startArgs: ["--no-remote"], devtools: false },
});
const runner = new Test(ctx);
process.on("SIGINT", () => runner.exit("SIGINT"));
await runner.run();
