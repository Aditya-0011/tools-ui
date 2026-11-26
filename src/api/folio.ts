import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";

import { apiFetch, type RequestMeta } from "@/api/handler";
import { FetchError } from "@/lib/errors";
import {
  dropCachedBody,
  dropDraft,
  readCachedBody,
  writeCachedBody,
} from "@/lib/folio/cache";
import { isWithin, rebaseFolder } from "@/lib/folio/paths";
import {
  ListNotesResponseSchema,
  NoteSchema,
  NoteSummarySchema,
  type CreateNoteRequest,
  type DeleteFolderRequest,
  type DeleteNoteRequest,
  type MoveFolderRequest,
  type NoteLock,
  type NoteSummary,
  type NotesList,
  type RenameNoteRequest,
  type SimpleResponse,
} from "@/lib/folio/types";

export const folioListKey = (userId: number) => ["folio", "list", userId];

export const noteContentKey = (
  userId: number,
  noteId: number,
  version: number,
) => ["folio", "content", userId, noteId, version];

const EMPTY_LIST: NotesList = {
  notes: [],
  quota: { max_notes: 0, max_bytes: 0, used_notes: 0, used_bytes: 0 },
};

async function fetchList(signal: AbortSignal): Promise<NotesList> {
  try {
    const raw = await apiFetch<unknown>("tools", "/folio/list", { signal });
    return ListNotesResponseSchema.parse(raw ?? {});
  } catch (error) {
    if (error instanceof FetchError && error.status === 404) return EMPTY_LIST;
    throw error;
  }
}

