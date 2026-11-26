import { useEffect, useRef, useState } from "react";

import { createRunner, type RunInput, type RunResult } from "@/lib/stencil/run";
import type { WorkerRequest, WorkerResponse } from "@/lib/stencil/worker";

export const RENDER_DELAY = 150;

type Settled = {
  input: RunInput;
  result: RunResult | null;
  failure: string | null;
};

function sameInput(a: RunInput, b: RunInput): boolean {
  return (
    a.data === b.data &&
    a.pattern === b.pattern &&
    a.delimiter === b.delimiter &&
    a.hasHeader === b.hasHeader &&
    a.trim === b.trim
  );
}

type Runner = ReturnType<typeof createRunner>;

function runHere(holder: { current: Runner | null }, input: RunInput): Settled {
  holder.current ??= createRunner();
  try {
    return { input, result: holder.current(input), failure: null };
  } catch (error) {
    return {
      input,
      result: null,
      failure: error instanceof Error ? error.message : "Rendering failed",
    };
  }
}

function createWorker(): Worker | null {
  try {
    return new Worker(new URL("../lib/stencil/worker.ts", import.meta.url), {
      type: "module",
      name: "stencil",
    });
  } catch {
    return null;
  }
}

export function useStencilOutput(input: RunInput | null) {
  const [settled, setSettled] = useState<Settled | null>(null);
  const worker = useRef<Worker | null>(null);
  const fallback = useRef<Runner | null>(null);
  const sentData = useRef<string | null>(null);
  const inputs = useRef(new Map<number, RunInput>());
  const sequence = useRef(0);

  useEffect(() => {
    const instance = createWorker();
    worker.current = instance;
    sentData.current = null;
    if (!instance) return;
    const pending = inputs.current;
    instance.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const response = event.data;
      const sent = pending.get(response.id);
      if (!sent || response.id !== sequence.current) return;
      pending.clear();
      setSettled({
        input: sent,
        result: "result" in response ? response.result : null,
        failure: "failure" in response ? response.failure : null,
      });
    };
    instance.onerror = () => {
      instance.terminate();
      if (worker.current === instance) worker.current = null;
      const sent = pending.get(sequence.current);
      pending.clear();
      if (sent) setSettled(runHere(fallback, sent));
    };
    return () => {
      instance.terminate();
      if (worker.current === instance) worker.current = null;
    };
  }, []);

  useEffect(() => {
    if (!input) return;
    const timer = window.setTimeout(() => {
      const id = ++sequence.current;
      const current = worker.current;
      if (current) {
        inputs.current.set(id, input);
        const request: WorkerRequest = {
          id,
          pattern: input.pattern,
          delimiter: input.delimiter,
          hasHeader: input.hasHeader,
          trim: input.trim,
        };
        if (sentData.current !== input.data) {
          request.data = input.data;
          sentData.current = input.data;
        }
        current.postMessage(request);
        return;
      }
      setSettled(runHere(fallback, input));
    }, RENDER_DELAY);
    return () => window.clearTimeout(timer);
  }, [input]);

  const fresh =
    input !== null && settled !== null && sameInput(settled.input, input);
  return {
    result: settled?.result ?? null,
    failure: settled?.failure ?? null,
    pending: input !== null && !fresh,
    fresh,
  };
}
