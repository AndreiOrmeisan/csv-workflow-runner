import Papa from "papaparse";
import type { Dataset } from "./types";
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 25 * 1024 * 1024;
export function parseCsv(text: string): Dataset & { warnings: string[] } {
  const result = Papa.parse<string[]>(text.replace(/^\uFEFF/, ""), {
    delimitersToGuess: [",", ";", "\t"],
    skipEmptyLines: false,
    dynamicTyping: false,
  });
  const fatal = result.errors.filter(
    (error) => error.code !== "UndetectableDelimiter",
  );
  if (fatal.length)
    throw new Error(
      fatal
        .slice(0, 3)
        .map(
          (error) =>
            `${error.message}${error.row === undefined ? "" : ` at row ${error.row + 1}`}`,
        )
        .join(". "),
    );
  const records = result.data;
  // A final record created by a terminating newline is not a data row.
  if (
    /(?:\r\n|\n|\r)$/.test(text) &&
    records.at(-1)?.length === 1 &&
    records.at(-1)?.[0] === ""
  )
    records.pop();
  const columns = records.shift() ?? [];
  if (!columns.length || columns.some((value) => !value.trim()))
    throw new Error("Every column needs a non-empty header name.");
  if (new Set(columns).size !== columns.length)
    throw new Error(
      "Duplicate column names found. Give each column a unique name.",
    );
  const warnings = result.errors.map((error) => error.message);
  let shortRows = 0;
  const rows = records.map((row, index) => {
    if (row.length > columns.length)
      throw new Error(
        `Row ${index + 2} has more fields than the header. Check its delimiter or quoting.`,
      );
    if (row.length < columns.length) shortRows++;
    return columns.map((_, i) => row[i] ?? "");
  });
  if (
    rows.length > 100000 ||
    columns.length > 500 ||
    rows.length * columns.length > 2000000
  )
    throw new Error(
      "File exceeds the limit of 100,000 rows, 500 columns, or 2 million cells.",
    );
  if (shortRows)
    warnings.push(`${shortRows} short rows were filled with empty cells.`);
  return { columns, rows, warnings };
}
export function exportCsv(data: Dataset, delimiter: "," | ";"): string {
  return (
    "\uFEFF" +
    Papa.unparse(
      { fields: data.columns, data: data.rows },
      { delimiter, newline: "\r\n" },
    )
  );
}
