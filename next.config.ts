import type { NextConfig } from "next";
import { buildWorker } from "./scripts/build-worker.mjs";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default async function configureNext(): Promise<NextConfig> {
  // Generate public assets even when the host invokes next build directly.
  await buildWorker();
  return nextConfig;
}
