import type { Dataset, WorkflowConfig } from "./types";
export function mergeDatasets(files: Dataset[]): Dataset {
  const columns = [...new Set(files.flatMap((file) => file.columns))];
  if (
    files.reduce((count, file) => count + file.rows.length, 0) *
      columns.length >
    3000000
  )
    throw new Error(
      "The merged data exceeds 3 million cells. Process fewer files together.",
    );
  return {
    columns,
    rows: files.flatMap((file) => {
      const positions = new Map(
        file.columns.map((column, index) => [column, index]),
      );
      return file.rows.map((row) =>
        columns.map((column) => {
          const index = positions.get(column);
          return index === undefined ? "" : (row[index] ?? "");
        }),
      );
    }),
  };
}
export function transform(data: Dataset, config: WorkflowConfig): Dataset {
  const columns = data.columns.map((column) =>
    Object.hasOwn(config.renames, column) ? config.renames[column] : column,
  );
  if (
    columns.some((column) => !column.trim()) ||
    new Set(columns).size !== columns.length
  )
    throw new Error("Renamed columns must be non-empty and unique.");
  let rows = data.rows.map((row) =>
    row.map((value) => (config.trim ? value.trim() : value)),
  );
  if (config.removeEmpty)
    rows = rows.filter((row) => row.some((value) => value !== ""));
  if (config.deduplicate) {
    const seen = new Set<string>();
    rows = rows.filter((row) => {
      const key = JSON.stringify(row);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  return { columns, rows };
}