export function useNotesList(userId: number) {
  return useQuery<NotesList, FetchError>({
    queryKey: folioListKey(userId),
    queryFn: ({ signal }) => fetchList(signal),
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export type LoadedNote = {
  id: number;
  version: number;
  content: string;
  lock?: NoteLock;
};

export function updateList(
  queryClient: QueryClient,
  userId: number,
  update: (list: NotesList) => NotesList,
) {
  queryClient.setQueryData<NotesList>(folioListKey(userId), (list) =>
    list ? update(list) : list,
  );
}

export function upsertSummary(
  queryClient: QueryClient,
  userId: number,
  summary: NoteSummary,
) {
  updateList(queryClient, userId, (list) => {
    const existing = list.notes.find((note) => note.id === summary.id);
    const notes = existing
      ? list.notes.map((note) => (note.id === summary.id ? summary : note))
      : [...list.notes, summary];
    return {
      notes,
      quota: {
        ...list.quota,
        used_notes: list.quota.used_notes + (existing ? 0 : 1),
        used_bytes: Math.max(
          0,
          list.quota.used_bytes + summary.size - (existing?.size ?? 0),
        ),
      },
    };
  });
}

function removeWhere(
  queryClient: QueryClient,
  userId: number,
  predicate: (note: NoteSummary) => boolean,
): NoteSummary[] {
  const removed: NoteSummary[] = [];
  updateList(queryClient, userId, (list) => {
    const notes = list.notes.filter((note) => {
      if (!predicate(note)) return true;
      removed.push(note);
      return false;
    });
    const bytes = removed.reduce((sum, note) => sum + note.size, 0);
    return {
      notes,
      quota: {
        ...list.quota,
        used_notes: Math.max(0, list.quota.used_notes - removed.length),
        used_bytes: Math.max(0, list.quota.used_bytes - bytes),
      },
    };
  });
  return removed;
}

export function cacheContent(
  queryClient: QueryClient,
  userId: number,
  note: LoadedNote,
) {
  queryClient.setQueryData<LoadedNote>(
    noteContentKey(userId, note.id, note.version),
    note,
  );
  void writeCachedBody(userId, note.id, note.version, note.content);
}

export async function fetchNote(
  queryClient: QueryClient,
  userId: number,
  noteId: number,
  signal?: AbortSignal,
): Promise<LoadedNote> {
  const raw = await apiFetch<unknown>("tools", "/folio/get", {
    method: "QUERY",
    body: { id: noteId },
    signal,
  });
  const note = NoteSchema.parse(raw);
  const loaded: LoadedNote = {
    id: noteId,
    version: note.summary.version,
    content: note.content,
    lock: note.lock,
  };
  cacheContent(queryClient, userId, loaded);
  const listed = queryClient
    .getQueryData<NotesList>(folioListKey(userId))
    ?.notes.find((entry) => entry.id === noteId);
  if (listed && listed.version !== note.summary.version) {
    upsertSummary(queryClient, userId, { ...note.summary, id: noteId });
  }
  return loaded;
}

function contentOptions(userId: number, note: NoteSummary) {
  return {
    queryKey: noteContentKey(userId, note.id, note.version),
    queryFn: async ({
      signal,
      client,
    }: {
      signal: AbortSignal;
      client: QueryClient;
    }) => {
      const cached = await readCachedBody(userId, note.id, note.version);
      if (cached !== undefined) {
        return { id: note.id, version: note.version, content: cached };
      }
      return fetchNote(client, userId, note.id, signal);
    },
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  };
}

export function useNoteContent(userId: number, note: NoteSummary | undefined) {
  const placeholder: NoteSummary = note ?? {
    id: 0,
    folder: "",
    title: "",
    size: 0,
    version: 0,
  };
  return useQuery<LoadedNote, FetchError>({
    ...contentOptions(userId, placeholder),
    enabled: note !== undefined,
  });
}

export function loadContent(
  queryClient: QueryClient,
  userId: number,
  note: NoteSummary,
): Promise<LoadedNote> {
  return queryClient.fetchQuery(contentOptions(userId, note));
}

const SILENT: RequestMeta = { silent: true };

export function useCreateNote(userId: number, options?: { silent?: boolean }) {
  const queryClient = useQueryClient();
  return useMutation<NoteSummary, FetchError, CreateNoteRequest>({
    mutationFn: async (request) => {
      const raw = await apiFetch<unknown>("tools", "/folio/add", {
        method: "POST",
        body: request,
      });
      return NoteSummarySchema.parse(raw);
    },
    onSuccess: (summary, request) => {
      upsertSummary(queryClient, userId, summary);
      cacheContent(queryClient, userId, {
        id: summary.id,
        version: summary.version,
        content: request.content,
      });
    },
    meta: options?.silent ? SILENT : undefined,
  });
}

export function useRenameNote(userId: number) {
  const queryClient = useQueryClient();
  return useMutation<NoteSummary, FetchError, RenameNoteRequest>({
    mutationFn: async (request) => {
      const raw = await apiFetch<unknown>("tools", "/folio/rename", {
        method: "POST",
        body: request,
      });
      return NoteSummarySchema.parse(raw);
    },
    onSuccess: (summary) => upsertSummary(queryClient, userId, summary),
  });
}

export function useDeleteNote(userId: number) {
  const queryClient = useQueryClient();
  return useMutation<SimpleResponse, FetchError, DeleteNoteRequest>({
    mutationFn: (request) =>
      apiFetch<SimpleResponse>("tools", "/folio/delete", {
        method: "POST",
        body: request,
      }),
    onSuccess: (_data, { id }) => {
      removeWhere(queryClient, userId, (note) => note.id === id);
      void dropCachedBody(userId, id);
      void dropDraft(userId, id);
    },
  });
}

export function useMoveFolder(userId: number) {
  const queryClient = useQueryClient();
  return useMutation<SimpleResponse, FetchError, MoveFolderRequest>({
    mutationFn: (request) =>
      apiFetch<SimpleResponse>("tools", "/folio/folder/move", {
        method: "POST",
        body: request,
      }),
    onSuccess: (_data, { from_folder, to_folder }) => {
      updateList(queryClient, userId, (list) => ({
        ...list,
        notes: list.notes.map((note) =>
          isWithin(note.folder, from_folder)
            ? {
                ...note,
                folder: rebaseFolder(note.folder, from_folder, to_folder),
              }
            : note,
        ),
      }));
    },
  });
}

export function useDeleteFolder(userId: number) {
  const queryClient = useQueryClient();
  return useMutation<SimpleResponse, FetchError, DeleteFolderRequest>({
    mutationFn: (request) =>
      apiFetch<SimpleResponse>("tools", "/folio/folder/delete", {
        method: "POST",
        body: request,
      }),
    onSuccess: (_data, { folder }) => {
      const removed = removeWhere(queryClient, userId, (note) =>
        isWithin(note.folder, folder),
      );
      for (const note of removed) {
        void dropCachedBody(userId, note.id);
        void dropDraft(userId, note.id);
      }
    },
  });
}
