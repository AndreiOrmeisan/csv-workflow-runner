import test from "node:test";
import assert from "node:assert/strict";
import { CsvWorkerClient } from "../src/lib/worker-client";
import type { WorkerRequest } from "../src/lib/worker-protocol";

class FakeWorker {
  onmessage: Worker["onmessage"] = null;
  onerror: Worker["onerror"] = null;
  onmessageerror: Worker["onmessageerror"] = null;
  terminated = false;
  sent: WorkerRequest[] = [];
  throwOnSend = false;
  postMessage(request: WorkerRequest) {
    if (this.throwOnSend) throw new Error("DataCloneError");
    this.sent.push(request);
  }
  terminate() {
    this.terminated = true;
  }
  emit(data: unknown) {
    this.onmessage?.call(
      this as unknown as Worker,
      { data } as MessageEvent<unknown>,
    );
  }
  crash() {
    this.onerror?.call(
      this as unknown as Worker,
      { message: "Failed to load worker" } as ErrorEvent,
    );
  }
  messageError() {
    this.onmessageerror?.call(this as unknown as Worker, {} as MessageEvent);
  }
  ready() {
    this.emit({ type: "ready", version: 1 });
  }
}
const parseTask = () => ({
  kind: "parse" as const,
  file: new File(["a,b\nx,y"], "data.csv"),
});
const result = {
  id: "file-1",
  name: "data.csv",
  columns: ["a", "b"],
  rows: [["x", "y"]],
  warnings: [],
};

test("waits for readiness and settles success and task failure", async () => {
  const worker = new FakeWorker();
  const client = new CsvWorkerClient(() => worker);
  const first = client.request(parseTask());
  assert.equal(worker.sent.length, 0);
  worker.ready();
  await Promise.resolve();
  worker.emit({ type: "success", id: worker.sent[0].id, result });
  assert.deepEqual(await first, result);
  const second = client.request(parseTask());
  await Promise.resolve();
  worker.emit({
    type: "failure",
    id: worker.sent[1].id,
    error: "Malformed CSV",
  });
  await assert.rejects(second, /Malformed CSV/);
  client.dispose();
});

test("missing readiness times out and terminates the worker", async () => {
  const worker = new FakeWorker();
  const client = new CsvWorkerClient(() => worker, 20, 1000);
  await assert.rejects(client.request(parseTask()), /did not start/);
  assert.equal(worker.terminated, true);
  client.dispose();
});

test("silent operations time out and reject every queued operation", async () => {
  const worker = new FakeWorker();
  const client = new CsvWorkerClient(() => worker, 1000, 20);
  const first = client.request(parseTask());
  const second = client.request(parseTask());
  const checks = Promise.all([
    assert.rejects(first, /exceeded/),
    assert.rejects(second, /exceeded/),
  ]);
  worker.ready();
  await checks;
  assert.equal(worker.terminated, true);
  client.dispose();
});

for (const mode of [
  "startup-error",
  "runtime-error",
  "message-error",
  "fatal",
  "invalid-message",
  "wrong-id",
  "wrong-version",
  "invalid-result",
] as const) {
  test(`${mode} rejects pending work instead of hanging`, async () => {
    const worker = new FakeWorker();
    const client = new CsvWorkerClient(() => worker, 1000, 1000);
    const operation = client.request(parseTask());
    const check = assert.rejects(operation);
    if (mode !== "startup-error" && mode !== "wrong-version") {
      worker.ready();
      await Promise.resolve();
    }
    switch (mode) {
      case "startup-error":
      case "runtime-error":
        worker.crash();
        break;
      case "message-error":
        worker.messageError();
        break;
      case "fatal":
        worker.emit({ type: "fatal", error: "Unhandled rejection" });
        break;
      case "invalid-message":
        worker.emit(null);
        break;
      case "wrong-id":
        worker.emit({ type: "failure", id: 999, error: "Failure" });
        break;
      case "wrong-version":
        worker.emit({ type: "ready", version: 2 });
        break;
      case "invalid-result":
        worker.emit({
          type: "success",
          id: worker.sent[0].id,
          result: "bad parse response",
        });
        break;
    }
    await check;
    assert.equal(worker.terminated, true);
    client.dispose();
  });
}

test("constructor and postMessage exceptions reject operations", async () => {
  const blocked = new CsvWorkerClient(() => {
    throw new Error("SecurityError");
  });
  await assert.rejects(blocked.request(parseTask()), /SecurityError/);
  const worker = new FakeWorker();
  worker.throwOnSend = true;
  const client = new CsvWorkerClient(() => worker);
  const operation = client.request(parseTask());
  worker.ready();
  await assert.rejects(operation, /Could not send/);
  assert.equal(worker.terminated, true);
  client.dispose();
});

test("a failed worker is replaced for the next upload", async () => {
  const first = new FakeWorker();
  const next = new FakeWorker();
  let attempts = 0;
  const client = new CsvWorkerClient(() => (attempts++ === 0 ? first : next));
  const failed = client.request(parseTask());
  first.crash();
  await assert.rejects(failed);
  const retry = client.request(parseTask());
  next.ready();
  await Promise.resolve();
  next.emit({ type: "success", id: next.sent[0].id, result });
  assert.deepEqual(await retry, result);
  assert.equal(attempts, 2);
  client.dispose();
});

test("disposing during startup or processing settles requests", async () => {
  for (const initialized of [false, true]) {
    const worker = new FakeWorker();
    const client = new CsvWorkerClient(() => worker);
    const operation = client.request(parseTask());
    if (initialized) {
      worker.ready();
      await Promise.resolve();
    }
    client.dispose();
    await assert.rejects(operation, /cancelled/);
    await assert.rejects(client.request(parseTask()), /cancelled/);
    assert.equal(worker.terminated, true);
  }
});
