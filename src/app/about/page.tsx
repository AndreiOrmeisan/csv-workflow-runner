import type { Metadata } from "next";
import Link from "next/link";
export const metadata: Metadata = {
  title: "About",
  alternates: { canonical: "/about/" },
  openGraph: {
    type: "website",
    siteName: "CSV Workflow Runner",
    title: "About | CSV Workflow Runner",
    url: "/about/",
  },
};
export default function About() {
  return (
    <main className="wrap prose-page">
      <span className="eyebrow">SMALL TOOL. LESS BUSYWORK.</span>
      <h1>About CSV Workflow Runner</h1>
      <p>
        CSV Workflow Runner is a free browser tool for recurring CSV cleanup.
        Import files, configure transformations, review the result, and download
        a clean CSV. Save a recipe to repeat those steps on a future export.
      </p>
      <h2>Built for everyday data work</h2>
      <p>
        Use it for customer lists, inventory exports, or recurring reports. It
        supports trimming cells, removing empty and duplicate rows, renaming
        columns, and combining files by matching header names. Every cell stays
        text throughout processing.
      </p>
      <h2>Simple by design</h2>
      <p>
        All CSV processing runs on your device. There are no accounts or
        subscriptions. Recipes live in your browser and can be transferred as
        validated JSON configuration files.
      </p>
      <h2>MVP scope</h2>
      <p>
        This version supports UTF-8 CSV files with a header row and comma,
        semicolon, or tab delimiters. It provides a 50-row preview and bounded
        file sizes. It does not support Excel workbooks, complex formulas,
        scheduling, or server-side processing.
      </p>
      <Link className="button primary" href="/#workspace">
        Open the workspace →
      </Link>
    </main>
  );
}
