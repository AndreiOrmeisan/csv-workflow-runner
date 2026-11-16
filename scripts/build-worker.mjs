import { build } from "esbuild";

await build({
  entryPoints: ["src/workers/csv.worker.ts"],
  outfile: "public/csv-worker.js",
  bundle: true,
  platform: "browser",
  target: "es2020",
  format: "iife",
  minify: true,
  legalComments: "eof",
});
