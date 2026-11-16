export interface Dataset {
  columns: string[];
  rows: string[][];
}
export interface CsvFile extends Dataset {
  id: string;
  name: string;
  warnings: string[];
}
export interface WorkflowConfig {
  trim: boolean;
  removeEmpty: boolean;
  deduplicate: boolean;
  merge: boolean;
  renames: Record<string, string>;
}
export interface Recipe {
  version: 1;
  name: string;
  config: WorkflowConfig;
}
export const defaultConfig: WorkflowConfig = {
  trim: false,
  removeEmpty: false,
  deduplicate: false,
  merge: true,
  renames: {},
};
