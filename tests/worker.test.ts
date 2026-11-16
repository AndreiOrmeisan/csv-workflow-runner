import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { defaultConfig } from "../src/lib/types";

test("production worker parses, transforms, exports, and reports errors", async () => {
  const messages: { id: number; result?: unknown; error?: string }[] = [];
  const self: {
    postMessage: (value: (typeof messages)[number]) => void;
    onmessage?: (event: { data: unknown }) => Promise<void>;
    addEventListener: () => void;
  } = {
    postMessage: (value) => messages.push(value),
    addEventListener: () => {},
  };
  runInNewContext(readFileSync("public/csv-worker.js", "utf8"), {
    self,
    crypto,
    console,
    TextDecoder,
    File,
    setTimeout,
    clearTimeout,
  });
  assert.deepEqual(JSON.parse(JSON.stringify(messages.shift())), {
    type: "ready",
    version: 1,
  });
  assert.ok(self.onmessage);
  await self.onmessage({
    data: {
      id: 1,
      kind: "parse",
      file: new File(["b,a\n2,001\n2,001"], "sample.csv"),
    },
  });
  const parsed = messages[0].result as { id: string; rows: string[][] };
  assert.equal(parsed.rows[0][1], "001");
  const config = { ...defaultConfig, deduplicate: true };
  await self.onmessage({
    data: {
      id: 2,
      kind: "transform",
      files: [parsed],
      selected: parsed.id,
      config,
    },
  });
  assert.equal((messages[1].result as { afterCount: number }).afterCount, 1);
  await self.onmessage({
    data: {
      id: 3,
      kind: "export",
      files: [parsed],
      selected: parsed.id,
      config,
      delimiter: ";",
    },
  });
  assert.equal(messages[2].result, "\uFEFFb;a\r\n2;001");
  await self.onmessage({
    data: {
      id: 4,
      kind: "parse",
      file: new File(['a,b\n"broken'], "broken.csv"),
    },
  });
  assert.ok(messages[3].error);
  await self.onmessage({
    data: {
      id: 5,
      kind: "parse",
      file: new File([new Uint8Array([0xff, 0xfe])], "legacy.csv"),
    },
  });
  assert.match(messages[4].error ?? "", /UTF-8/);
});
