"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_FILE_BYTES, MAX_TOTAL_BYTES } from "@/lib/csv";
import { readRecipes, validateRecipe, writeRecipes } from "@/lib/recipes";
import {
  defaultConfig,
  type CsvFile,
  type Dataset,
  type Recipe,
  type WorkflowConfig,
} from "@/lib/types";
import type { WorkerRequest } from "@/workers/csv.worker";

interface Preview {
  before: Dataset;
  after: Dataset;
  beforeCount: number;
  afterCount: number;
  missing: string[];
}
type Task = WorkerRequest extends infer R
  ? R extends { id: number }
    ? Omit<R, "id">
    : never
  : never;
const options = [
  [
    "trim",
    "Trim whitespace",
    "Remove spaces and line breaks at the start and end of each cell.",
  ],
  [
    "removeEmpty",
    "Remove empty rows",
    "Drop rows where every cell is empty. Enable trim to include whitespace-only rows.",
  ],
  [
    "deduplicate",
    "Remove duplicate rows",
    "Keep the first exact match across all columns, after trimming if selected.",
  ],
  [
    "merge",
    "Merge files by column name",
    "Combine all files using exact, case-sensitive headers. Missing values become empty cells.",
  ],
] as const;

function download(content: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function Runner() {
  const [files, setFiles] = useState<CsvFile[]>([]);
  const [config, setConfig] = useState<WorkflowConfig>(defaultConfig);
  const [selected, setSelected] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [view, setView] = useState<"before" | "after">("after");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipeName, setRecipeName] = useState("");
  const [recipeIndex, setRecipeIndex] = useState("");
  const [delimiter, setDelimiter] = useState<"," | ";">(",");
  const worker = useRef<Worker | null>(null);
  const pending = useRef(
    new Map<
      number,
      { resolve: (value: unknown) => void; reject: (error: Error) => void }
    >(),
  );
  const sequence = useRef(0);
  const bytes = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const recipeInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const instance = new Worker("/csv-worker.js");
    worker.current = instance;
    instance.onmessage = (
      event: MessageEvent<{ id: number; result: unknown; error?: string }>,
    ) => {
      const task = pending.current.get(event.data.id);
      pending.current.delete(event.data.id);
      if (event.data.error) task?.reject(new Error(event.data.error));
      else task?.resolve(event.data.result);
    };
    const tasks = pending.current;
    instance.onerror = () => {
      for (const task of tasks.values())
        task.reject(
          new Error(
            "The processing worker failed. Reload the page and try a smaller file.",
          ),
        );
      tasks.clear();
    };
    const storageTimer = setTimeout(() => {
      try {
        setRecipes(readRecipes(localStorage));
      } catch {
        setError(
          "Saved recipes could not be read. JSON recipe import and export are still available.",
        );
      }
    }, 0);
    return () => {
      clearTimeout(storageTimer);
      instance.terminate();
      for (const task of tasks.values())
        task.reject(new Error("Processing cancelled."));
      tasks.clear();
    };
  }, []);

  function request<T>(task: Task): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!worker.current) {
        reject(
          new Error("The processing worker is unavailable in this browser."),
        );
        return;
      }
      const id = ++sequence.current;
      pending.current.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
      });
      worker.current.postMessage({ ...task, id });
    });
  }
  function update(next: WorkflowConfig) {
    setConfig(next);
    setPreview(null);
    setError("");
    setMessage("");
  }
  async function upload(incoming: FileList | File[]) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    setPreview(null);
    const accepted: CsvFile[] = [];
    const errors: string[] = [];
    for (const file of Array.from(incoming)) {
      try {
        if (!/\.csv$/i.test(file.name)) throw new Error("Choose a .csv file.");
        if (file.size > MAX_FILE_BYTES)
          throw new Error("Exceeds the 10 MB file limit.");
        if (
          bytes.current + file.size > MAX_TOTAL_BYTES ||
          files.length + accepted.length >= 20
        )
          throw new Error(
            "Limit reached. Use up to 20 files and 25 MB per session.",
          );
        accepted.push(await request<CsvFile>({ kind: "parse", file }));
        bytes.current += file.size;
      } catch (failure) {
        errors.push(
          `${file.name} — ${failure instanceof Error ? failure.message : "Import failed."}`,
        );
      }
    }
    setFiles((current) => [...current, ...accepted]);
    if (!selected && accepted[0]) setSelected(accepted[0].id);
    setError(errors.join("\n"));
    if (accepted.length)
      setMessage(
        `${accepted.length} ${accepted.length === 1 ? "file imported" : "files imported"}. Ready to transform.`,
      );
    setBusy(false);
  }
  async function apply() {
    setBusy(true);
    setError("");
    setPreview(null);
    setMessage("");
    try {
      setPreview(
        await request<Preview>({ kind: "transform", files, config, selected }),
      );
      setView("after");
      setMessage("Workflow applied. Review the result below.");
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Transformation failed.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function exportData() {
    setBusy(true);
    setError("");
    try {
      download(
        await request<string>({
          kind: "export",
          files,
          config,
          selected,
          delimiter,
        }),
        "cleaned-data.csv",
        "text/csv;charset=utf-8",
      );
      setMessage("Your CSV download is ready.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  }
  function currentRecipe() {
    return validateRecipe({ version: 1, name: recipeName, config });
  }
  function persist(next: Recipe[]) {
    writeRecipes(localStorage, next);
    setRecipes(next);
  }
  function saveRecipe() {
    try {
      const recipe = currentRecipe();
      if (recipes.some((saved) => saved.name === recipe.name))
        throw new Error(
          "This recipe name is already saved. Choose a different name.",
        );
      persist([...recipes, recipe]);
      setMessage(`Saved “${recipe.name}” in this browser.`);
      setError("");
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Browser storage is unavailable. Export your recipe as JSON instead.",
      );
    }
  }
  async function importRecipe(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > 100000)
        throw new Error("Recipe JSON must be under 100 KB.");
      const recipe = validateRecipe(JSON.parse(await file.text()) as unknown);
      update(recipe.config);
      setRecipeName(recipe.name);
      setMessage(
        `Loaded “${recipe.name}”. Save it to keep it in this browser.`,
      );
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Recipe import failed.",
      );
    }
  }
  const columns = [...new Set(files.flatMap((file) => file.columns))];
  const originalFile = files.find((file) => file.id === selected) ?? files[0];
  const table = preview ? preview[view] : originalFile;
  return (
    <section
      id="workspace"
      className="workspace"
      aria-label="CSV workflow workspace"
    >
      <div className="workspace-heading">
        <div>
          <span className="eyebrow">YOUR WORKSPACE</span>
          <h2>Make your data work.</h2>
        </div>
        <span className="local-status">
          <span /> Processing stays on your device
        </span>
      </div>
      <div className="steps" aria-label="Workflow steps">
        <a href="#upload">
          1 <span>Upload</span>
        </a>
        <span>→</span>
        <a href="#transform">
          2 <span>Transform</span>
        </a>
        <span>→</span>
        <a href="#preview">
          3 <span>Preview</span>
        </a>
        <span>→</span>
        <a href="#recipes">
          4 <span>Save recipe</span>
        </a>
        <span>→</span>
        <a href="#download">
          5 <span>Download</span>
        </a>
      </div>
      <div className="work-grid">
        <div className="controls">
          <section id="upload" className="panel">
            <div className="section-title">
              <h3>
                <span className="step-number">1</span> Source files
              </h3>
              {files.length > 0 && (
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => {
                    setFiles([]);
                    setSelected("");
                    setPreview(null);
                    bytes.current = 0;
                    setError("");
                    setMessage("Source files cleared from this workspace.");
                  }}
                >
                  Clear all
                </button>
              )}
            </div>
            <div
              className={`dropzone ${dragging ? "dragging" : ""}`}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                void upload(event.dataTransfer.files);
              }}
            >
              <div className="upload-icon" aria-hidden="true">
                ↑
              </div>
              <strong>Drop your CSV files here</strong>
              <p>or choose files from your device</p>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => fileInput.current?.click()}
              >
                Browse files <span aria-hidden="true">↗</span>
              </button>
              <small>CSV · 10 MB per file · 25 MB total</small>
              <input
                ref={fileInput}
                className="sr-only"
                type="file"
                accept=".csv,text/csv"
                multiple
                aria-label="Upload CSV files"
                disabled={busy}
                onChange={(event) => {
                  if (event.target.files) void upload(event.target.files);
                  event.target.value = "";
                }}
              />
            </div>
            {files.length > 0 && (
              <ul className="file-list">
                {files.map((file) => (
                  <li key={file.id}>
                    <div className="file-symbol" aria-hidden="true">
                      CSV
                    </div>
                    <div>
                      <strong>{file.name}</strong>
                      <small>
                        {file.rows.length.toLocaleString()} rows ·{" "}
                        {file.columns.length} columns
                      </small>
                      {file.warnings.map((warning, i) => (
                        <small className="warning" key={i}>
                          {warning}
                        </small>
                      ))}
                    </div>
                    <span className="file-check" aria-label="Imported">
                      ✓
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section id="transform" className="panel">
            <div className="section-title">
              <h3>
                <span className="step-number">2</span> Transformations
              </h3>
              <button
                className="text-button"
                disabled={busy}
                onClick={() => update({ ...defaultConfig, renames: {} })}
              >
                Reset
              </button>
            </div>
            <p className="section-description">
              A little cleanup. A repeatable workflow.
            </p>
            <fieldset disabled={busy} className="option-list">
              <legend className="sr-only">Transformation options</legend>
              {options.map(([key, title, description]) => (
                <label className="option" key={key}>
                  <input
                    type="checkbox"
                    checked={config[key]}
                    onChange={(event) =>
                      update({ ...config, [key]: event.target.checked })
                    }
                  />
                  <span>
                    <strong>{title}</strong>
                    <small>{description}</small>
                  </span>
                </label>
              ))}
            </fieldset>
            {!config.merge && files.length > 0 && (
              <label className="field-label">
                File to process
                <select
                  value={selected}
                  disabled={busy}
                  onChange={(event) => {
                    setSelected(event.target.value);
                    setPreview(null);
                  }}
                >
                  {files.map((file) => (
                    <option key={file.id} value={file.id}>
                      {file.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <details className="rename-section">
              <summary>
                Rename columns{" "}
                <span>
                  {columns.length
                    ? `${columns.length} available`
                    : "Upload a file first"}
                </span>
              </summary>
              <p className="hint">
                Renames match original headers exactly and run after merging.
                Each output name must be unique.
              </p>
              {columns.map((column) => (
                <label className="rename-row" key={column}>
                  <span title={column}>{column}</span>
                  <span aria-hidden="true">→</span>
                  <input
                    disabled={busy}
                    aria-label={`New name for ${column}`}
                    value={
                      Object.hasOwn(config.renames, column)
                        ? config.renames[column]
                        : column
                    }
                    maxLength={1000}
                    onChange={(event) =>
                      update({
                        ...config,
                        renames: {
                          ...config.renames,
                          [column]: event.target.value,
                        },
                      })
                    }
                  />
                </label>
              ))}
            </details>
            <button
              className="button primary full"
              disabled={busy || !files.length}
              onClick={() => void apply()}
            >
              {busy ? "Processing…" : "Apply workflow"}
              <span aria-hidden="true">→</span>
            </button>
          </section>
        </div>
        <div className="results">
          <section id="preview" className="panel preview-panel">
            <div className="section-title">
              <h3>
                <span className="step-number">3</span> Data preview
              </h3>
              <span className="subtle">First 50 rows</span>
            </div>
            <div className="preview-toolbar">
              <div className="tabs" aria-label="Preview version">
                {(["before", "after"] as const).map((tab) => (
                  <button
                    key={tab}
                    disabled={!preview && tab === "after"}
                    aria-pressed={(preview ? view : "before") === tab}
                    className={
                      (preview ? view : "before") === tab ? "active" : ""
                    }
                    onClick={() => setView(tab)}
                  >
                    {tab === "before" ? "Original" : "Transformed"}
                  </button>
                ))}
              </div>
              {table && (
                <span className="row-count">
                  {(preview
                    ? view === "before"
                      ? preview.beforeCount
                      : preview.afterCount
                    : originalFile.rows.length
                  ).toLocaleString()}{" "}
                  rows · {table.columns.length} columns
                </span>
              )}
            </div>
            {table ? (
              <>
                <div
                  className="table-scroll"
                  tabIndex={0}
                  role="region"
                  aria-label={`${preview ? view : "original"} data preview`}
                >
                  <table>
                    <thead>
                      <tr>
                        <th scope="col" className="row-index">
                          #
                        </th>
                        {table.columns.map((column, i) => (
                          <th scope="col" key={i}>
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {table.rows.slice(0, 50).map((row, i) => (
                        <tr key={i}>
                          <th scope="row" className="row-index">
                            {i + 1}
                          </th>
                          {row.map((cell, j) => (
                            <td key={j}>
                              {cell === "" ? (
                                <span className="empty-cell">empty</span>
                              ) : (
                                cell
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="preview-foot">
                  <span>
                    {preview
                      ? `${(preview.beforeCount - preview.afterCount).toLocaleString()} rows removed`
                      : `Original file · ${originalFile.name}`}
                  </span>
                  <span>Original files preserved</span>
                </div>
                {preview && preview.missing.length > 0 && (
                  <p className="notice warning">
                    Recipe headers absent from this data were skipped{" "}
                    {preview.missing.join(", ")}.
                  </p>
                )}
              </>
            ) : (
              <div className="preview-empty">
                <div className="mini-sheet" aria-hidden="true">
                  <div />
                  <div />
                  <div />
                  <div />
                </div>
                <h4>Your clean data starts here</h4>
                <p>
                  Upload your files, choose a few transformations,
                  <br className="desktop-break" /> and apply your workflow to
                  see the result.
                </p>
                <span>Text stays text. Leading zeros stay put.</span>
              </div>
            )}
          </section>
          <section id="recipes" className="panel recipe-panel">
            <div className="section-title">
              <h3>
                <span className="step-number">4</span> Keep the recipe
              </h3>
              <span className="pill">Reusable</span>
            </div>
            <p className="section-description">
              Save the steps today. Run them on next month’s files.
            </p>
            <div className="inline-fields">
              <label className="field-label grow">
                Recipe name
                <input
                  value={recipeName}
                  disabled={busy}
                  maxLength={80}
                  placeholder="e.g. Monthly customer cleanup"
                  onChange={(event) => setRecipeName(event.target.value)}
                />
              </label>
              <button
                className="button secondary"
                disabled={busy || !recipeName.trim()}
                onClick={saveRecipe}
              >
                Save recipe
              </button>
            </div>
            <div className="recipe-actions">
              <button
                disabled={busy || !recipeName.trim()}
                className="text-button"
                onClick={() => {
                  try {
                    download(
                      JSON.stringify(currentRecipe(), null, 2),
                      "workflow-recipe.json",
                      "application/json",
                    );
                    setError("");
                  } catch (failure) {
                    setError(
                      failure instanceof Error
                        ? failure.message
                        : "Invalid recipe.",
                    );
                  }
                }}
              >
                ↓ Export JSON
              </button>
              <button
                disabled={busy}
                className="text-button"
                onClick={() => recipeInput.current?.click()}
              >
                ↑ Import JSON
              </button>
              <input
                ref={recipeInput}
                className="sr-only"
                type="file"
                accept=".json,application/json"
                aria-label="Import recipe JSON"
                onChange={(event) => {
                  void importRecipe(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </div>
            {recipes.length > 0 && (
              <div className="saved-recipes">
                <label className="field-label">
                  Saved in this browser
                  <select
                    value={recipeIndex}
                    disabled={busy}
                    onChange={(event) => {
                      const index = event.target.value;
                      setRecipeIndex(index);
                      if (index !== "") {
                        const recipe = recipes[Number(index)];
                        update(recipe.config);
                        setRecipeName(recipe.name);
                        setMessage(
                          `Loaded “${recipe.name}”. Apply the workflow to preview your files.`,
                        );
                      }
                    }}
                  >
                    <option value="">Load a saved recipe…</option>
                    {recipes.map((recipe, index) => (
                      <option key={recipe.name} value={index}>
                        {recipe.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="text-button"
                  disabled={busy || recipeIndex === ""}
                  onClick={() => {
                    try {
                      persist(
                        recipes.filter((_, i) => i !== Number(recipeIndex)),
                      );
                      setRecipeIndex("");
                      setMessage("Recipe deleted.");
                    } catch {
                      setError("Could not update browser storage.");
                    }
                  }}
                >
                  Delete selected recipe
                </button>
              </div>
            )}
            <p className="hint">
              Recipes contain settings only. CSV content is never saved.
            </p>
          </section>
          <section id="download" className="download-panel">
            <div>
              <h3>
                <span className="step-number">5</span> Ready for the next step.
              </h3>
              <p>Excel-friendly CSV with UTF-8 BOM.</p>
            </div>
            <div className="download-actions">
              <label className="sr-only" htmlFor="delimiter">
                Export delimiter
              </label>
              <select
                id="delimiter"
                value={delimiter}
                disabled={busy}
                onChange={(event) =>
                  setDelimiter(event.target.value as "," | ";")
                }
              >
                <option value=",">Comma (,)</option>
                <option value=";">Semicolon (;)</option>
              </select>
              <button
                className="button primary"
                disabled={busy || !preview}
                onClick={() => void exportData()}
              >
                ↓ Download CSV
              </button>
            </div>
          </section>
        </div>
      </div>
      <div className="feedback" aria-live="polite" aria-atomic="true">
        {busy && (
          <p className="notice">
            Processing locally. Please keep this tab open.
          </p>
        )}
        {message && !busy && <p className="notice success">✓ {message}</p>}
      </div>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
    </section>
  );
}
