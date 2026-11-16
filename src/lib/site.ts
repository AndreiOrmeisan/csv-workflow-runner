function resolveSiteUrl(): string {
  try {
    const url = new URL(
      process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
    );
    if (!["http:", "https:"].includes(url.protocol))
      return "http://localhost:3000";
    return url.origin;
  } catch {
    return "http://localhost:3000";
  }
}
export const siteUrl = resolveSiteUrl();
