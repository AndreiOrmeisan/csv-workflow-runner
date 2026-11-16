import { parseCsv, exportCsv, MAX_FILE_BYTES } from "../lib/csv";
import { mergeDatasets, transform } from "../lib/transform";
import {
  isRecord,
  WORKER_PROTOCOL_VERSION,
  type WorkerRequest,
  type WorkerResponse,
} from "../lib/worker-protocol";

function reportFatal(reason: unknown): void {
  const error =
    reason instanceof Error
      ? reason.message
      : "The CSV worker stopped unexpectedly.";
  try {
    self.postMessage({ type: "fatal", error } satisfies WorkerResponse);
  } catch {
    setTimeout(() => {
      throw new Error(error);
    }, 0);
  }
}

async function handleMessage(value: unknown): Promise<void> {
  if (!isRecord(value) || !Number.isSafeInteger(value.id)) {
    reportFatal(new Error("The CSV worker received an invalid operation ID."));
    return;
  }
  const id = value.id as number;
  try {
    if (!["parse", "transform", "export"].includes(value.kind as string))
      throw new Error("Unknown CSV worker operation.");
    const request = value as WorkerRequest;
    let result: Extract<WorkerResponse, { type: "success" }>["result"];
    if (request.kind === "parse") {
      if (!(request.file instanceof File))
        throw new Error("The CSV worker needs a CSV file.");
      if (request.file.size > MAX_FILE_BYTES)
        throw new Error("Exceeds the 10 MB file limit.");
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
      result = {
        ...parseCsv(text),
        id: crypto.randomUUID(),
        name: request.file.name,
      };
    } else {
      const source = request.config.merge
        ? mergeDatasets(request.files)
        : request.files.find((file) => file.id === request.selected);
      if (!source) throw new Error("Choose a file to transform.");
      const output = transform(source, request.config);
      result =
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
              missing: Object.keys(request.config.renames).filter(
                (column) => !source.columns.includes(column),
              ),
            };
    }
    self.postMessage({ type: "success", id, result } satisfies WorkerResponse);
  } catch (error) {
    self.postMessage({
      type: "failure",
      id,
      error: error instanceof Error ? error.message : "CSV processing failed.",
    } satisfies WorkerResponse);
  }
}

self.onmessage = (event: MessageEvent<unknown>) => {
  // Catch rejections even when posting a response fails.
  return handleMessage(event.data).catch(reportFatal);
};
self.onmessageerror = () =>
  reportFatal(new Error("The CSV worker could not read the incoming data."));
self.addEventListener("unhandledrejection", (event) => {
  event.preventDefault();
  reportFatal(event.reason);
});
self.addEventListener("error", (event) =>
  reportFatal(new Error(event.message || "CSV worker runtime error.")),
);
self.postMessage({
  type: "ready",
  version: WORKER_PROTOCOL_VERSION,
} satisfies WorkerResponse);
