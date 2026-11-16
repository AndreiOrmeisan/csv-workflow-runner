import type { CsvFile, Dataset, WorkflowConfig } from "./types";

export const WORKER_PROTOCOL_VERSION = 1;
export const WORKER_URL = "/csv-worker.js";

export interface Preview {
  before: Dataset;
  after: Dataset;
  beforeCount: number;
  afterCount: number;
  missing: string[];
}

export type WorkerTask =
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
    };

export type WorkerRequest = WorkerTask & { id: number };
export type WorkerResponse =
  | { type: "ready"; version: number }
  | { type: "success"; id: number; result: CsvFile | Preview | string }
  | { type: "failure"; id: number; error: string }
  | { type: "fatal"; error: string };

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isWorkerResponse(value: unknown): value is WorkerResponse {
  if (!isRecord(value)) return false;
  if (value.type === "ready") return typeof value.version === "number";
  if (value.type === "fatal") return typeof value.error === "string";
  if (!Number.isSafeInteger(value.id)) return false;
  if (value.type === "failure") return typeof value.error === "string";
  return value.type === "success" && value.result !== undefined;
}

export function isWorkerResult(
  kind: WorkerTask["kind"],
  value: unknown,
): boolean {
  if (kind === "export") return typeof value === "string";
  if (!isRecord(value)) return false;
  if (kind === "parse")
    return (
      typeof value.id === "string" &&
      typeof value.name === "string" &&
      Array.isArray(value.columns) &&
      Array.isArray(value.rows) &&
      Array.isArray(value.warnings)
    );
  return (
    isRecord(value.before) &&
    Array.isArray(value.before.columns) &&
    Array.isArray(value.before.rows) &&
    isRecord(value.after) &&
    Array.isArray(value.after.columns) &&
    Array.isArray(value.after.rows) &&
    typeof value.beforeCount === "number" &&
    typeof value.afterCount === "number" &&
    Array.isArray(value.missing)
  );
}
