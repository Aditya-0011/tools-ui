import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { CircleCheck, CircleX, FileText, Loader2 } from "lucide-react";

import { describeError } from "@/api/handler";
import { folioListKey, useCreateNote } from "@/api/folio";
import { useFolio } from "@/hooks/use-folio";
import { FetchError } from "@/lib/errors";
import {
  byteLength,
  canonicalFolder,
  hasDuplicateTitle,
  titleFromFileName,
  validateTitle,
} from "@/lib/folio/paths";
import { MAX_NOTE_BYTES, type NotesList } from "@/lib/folio/types";
import {
  dialogClass,
  outlineButtonClass,
  submitButtonClass,
} from "@/lib/styles";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Outcome =
  | { status: "pending" }
  | { status: "working" }
  | { status: "done" }
  | { status: "failed"; reason: string };

const MAX_RETRIES = 3;
const FALLBACK_WAIT_SECONDS = 15;

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function reasonFor(error: unknown): string {
  if (error instanceof FetchError) {
    if (error.status === 409) {
      return "A note with this title already exists in this folder";
    }
    if (error.status === 412) return error.message || "Note limit reached";
    if (error.status === 429) return "Too many requests, try again later";
  }
  return describeError(error);
}

export function ImportDialog({
  folder,
  files,
}: {
  folder: string;
  files: File[];
}) {
  const queryClient = useQueryClient();
  const { userId, tree, closeDialog } = useFolio();
  const create = useCreateNote(userId, { silent: true });
  const target = canonicalFolder(tree, folder);
  const [outcomes, setOutcomes] = useState<Outcome[]>(() =>
    files.map(() => ({ status: "pending" })),
  );
  const [phase, setPhase] = useState<"ready" | "running" | "finished">("ready");
  const [progress, setProgress] = useState("");
  const stop = useRef(false);

  const setOutcome = (index: number, outcome: Outcome) =>
    setOutcomes((current) =>
      current.map((entry, i) => (i === index ? outcome : entry)),
    );

  const run = async () => {
    setPhase("running");
    stop.current = false;
    let imported = 0;
    for (const [index, file] of files.entries()) {
      if (stop.current) break;
      setOutcome(index, { status: "working" });
      setProgress(`Importing ${index + 1} of ${files.length}…`);
      const title = titleFromFileName(file.name);
      const invalid = validateTitle(title);
      if (invalid) {
        setOutcome(index, { status: "failed", reason: invalid });
        continue;
      }
      if (file.size > MAX_NOTE_BYTES) {
        setOutcome(index, { status: "failed", reason: "Larger than 1 MB" });
        continue;
      }
      const notes =
        queryClient.getQueryData<NotesList>(folioListKey(userId))?.notes ?? [];
      if (hasDuplicateTitle(notes, target, title)) {
        setOutcome(index, {
          status: "failed",
          reason: "A note with this title already exists in this folder",
        });
        continue;
      }
      let content: string;
      try {
        content = (await file.text()).replace(/^\uFEFF/, "");
      } catch {
        setOutcome(index, { status: "failed", reason: "Couldn't read file" });
        continue;
      }
      if (byteLength(content) > MAX_NOTE_BYTES) {
        setOutcome(index, { status: "failed", reason: "Larger than 1 MB" });
        continue;
      }
      let attempt = 0;
      for (;;) {
        try {
          await create.mutateAsync({ folder: target, title, content });
          imported += 1;
          setOutcome(index, { status: "done" });
          break;
        } catch (error) {
          if (
            error instanceof FetchError &&
            error.status === 429 &&
            attempt < MAX_RETRIES &&
            !stop.current
          ) {
            attempt += 1;
            const wait = error.retryAfter ?? FALLBACK_WAIT_SECONDS;
            setProgress(
              `Rate limited. Waiting ${wait}\u00a0s before file ${index + 1} of ${files.length}…`,
            );
            await sleep(wait * 1000);
            setProgress(`Importing ${index + 1} of ${files.length}…`);
            continue;
          }
          if (error instanceof FetchError && error.status === 401) {
            stop.current = true;
          }
          setOutcome(index, { status: "failed", reason: reasonFor(error) });
          break;
        }
      }
    }
    setOutcomes((current) =>
      current.map((entry) =>
        entry.status === "pending"
          ? { status: "failed", reason: "Skipped" }
          : entry,
      ),
    );
    setPhase("finished");
    const failed = files.length - imported;
    setProgress(
      failed === 0
        ? `Imported ${imported} of ${files.length} files.`
        : `Imported ${imported} of ${files.length} files. ${failed} failed.`,
    );
    if (imported > 0) {
      toast.success(
        imported === 1 ? "Imported 1 note" : `Imported ${imported} notes`,
      );
    }
  };

  return (
    <Dialog
      open
      disablePointerDismissal
      onOpenChange={(open) => {
        if (!open && phase !== "running") closeDialog();
      }}
    >
      <DialogContent
        className={`${dialogClass} sm:max-w-lg`}
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>
            Import <span className="text-violet-400">markdown</span>
          </DialogTitle>
          <DialogDescription>
            {files.length === 1 ? "1 file" : `${files.length} files`} into{" "}
            <span className="font-medium text-white">
              {target || "the top level"}
            </span>
            . Each file becomes a note named after the file.
          </DialogDescription>
        </DialogHeader>
        <p
          aria-live="polite"
          className="text-muted-foreground min-h-5 text-sm tabular-nums"
        >
          {progress}
        </p>
        <ul className="-mx-2 flex max-h-72 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent flex-col gap-px overflow-y-auto overscroll-contain px-2">
          {files.map((file, index) => {
            const outcome = outcomes[index];
            return (
              <li
                key={`${file.name}-${index}`}
                className="flex items-start gap-2 rounded-md px-2 py-1.5 text-sm"
              >
                {outcome.status === "done" ? (
                  <CircleCheck
                    aria-label="Imported"
                    className="mt-0.5 size-4 shrink-0 text-emerald-400"
                  />
                ) : outcome.status === "failed" ? (
                  <CircleX
                    aria-label="Failed"
                    className="mt-0.5 size-4 shrink-0 text-red-400"
                  />
                ) : outcome.status === "working" ? (
                  <Loader2
                    aria-label="Importing"
                    className="mt-0.5 size-4 shrink-0 animate-spin text-violet-400"
                  />
                ) : (
                  <FileText
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-neutral-500"
                  />
                )}
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">
                    {titleFromFileName(file.name)}
                  </span>
                  {outcome.status === "failed" && (
                    <span className="text-xs text-red-400">
                      {outcome.reason}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
        <DialogFooter>
          {phase === "ready" && (
            <>
              <Button
                type="button"
                variant="outline"
                className={outlineButtonClass}
                onClick={closeDialog}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className={submitButtonClass}
                onClick={() => void run()}
              >
                {files.length === 1
                  ? "Import 1 File"
                  : `Import ${files.length} Files`}
              </Button>
            </>
          )}
          {phase === "running" && (
            <Button
              type="button"
              variant="outline"
              className={outlineButtonClass}
              onClick={() => {
                stop.current = true;
              }}
            >
              Stop After This File
            </Button>
          )}
          {phase === "finished" && (
            <Button
              type="button"
              className={submitButtonClass}
              onClick={closeDialog}
            >
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
