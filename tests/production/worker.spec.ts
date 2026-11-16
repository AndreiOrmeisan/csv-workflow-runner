import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function upload(
  page: Page,
  content = 'name,note\n Ada ,"hello, world"\n Ada ,"hello, world"\n,',
) {
  await page
    .getByLabel("Upload CSV files", { exact: true })
    .setInputFiles({
      name: "sample.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(content),
    });
}

test("export serves the worker as JavaScript at the URL used by the page", async ({
  request,
}) => {
  const response = await request.get("/csv-worker.js");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("javascript");
  expect(Buffer.from(await response.body())).toEqual(
    await readFile("public/csv-worker.js"),
  );
});

test("production upload, transform, recipe reuse, and download work in a real browser worker", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await upload(page);
  await expect(
    page.getByText("1 file imported. Ready to transform.", { exact: false }),
  ).toBeVisible();
  for (const name of [
    "Trim whitespace",
    "Remove empty rows",
    "Remove duplicate rows",
  ])
    await page.getByRole("checkbox", { name }).check();
  await page.getByRole("button", { name: "Apply workflow" }).click();
  await expect(page.getByText("2 rows removed", { exact: true })).toBeVisible();
  await page.getByLabel("Recipe name").fill("Production cleanup");
  await page.getByRole("button", { name: "Save recipe", exact: true }).click();
  await page.reload();
  await page
    .getByLabel("Saved in this browser")
    .selectOption({ label: "Production cleanup" });
  await upload(page);
  await page.getByRole("button", { name: "Apply workflow" }).click();
  await expect(page.getByText("2 rows removed", { exact: true })).toBeVisible();
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download CSV", exact: false })
    .click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe("cleaned-data.csv");
  const path = await download.path();
  expect(await readFile(path!, "utf8")).toBe(
    '\uFEFFname,note\r\nAda,"hello, world"',
  );
  expect(errors).toEqual([]);
});

test("missing worker produces an error and a later upload retries successfully", async ({
  page,
}) => {
  await page.route("**/csv-worker.js", (route) =>
    route.fulfill({
      status: 404,
      contentType: "text/html",
      body: "<html>Not found</html>",
    }),
  );
  await page.goto("/");
  await upload(page);
  await expect(
    page
      .getByRole("region", { name: "CSV workflow workspace" })
      .getByRole("alert"),
  ).toContainText("worker could not load");
  await expect(
    page.getByRole("button", { name: "Browse files" }),
  ).toBeEnabled();
  await page.unroute("**/csv-worker.js");
  await upload(page);
  await expect(
    page.getByText("1 file imported. Ready to transform.", { exact: false }),
  ).toBeVisible();
});

test("silent worker startup has a visible timeout and releases the UI", async ({
  page,
}) => {
  await page.route("**/csv-worker.js", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: "self.onmessage = () => {};",
    }),
  );
  await page.goto("/");
  await upload(page);
  await expect(
    page
      .getByRole("region", { name: "CSV workflow workspace" })
      .getByRole("alert"),
  ).toContainText("did not start within 15 seconds", { timeout: 20000 });
  await expect(
    page.getByRole("button", { name: "Browse files" }),
  ).toBeEnabled();
});

test("ready worker that never replies is terminated after the operation deadline", async ({
  page,
}) => {
  await page.route("**/csv-worker.js", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: "self.onmessage = () => {}; self.postMessage({type: 'ready', version: 1});",
    }),
  );
  await page.goto("/");
  await upload(page);
  await expect(
    page
      .getByRole("region", { name: "CSV workflow workspace" })
      .getByRole("alert"),
  ).toContainText("exceeded 60 seconds", { timeout: 70000 });
  await expect(
    page.getByRole("button", { name: "Browse files" }),
  ).toBeEnabled();
});

test("large production import keeps the browser event loop responsive", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => {
    Object.assign(window, { csvTestTicks: 0 });
    setInterval(() => {
      const state = window as unknown as { csvTestTicks: number };
      state.csvTestTicks++;
    }, 10);
  });
  await upload(
    page,
    "name,note\n" +
      "Ada,large CSV value for worker responsiveness\n".repeat(90000),
  );
  await expect(
    page.getByText("1 file imported. Ready to transform.", { exact: false }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => (window as unknown as { csvTestTicks: number }).csvTestTicks,
    ),
  ).toBeGreaterThan(3);
});

test("a pending worker download has a bounded startup deadline", async ({
  page,
}) => {
  await page.route("**/csv-worker.js", () => {});
  await page.goto("/");
  await upload(page);
  await expect(
    page
      .getByRole("region", { name: "CSV workflow workspace" })
      .getByRole("alert"),
  ).toContainText("did not start within 15 seconds", { timeout: 20000 });
  await expect(
    page.getByRole("button", { name: "Browse files" }),
  ).toBeEnabled();
});

for (const [name, injection] of [
  [
    "runtime error",
    'self.onmessage = () => { throw new Error("Injected worker failure"); };',
  ],
  [
    "unhandled rejection",
    'self.onmessage = () => { void Promise.reject(new Error("Injected worker failure")); };',
  ],
] as const) {
  test(`exported worker reports an ${name} and releases the UI`, async ({
    page,
  }) => {
    const bundle = await readFile("out/csv-worker.js", "utf8");
    await page.route("**/csv-worker.js", (route) =>
      route.fulfill({
        contentType: "text/javascript",
        body: bundle + "\n" + injection,
      }),
    );
    await page.goto("/");
    await upload(page);
    await expect(
      page
        .getByRole("region", { name: "CSV workflow workspace" })
        .getByRole("alert"),
    ).toContainText("Injected worker failure");
    await expect(
      page.getByRole("button", { name: "Browse files" }),
    ).toBeEnabled();
  });
}
