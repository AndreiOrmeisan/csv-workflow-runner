import {
  isWorkerResponse,
  isWorkerResult,
  WORKER_PROTOCOL_VERSION,
  WORKER_URL,
  type WorkerTask,
} from "./worker-protocol";

type WorkerPort = Pick<
  Worker,
  "postMessage" | "terminate" | "onmessage" | "onerror" | "onmessageerror"
>;
interface Pending {
  kind: WorkerTask["kind"];
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}
interface Connection {
  worker: WorkerPort;
  ready: Promise<void>;
  markReady: () => void;
  rejectReady: (error: Error) => void;
  startupTimer: ReturnType<typeof setTimeout>;
  initialized: boolean;
}

export class CsvWorkerError extends Error {}

export class CsvWorkerClient {
  private connection: Connection | null = null;
  private pending = new Map<number, Pending>();
  private sequence = 0;
  private disposed = false;

  constructor(
    private readonly createWorker: () => WorkerPort = () =>
      new Worker(WORKER_URL),
    private readonly startupTimeout = 15000,
    private readonly operationTimeout = 60000,
  ) {}

  private fail(connection: Connection, error: Error): void {
    if (this.connection !== connection) return;
    const failure = new CsvWorkerError(error.message);
    this.connection = null;
    clearTimeout(connection.startupTimer);
    connection.rejectReady(failure);
    connection.worker.terminate();
    for (const task of this.pending.values()) {
      clearTimeout(task.timer);
      task.reject(failure);
    }
    this.pending.clear();
  }

  private connect(): Connection {
    if (this.disposed) throw new Error("Processing cancelled.");
    if (this.connection) return this.connection;
    // Construction can throw (unsupported Worker, CSP, or an invalid URL).
    // request() is async, so callers always receive a rejected operation.
    const worker = this.createWorker();
    let markReady!: () => void;
    let rejectReady!: (error: Error) => void;
    const ready = new Promise<void>((resolve, reject) => {
      markReady = resolve;
      rejectReady = reject;
    });
    const connection: Connection = {
      worker,
      ready,
      markReady,
      rejectReady,
      initialized: false,
      startupTimer: setTimeout(
        () =>
          this.fail(
            connection,
            new Error(
              "The CSV worker did not start within 15 seconds. Reload the page or try again. If this continues, the deployed worker asset may be missing or blocked.",
            ),
          ),
        this.startupTimeout,
      ),
    };
    this.connection = connection;
    worker.onerror = (event) => {
      this.fail(
        connection,
        new Error(
          `The CSV worker could not load or stopped unexpectedly.${event.message ? ` ${event.message}` : " Check that /csv-worker.js is deployed and allowed by your browser."}`,
        ),
      );
    };
    worker.onmessageerror = () =>
      this.fail(
        connection,
        new Error(
          "The CSV worker response could not be read. Please try again.",
        ),
      );
    worker.onmessage = (event: MessageEvent<unknown>) => {
      if (this.connection !== connection) return;
      const response = event.data;
      if (!isWorkerResponse(response)) {
        this.fail(
          connection,
          new Error(
            "The CSV worker returned an invalid response. Reload the page to update the application.",
          ),
        );
        return;
      }
      if (response.type === "fatal") {
        this.fail(connection, new Error(response.error));
        return;
      }
      if (response.type === "ready") {
        if (
          response.version !== WORKER_PROTOCOL_VERSION ||
          connection.initialized
        ) {
          this.fail(
            connection,
            new Error(
              "The CSV worker version does not match this page. Reload the page.",
            ),
          );
          return;
        }
        connection.initialized = true;
        clearTimeout(connection.startupTimer);
        connection.markReady();
        return;
      }
      const task = this.pending.get(response.id);
      if (!task || !connection.initialized) {
        this.fail(
          connection,
          new Error(
            "The CSV worker returned an unexpected operation ID. Please try again.",
          ),
        );
        return;
      }
      if (
        response.type === "success" &&
        !isWorkerResult(task.kind, response.result)
      ) {
        this.fail(
          connection,
          new Error(
            "The CSV worker returned an invalid result. Reload the page to update the application.",
          ),
        );
        return;
      }
      this.pending.delete(response.id);
      clearTimeout(task.timer);
      if (response.type === "failure")
        task.reject(new Error(response.error || "CSV processing failed."));
      else task.resolve(response.result);
    };
    return connection;
  }

  async request<T>(task: WorkerTask): Promise<T> {
    const connection = this.connect();
    await connection.ready;
    if (this.connection !== connection)
      throw new Error("The CSV worker stopped. Please try again.");
    return new Promise<T>((resolve, reject) => {
      const id = ++this.sequence;
      const timer = setTimeout(
        () =>
          this.fail(
            connection,
            new Error(
              "CSV processing exceeded 60 seconds and was stopped. Try a smaller file or fewer files.",
            ),
          ),
        this.operationTimeout,
      );
      this.pending.set(id, {
        kind: task.kind,
        resolve: (value) => resolve(value as T),
        reject,
        timer,
      });
      try {
        connection.worker.postMessage({ ...task, id });
      } catch (error) {
        this.fail(
          connection,
          new Error(
            `Could not send data to the CSV worker. ${error instanceof Error ? error.message : "Please try again."}`,
          ),
        );
      }
    });
  }

  dispose(): void {
    this.disposed = true;
    if (this.connection)
      this.fail(this.connection, new Error("Processing cancelled."));
  }
}
