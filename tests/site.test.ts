import test from "node:test";
import assert from "node:assert/strict";
import { resolveSiteUrl } from "../src/lib/site";

test("static SEO defaults to the production HTTPS origin without environment configuration", () => {
  assert.equal(resolveSiteUrl(), "https://csv-workflow-runner.pages.dev");
  assert.equal(resolveSiteUrl(""), "https://csv-workflow-runner.pages.dev");
});

test("a future custom domain overrides the production origin at build time", () => {
  assert.equal(resolveSiteUrl("https://csv.example.com/"), "https://csv.example.com");
});

test("invalid, insecure, and localhost configuration cannot leak into SEO URLs", () => {
  for (const value of ["invalid", "http://localhost:3000", "https://localhost:3000", "https://preview.localhost", "https://127.0.0.1", "https://[::1]", "http://csv.example.com", "ftp://csv.example.com"]) {
    assert.equal(resolveSiteUrl(value), "https://csv-workflow-runner.pages.dev");
  }
});
