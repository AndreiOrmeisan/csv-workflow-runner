import type { Metadata } from "next";
import Link from "next/link";
import { siteUrl } from "@/lib/site";
import "./globals.css";
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "CSV Workflow Runner — Clean CSVs & Save Reusable Recipes",
    template: "%s | CSV Workflow Runner",
  },
  description:
    "Clean, merge, and transform CSV files privately in your browser. Save reusable workflow recipes and download Excel-friendly CSVs. Free, with no account required.",
  alternates: { canonical: "/" },
  other: {
    "google-adsense-account": "ca-pub-8517954432428097",
  },
  openGraph: {
    type: "website",
    siteName: "CSV Workflow Runner",
    title: "CSV Workflow Runner — Clean CSVs & Save Reusable Recipes",
    description:
      "Clean, merge, and transform CSV files privately in your browser. Save reusable workflow recipes and download Excel-friendly CSVs.",
    url: siteUrl,
  },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <header className="site-header">
          <nav className="wrap navigation" aria-label="Main navigation">
            <Link href="/" className="brand">
              <span className="brand-icon" aria-hidden="true">
                ≋
              </span>
              <span>
                CSV <strong>Workflow Runner</strong>
              </span>
            </Link>
            <div className="nav-links">
              <Link href="/#how-it-works">How it works</Link>
              <Link href="/#faq">FAQ</Link>
              <span className="nav-divider" />
              <span className="private-label">◈ Private by design</span>
            </div>
          </nav>
        </header>
        <div id="main-content">{children}</div>
        <footer className="wrap footer">
          <Link href="/" className="brand">
            <span className="brand-icon" aria-hidden="true">
              ≋
            </span>
            <span>
              CSV <strong>Workflow Runner</strong>
            </span>
          </Link>
          <span>A lighter way to work with data.</span>
          <nav aria-label="Footer">
            <Link href="/about/">About</Link>
            <Link href="/privacy/">Privacy</Link>
          </nav>
        </footer>
      </body>
    </html>
  );
}
