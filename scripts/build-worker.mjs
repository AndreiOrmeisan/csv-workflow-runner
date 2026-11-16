import { build } from "esbuild";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export async function buildWorker() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  await build({
    absWorkingDir: root,
    entryPoints: ["src/workers/csv.worker.ts"],
    outfile: "public/csv-worker.js",
    bundle: true,
    platform: "browser",
    target: "es2020",
    format: "iife",
    minify: true,
    legalComments: "eof",
  });
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  buildWorker().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
