// 将 markmap 相关依赖打包成单个浏览器可用的 JS 文件
import * as esbuild from "esbuild";
import { join } from "path";

const outDir = "addon/content";

const entryFile = "scripts/markmap-entry.ts";

// 使用 esbuild 打包
await esbuild.build({
  entryPoints: [entryFile],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["es2020"],
  outfile: join(outDir, "markmap-bundle.js"),
  minify: true,
  sourcemap: false,
});

console.log("✅ markmap-bundle.js 已生成到", outDir);
