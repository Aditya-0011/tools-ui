import { createRunner, type RunResult } from "@/lib/stencil/run";
import type { ParseOptions } from "@/lib/stencil/parse";

export type WorkerRequest = ParseOptions & {
  id: number;
  data?: string;
  pattern: string;
};

export type WorkerResponse =
  { id: number; result: RunResult } | { id: number; failure: string };

const run = createRunner();
let data = "";

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  if (request.data !== undefined) data = request.data;
  let response: WorkerResponse;
  try {
    response = {
      id: request.id,
      result: run({
        data,
        pattern: request.pattern,
        delimiter: request.delimiter,
        hasHeader: request.hasHeader,
        trim: request.trim,
      }),
    };
  } catch (error) {
    response = {
      id: request.id,
      failure: error instanceof Error ? error.message : "Rendering failed",
    };
  }
  self.postMessage(response);
};
