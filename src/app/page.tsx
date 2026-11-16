import { Runner } from "@/components/runner";
export default function Home() {
  return (
    <main>
      <section className="hero wrap">
        <div className="hero-copy">
          <div className="hero-kicker">
            <span /> FREE, PRIVATE & ENTIRELY IN YOUR BROWSER
          </div>
          <h1>
            Clean your CSVs.
            <br />
            <span>Keep your workflow.</span>
          </h1>
          <p>
            Turn messy files into ready-to-use data. Clean, merge, and transform
            your CSVs, then save a recipe to do it all again.
          </p>
          <div className="hero-benefits">
            <span>✓ No uploads</span>
            <span>✓ No account</span>
            <span>✓ Always free</span>
          </div>
        </div>
        <div className="hero-note">
          <div className="flow-mark" aria-hidden="true">
            <span>CSV</span>
            <b>→</b>
            <span className="flow-center">✦</span>
            <b>→</b>
            <span>
              CSV <i>✓</i>
            </span>
          </div>
          <p>
            Same cleanup.
            <br />
            <strong>Every time.</strong>
          </p>
          <span>Your next monthly report just got easier.</span>
        </div>
      </section>
      <div className="wrap">
        <Runner />
      </div>
      <section id="how-it-works" className="wrap how-section">
        <div className="section-intro">
          <span className="eyebrow">LESS REPETITION. MORE POSSIBILITY.</span>
          <h2>
            One good workflow.
            <br />
            As many files as you need.
          </h2>
          <p>That recurring export deserves a routine you can trust.</p>
        </div>
        <div className="how-grid">
          <article>
            <span className="feature-icon" aria-hidden="true">
              ↥
            </span>
            <h3>Start with your files</h3>
            <p>
              Bring a customer export, inventory list, or monthly report.
              Commas, semicolons, and tabs are detected automatically.
            </p>
          </article>
          <article>
            <span className="feature-icon" aria-hidden="true">
              ≋
            </span>
            <h3>Make it consistent</h3>
            <p>
              Trim stray spaces, remove empty and duplicate rows, and rename
              headers. Combine files even when their columns appear in a
              different order.
            </p>
          </article>
          <article>
            <span className="feature-icon" aria-hidden="true">
              ↻
            </span>
            <h3>Put it on repeat</h3>
            <p>
              Save your settings as a recipe. Next time, load the recipe, add
              fresh CSVs, and download a consistently formatted result.
            </p>
          </article>
        </div>
      </section>
      <section className="wrap example-section">
        <div>
          <span className="eyebrow">A REAL-WORLD EXAMPLE</span>
          <h2>
            Monthly exports.
            <br />
            Minutes of cleanup, saved.
          </h2>
          <p>
            Combine January and February customer exports with columns in
            different orders. Turn on trimming and duplicate removal, rename
            “Customer” to “Customer name”, and save “Monthly customer cleanup”.
          </p>
          <p>
            Next month, import the new files and load your recipe. Column
            matching uses original header names exactly, including
            capitalization and spaces.
          </p>
        </div>
        <div className="example-card">
          <div className="example-line">
            <span>january.csv</span>
            <span>february.csv</span>
          </div>
          <div className="example-connector" aria-hidden="true">
            ↓
          </div>
          <div className="example-recipe">
            ✦{" "}
            <div>
              <strong>Monthly customer cleanup</strong>
              <small>Trim · Deduplicate · Merge · Rename</small>
            </div>
          </div>
          <div className="example-connector" aria-hidden="true">
            ↓
          </div>
          <div className="example-output">
            ✓ cleaned-data.csv <span>Ready to use</span>
          </div>
        </div>
      </section>
      <section id="faq" className="wrap faq-section">
        <div>
          <span className="eyebrow">GOOD TO KNOW</span>
          <h2>
            A few things,
            <br />
            before you run.
          </h2>
          <p>Simple tools work best with clear expectations.</p>
        </div>
        <div className="faq-list">
          {[
            [
              "Does my CSV leave my device?",
              "CSV parsing, transformations, and exports run in your browser. This app never sends CSV content to a server. Only named recipe settings are stored in your browser when you save them.",
            ],
            [
              "What happens when files have different columns?",
              "Merging creates a union of all original column names, in first-seen order. Each value goes under its matching header. Missing values are empty strings. Header matching is exact and case-sensitive.",
            ],
            [
              "Will numbers, dates, or leading zeros change?",
              "All cells are processed as text. Values such as 00123 stay intact in the exported CSV. A spreadsheet application may infer types when you open the file, so use its text import option when that matters. Formula-like values are also preserved. Review untrusted files before opening them in a spreadsheet.",
            ],
            [
              "What are the limits?",
              "Use up to 20 UTF-8 CSV files, 10 MB per file and 25 MB total. Each file can have up to 100,000 rows, 500 columns, and 2 million cells. Merged data is limited to 3 million cells. Preview shows the first 50 rows. Browser memory and device performance may impose lower practical limits.",
            ],
            [
              "Can I share a workflow?",
              "Yes. Give your recipe a name and export it as JSON. Someone else can import the configuration and apply it to their own files. Recipes never include CSV rows. Local recipes stay in the current browser and can be lost when browser storage is cleared.",
            ],
            [
              "How are malformed files handled?",
              "Broken quoting, extra fields, empty headers, and duplicate headers stop the affected file from importing. Short rows are filled with empty cells and show a warning. The first row must contain headers. XLSX files and legacy encodings are outside this MVP.",
            ],
          ].map(([question, answer]) => (
            <details key={question}>
              <summary>
                {question}
                <span aria-hidden="true">+</span>
              </summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
