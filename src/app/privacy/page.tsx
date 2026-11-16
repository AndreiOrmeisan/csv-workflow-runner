import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Privacy",
  alternates: { canonical: "/privacy/" },
};
export default function Privacy() {
  return (
    <main className="wrap prose-page">
      <span className="eyebrow">YOUR DATA, YOUR DEVICE</span>
      <h1>Privacy</h1>
      <p>
        CSV Workflow Runner processes CSV files locally in your browser using a
        web worker. The application does not upload your CSV content to a
        server.
      </p>
      <h2>Files and recipes</h2>
      <p>
        Imported CSV data stays in the current page’s memory. Reloading or
        closing the page clears the workspace. Downloaded files are saved
        through your browser to your device.
      </p>
      <p>
        When you save a recipe, its name and transformation configuration are
        stored in localStorage on this browser and site. Recipes contain
        settings and column names. They never include CSV rows. You can delete
        saved recipes in the tool or clear this site’s browser storage. Exported
        recipe JSON files remain wherever you save them.
      </p>
      <h2>Accounts, analytics, and hosting</h2>
      <p>
        This application has no accounts, advertising, analytics, or tracking
        cookies. It does not use paid APIs or external processing services. The
        hosting provider receives ordinary requests for website assets and may
        maintain access logs, including IP addresses, under its own policies.
      </p>
      <h2>Your control</h2>
      <p>
        Use Clear all to remove files from the active workspace. Use Delete
        selected recipe to remove a saved recipe. Browser extensions and other
        software on your device are governed by their own permissions.
      </p>
    </main>
  );
}
