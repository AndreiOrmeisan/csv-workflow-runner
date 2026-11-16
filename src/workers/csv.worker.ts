import { parseCsv, exportCsv } from "../lib/csv";
import { mergeDatasets, transform } from "../lib/transform";
import type { CsvFile, WorkflowConfig } from "../lib/types";
export type WorkerRequest = { id: number } & (
  | { kind: "parse"; file: File }
  | {
      kind: "transform";
      files: CsvFile[];
      config: WorkflowConfig;
      selected: string;
    }
  | {
      kind: "export";
      files: CsvFile[];
      config: WorkflowConfig;
      selected: string;
      delimiter: "," | ";";
    }
);
self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  try {
    if (request.kind === "parse") {
      let text: string;
      try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(
          await request.file.arrayBuffer(),
        );
      } catch {
        throw new Error(
          "This file could not be read as UTF-8. Export it as UTF-8 CSV and try again.",
        );
      }
      const parsed = parseCsv(text);
      self.postMessage({
        id: request.id,
        result: { ...parsed, id: crypto.randomUUID(), name: request.file.name },
      });
      return;
    }
    const source = request.config.merge
      ? mergeDatasets(request.files)
      : request.files.find((file) => file.id === request.selected);
    if (!source) throw new Error("Choose a file to transform.");
    if (source.rows.length * source.columns.length > 3000000)
      throw new Error(
        "The merged data exceeds 3 million cells. Process fewer files together.",
      );
    const output = transform(source, request.config);
    const missing = Object.keys(request.config.renames).filter(
      (column) => !source.columns.includes(column),
    );
    self.postMessage({
      id: request.id,
      result:
        request.kind === "export"
          ? exportCsv(output, request.delimiter)
          : {
              before: {
                columns: source.columns,
                rows: source.rows.slice(0, 50),
              },
              after: {
                columns: output.columns,
                rows: output.rows.slice(0, 50),
              },
              beforeCount: source.rows.length,
              afterCount: output.rows.length,
              missing,
            },
    });
  } catch (error) {
    self.postMessage({
      id: request.id,
      error: error instanceof Error ? error.message : "Processing failed.",
    });
  }
};
