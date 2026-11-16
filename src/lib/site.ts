const DEFAULT_SITE_URL = "https://csv-workflow-runner.pages.dev";

export function resolveSiteUrl(configuredUrl?: string): string {
  try {
    const url = new URL(configuredUrl || DEFAULT_SITE_URL);
    if (
      url.protocol !== "https:" ||
      url.hostname === "localhost" ||
      url.hostname.endsWith(".localhost") ||
      url.hostname.startsWith("127.") ||
      url.hostname === "[::1]" ||
      url.hostname === "0.0.0.0"
    ) return DEFAULT_SITE_URL;
    return url.origin;
  } catch {
    return DEFAULT_SITE_URL;
  }
}
// Static export resolves this at build time. No hosting runtime variable is needed.
export const siteUrl = resolveSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
