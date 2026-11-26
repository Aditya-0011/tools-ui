import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { apiFetch, describeError } from "@/api/handler";
import {
  cacheContent,
  fetchNote,
  upsertSummary,
  type LoadedNote,
} from "@/api/folio";
import { endSession } from "@/api/query-client";
import { recheckSession } from "@/lib/auth";
import { FetchError } from "@/lib/errors";
import { dropDraft, writeDraft } from "@/lib/folio/cache";
import { EDITOR_LABEL, getEditorId } from "@/lib/folio/editor";
import { setPresence } from "@/lib/folio/presence";
import {
  LockNoteResponseSchema,
  NoteSchema,
  NoteSummarySchema,
  type NoteLock,
  type NoteSummary,
} from "@/lib/folio/types";

const RENEW_INTERVAL_MS = 60_000;
const DRAFT_DEBOUNCE_MS = 400;

export type EditorMode =
  "view" | "acquiring" | "blocked" | "editing" | "conflict" | "lost";

export type SaveProblem = { kind: "quota" | "invalid"; message: string };

function handleAuth(error: unknown): boolean {
  if (!(error instanceof FetchError)) return false;
  if (error.status === 401) {
    endSession();
    return true;
  }
  if (error.status === 403) void recheckSession();
  return false;
}

function isVersionConflict(error: FetchError): boolean {
  return /version|changed|modified|newer|stale|outdated/i.test(error.message);
}

async function requestLock(id: number, takeOver: boolean) {
  const raw = await apiFetch<unknown>("tools", "/folio/lock", {
    method: "POST",
    body: {
      id,
      editor_id: getEditorId(),
      editor_label: EDITOR_LABEL,
      take_over: takeOver,
    },
  });
  return LockNoteResponseSchema.parse(raw ?? {});
}

function releaseLock(id: number, keepalive = false) {
  return apiFetch("tools", "/folio/release", {
    method: "POST",
    body: { id, editor_id: getEditorId() },
    keepalive,
  }).catch(() => undefined);
}

