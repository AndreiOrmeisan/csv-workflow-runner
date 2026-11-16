import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const source = await readFile(
  new URL("../public/csv-worker.js", import.meta.url),
);
const exported = await readFile(
  new URL("../out/csv-worker.js", import.meta.url),
);
assert.ok(exported.length > 0, "The exported CSV worker is empty.");
assert.deepEqual(
  exported,
  source,
  "The exported CSV worker does not match the current bundle.",
);
assert.ok(
  !exported.toString("utf8").trimStart().startsWith("<"),
  "The CSV worker must be JavaScript, not HTML.",
);
console.log(
  "Verified out/csv-worker.js matches the current browser worker bundle.",
);
