# CSV Workflow Runner

A free, privacy-first CSV cleanup tool built with Next.js App Router, strict TypeScript, Tailwind CSS, and Papa Parse. All CSV processing happens in a browser worker. Named recipes store configuration only in localStorage.

## Local development on Windows

Use Node.js 22 LTS or newer with npm. In PowerShell, run the following from the project folder. The `.cmd` suffix works with PowerShell execution policies that disable `npm.ps1`.

```powershell
cd C:\Users\Raluca\Desktop\Web\csv-workflow-runner
npm.cmd ci
npm.cmd run dev
```

Open http://localhost:3000. Press Ctrl+C to stop the server. Next.js configuration generates the worker before development and production compilation, including direct `next build` calls. After editing worker code or its processing modules, restart the development server to rebuild the worker.

## Quality checks

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

Tests cover quoted delimiters, escaped quotes, multiline fields, delimiter detection, BOM round trips, duplicate rows, empty rows, column-order-independent merging, missing columns, malformed input, renaming, recipe persistence, validation, and the bundled worker protocol. The build creates the static website in `out`.

The worker client waits up to 15 seconds for a versioned readiness message and up to 60 seconds for each processing response. Startup, runtime, message decoding, invalid protocol, and timeout failures reject pending work, terminate the failed worker, and release the UI. A later upload creates a fresh worker. CSV processing stays in the worker.

Run browser regression tests after building. These serve `out` directly on port 4173 and exercise the exported worker, CSV download, recipe reuse, missing assets, retry, real timeout deadlines, and a large import. They do not use the development server.

```powershell
npm.cmd run build
npx.cmd playwright install chromium
npm.cmd run test:production
```

To use an already installed Microsoft Edge browser instead of downloading Chromium, set `$env:PLAYWRIGHT_CHANNEL = 'msedge'` before `npm.cmd run test:production`.

## Production configuration

The default production origin is `https://csv-workflow-runner.pages.dev`. Static exports use this origin for canonical URLs, Open Graph URLs, robots.txt, and sitemap.xml, including builds with no environment variable configured. To move to a custom domain, set `NEXT_PUBLIC_SITE_URL` to its HTTPS origin before building. Missing, invalid, insecure, or localhost values fall back to the production origin. Rebuild and redeploy after changing the value. A runtime environment variable is unnecessary.

```powershell
$env:NEXT_PUBLIC_SITE_URL = Read-Host 'Enter the actual HTTPS origin of your deployed site'
npm.cmd run build
```

To inspect the static output locally using Python, run the following, then open http://localhost:8080.

```powershell
py -m http.server 8080 --directory out
```

## Cloudflare Pages deployment

Create a Cloudflare Pages project from this repository. Select the static framework preset, use `npm run build` as the build command, and `out` as the output directory. If the repository contains this project in a subfolder, set the root directory to `csv-workflow-runner`. Configure Node.js 22 or newer. The default SEO origin matches `https://csv-workflow-runner.pages.dev`. For a future custom domain, set `NEXT_PUBLIC_SITE_URL` in the Cloudflare Pages build environment and redeploy.

For a direct upload from PowerShell, install and authenticate the official Cloudflare Wrangler CLI, create a Pages project in your account, and run the following. The command prompts for the target project.

```powershell
npm.cmd run build
npx.cmd wrangler pages deploy out
```

This project uses `output: "export"` and trailing slashes. It has no API routes, middleware, runtime server, database, or account system. Serve the `out` directory through a static host. `next start` is incompatible with static export.

Deploy the complete `out` directory, including `csv-worker.js`. The build's postbuild check verifies that this file is present and exactly matches the current bundle. Check the deployed `/csv-worker.js` URL after publishing. It must return HTTP 200 with a JavaScript content type. A 404 page or HTML fallback cannot run as a worker. Hosting configuration and asset-upload exclusions must preserve this file.

## Workflow behavior

1. Add one or more UTF-8 CSV files with a header row.
2. Select transformations and optionally rename original headers.
3. Apply the workflow and compare original and transformed previews.
4. Save a named recipe in this browser, or export/import validated version 1 JSON.
5. Download `cleaned-data.csv` using a comma or semicolon, with UTF-8 BOM and proper CSV quoting.

Merging runs first and matches exact, case-sensitive original column names. Output columns use first-seen order and missing cells become empty strings. Trimming runs next, followed by empty-row removal and exact all-column deduplication. Renaming changes headers only. Duplicate removal keeps the first occurrence. With merge disabled, the selected file is processed. Absent recipe rename headers are skipped and reported in the preview. Output name collisions are rejected. Files and values are never mutated.

All values stay text. Leading zeros, date-like strings, and formula-like strings are preserved. Spreadsheet software can reinterpret values when opening a CSV. Use its text-import controls where appropriate and review untrusted files before opening them.

## Limits and storage

- Up to 20 files, 10 MB per file, and 25 MB combined per workspace.
- Up to 100,000 rows, 500 columns, and 2 million cells per file, with 3 million cells after merging.
- Preview displays the first 50 rows. Download includes all resulting rows.
- UTF-8 input and comma, semicolon, or tab auto-detection. Duplicate or blank headers, broken quoting, and excess fields are rejected. Short records are padded and reported.
- Up to 100 local recipes with names of 80 characters or fewer. JSON imports are limited to 100 KB. Duplicate saved names require a different name.
- Reloading clears CSV data. Clearing browser storage deletes local recipes. JSON export allows recipe transfer and backup.
- Browser memory may impose lower practical limits. XLSX, legacy encodings, joins, scheduled jobs, and advanced formulas are outside the MVP.

## Source layout

- `src/lib/csv.ts` handles Papa Parse import/export and limits.
- `src/lib/transform.ts` handles immutable merging and transformations.
- `src/lib/recipes.ts` validates configuration-only recipes and persists them.
- `src/workers/csv.worker.ts` handles processing messages.
- `src/lib/worker-client.ts` handles readiness, request deadlines, worker failures, and cleanup.
- `src/lib/worker-protocol.ts` defines the versioned worker message protocol.
- `scripts/build-worker.mjs` bundles the worker with esbuild, invoked by Next.js configuration and unit-test setup.
- `scripts/verify-export.mjs` verifies the worker in the static production output.
- `scripts/serve-export.mjs` serves static files locally for production browser tests.
- `src/components/runner.tsx` provides the client workspace.
- `src/app` provides the landing page, shared design, metadata, privacy/about pages, robots, and sitemap.
- `tests` provides automated unit and bundled-worker regression coverage.

No analytics, ads, remote fonts, or CSV network transmission are included. The hosting provider may maintain ordinary website access logs.