export function useNoteEditor({
  userId,
  note,
  loaded,
}: {
  userId: number;
  note: NoteSummary;
  loaded: LoadedNote | undefined;
}) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<EditorMode>("view");
  const [lock, setLock] = useState<NoteLock | undefined>(undefined);
  const [text, setText] = useState("");
  const [savedText, setSavedText] = useState("");
  const [baseVersion, setBaseVersion] = useState(0);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<SaveProblem | null>(null);

  const holding = mode === "editing" || mode === "conflict";
  const hasText = holding || mode === "lost";
  const dirty = hasText && text !== savedText;

  const latest = useRef({
    mode,
    text,
    savedText,
    baseVersion,
    saving,
    holding,
    loaded,
  });
  useEffect(() => {
    latest.current = {
      mode,
      text,
      savedText,
      baseVersion,
      saving,
      holding,
      loaded,
    };
  });

  const loseLock = useCallback(
    (nextLock?: NoteLock) => {
      setLock(nextLock);
      setMode("lost");
      if (nextLock) return;
      void apiFetch<unknown>("tools", "/folio/get", {
        method: "QUERY",
        body: { id: note.id },
      })
        .then((raw) => {
          const holder = NoteSchema.parse(raw).lock;
          if (holder && holder.editor_id !== getEditorId()) setLock(holder);
        })
        .catch(() => undefined);
    },
    [note.id],
  );

  const startEdit = useCallback(
    async ({
      takeOver = false,
      initialText,
    }: { takeOver?: boolean; initialText?: string } = {}) => {
      const current = latest.current;
      if (current.mode === "acquiring") return;
      const previous = current.mode;
      setMode("acquiring");
      setProblem(null);
      try {
        const result = await requestLock(note.id, takeOver);
        if (!result.acquired) {
          setLock(result.lock);
          setMode("blocked");
          return;
        }
        let base = latest.current.loaded;
        if (!base || (result.version && base.version !== result.version)) {
          base = await fetchNote(queryClient, userId, note.id);
        }
        setLock(result.lock);
        setSavedText(base.content);
        setBaseVersion(result.version || base.version);
        setText(
          initialText ?? (previous === "lost" ? current.text : base.content),
        );
        setMode("editing");
      } catch (error) {
        if (handleAuth(error)) return;
        toast.error(describeError(error));
        setMode(previous === "lost" ? "lost" : "view");
      }
    },
    [note.id, queryClient, userId],
  );

  const renew = useCallback(async () => {
    if (!latest.current.holding) return;
    try {
      const result = await requestLock(note.id, false);
      if (!latest.current.holding) return;
      if (!result.acquired) loseLock(result.lock);
    } catch (error) {
      if (handleAuth(error)) return;
      if (error instanceof FetchError && error.status === 409) loseLock();
    }
  }, [loseLock, note.id]);

  useEffect(() => {
    if (!holding) return;
    const timer = window.setInterval(() => void renew(), RENEW_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [holding, renew]);

  const save = useCallback(
    async ({ close = false }: { close?: boolean } = {}) => {
      const current = latest.current;
      if (current.mode !== "editing" || current.saving) return false;
      setSaving(true);
      setProblem(null);
      const content = current.text;
      try {
        const raw = await apiFetch<unknown>("tools", "/folio/save", {
          method: "POST",
          body: {
            id: note.id,
            editor_id: getEditorId(),
            version: current.baseVersion,
            content,
          },
        });
        const summary = NoteSummarySchema.parse(raw);
        upsertSummary(queryClient, userId, summary);
        cacheContent(queryClient, userId, {
          id: summary.id,
          version: summary.version,
          content,
        });
        void dropDraft(userId, note.id);
        setSavedText(content);
        setBaseVersion(summary.version);
        toast.success("Note saved", { id: "note-saved" });
        if (close) {
          void releaseLock(note.id);
          setMode("view");
        }
        return true;
      } catch (error) {
        if (handleAuth(error)) return false;
        if (error instanceof FetchError) {
          if (error.status === 409) {
            if (isVersionConflict(error)) setMode("conflict");
            else loseLock();
            return false;
          }
          if (error.status === 412) {
            setProblem({ kind: "quota", message: error.message });
            return false;
          }
          if (error.status === 400) {
            setProblem({ kind: "invalid", message: error.message });
            return false;
          }
          if (error.status === 413) {
            setProblem({
              kind: "invalid",
              message:
                "This note is too large to save. Notes can be up to 1 MB.",
            });
            return false;
          }
        }
        toast.error(describeError(error));
        return false;
      } finally {
        setSaving(false);
      }
    },
    [loseLock, note.id, queryClient, userId],
  );

  const stopEditing = useCallback(
    ({ discard }: { discard: boolean }) => {
      if (latest.current.holding) void releaseLock(note.id);
      if (discard) void dropDraft(userId, note.id);
      setProblem(null);
      setMode("view");
    },
    [note.id, userId],
  );

  const reloadLatest = useCallback(async () => {
    try {
      const fresh = await fetchNote(queryClient, userId, note.id);
      setSavedText(fresh.content);
      setText(fresh.content);
      setBaseVersion(fresh.version);
      setMode("editing");
    } catch (error) {
      if (handleAuth(error)) return;
      toast.error(describeError(error));
    }
  }, [note.id, queryClient, userId]);

  useEffect(() => {
    if (!dirty) {
      if (hasText) void dropDraft(userId, note.id);
      return;
    }
    const timer = window.setTimeout(() => {
      void writeDraft({
        userId,
        noteId: note.id,
        baseVersion,
        content: text,
        updatedAt: Date.now(),
      });
    }, DRAFT_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [baseVersion, dirty, hasText, note.id, text, userId]);

  useEffect(() => {
    setPresence(note.id, holding);
  }, [holding, note.id]);

  useEffect(
    () => () => {
      setPresence(null, false);
      if (latest.current.holding) void releaseLock(note.id);
    },
    [note.id],
  );

  useEffect(() => {
    const onPageHide = () => {
      if (latest.current.holding) void releaseLock(note.id, true);
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted && latest.current.holding) void renew();
    };
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [note.id, renew]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        event.key.toLowerCase() === "s"
      ) {
        event.preventDefault();
        if (latest.current.mode === "editing") void save();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [save]);

  return {
    mode,
    lock,
    text,
    setText,
    dirty,
    saving,
    problem,
    clearProblem: () => setProblem(null),
    startEdit,
    save,
    stopEditing,
    reloadLatest,
  };
}
