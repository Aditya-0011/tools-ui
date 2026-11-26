import { authStore } from "@/lib/auth";
import { idbClearAll, idbDelete, idbGet, idbKeys, idbSet } from "@/lib/idb";
import { readStorage, writeStorage } from "@/lib/storage";
import type { NoteSummary } from "@/lib/folio/types";

const OWNER_KEY = "tools-cache-owner";

type CachedBody = {
  userId: number;
  noteId: number;
  version: number;
  content: string;
  cachedAt: number;
};

export type Draft = {
  userId: number;
  noteId: number;
  baseVersion: number;
  content: string;
  updatedAt: number;
};

const keyOf = (userId: number, noteId: number) => `${userId}:${noteId}`;

function parseKey(key: string): { userId: number; noteId: number } | null {
  const [user, note] = key.split(":");
  const userId = Number(user);
  const noteId = Number(note);
  if (!Number.isInteger(userId) || !Number.isInteger(noteId)) return null;
  return { userId, noteId };
}

export async function readCachedBody(
  userId: number,
  noteId: number,
  version: number,
): Promise<string | undefined> {
  const entry = await idbGet<CachedBody>("folio-notes", keyOf(userId, noteId));
  if (!entry) return undefined;
  if (entry.userId !== userId || entry.version !== version) {
    if (entry.version < version) {
      await idbDelete("folio-notes", keyOf(userId, noteId));
    }
    return undefined;
  }
  return entry.content;
}

export function writeCachedBody(
  userId: number,
  noteId: number,
  version: number,
  content: string,
): Promise<void> {
  const entry: CachedBody = {
    userId,
    noteId,
    version,
    content,
    cachedAt: Date.now(),
  };
  return idbSet("folio-notes", keyOf(userId, noteId), entry);
}

export function dropCachedBody(userId: number, noteId: number) {
  return idbDelete("folio-notes", keyOf(userId, noteId));
}

export async function readDraft(
  userId: number,
  noteId: number,
): Promise<Draft | undefined> {
  const draft = await idbGet<Draft>("folio-drafts", keyOf(userId, noteId));
  return draft && draft.userId === userId ? draft : undefined;
}

export function writeDraft(draft: Draft): Promise<void> {
  return idbSet("folio-drafts", keyOf(draft.userId, draft.noteId), draft);
}

export function dropDraft(userId: number, noteId: number) {
  return idbDelete("folio-drafts", keyOf(userId, noteId));
}

export async function pruneCache(userId: number, notes: NoteSummary[]) {
  const versions = new Map(notes.map((note) => [note.id, note.version]));
  const [bodies, drafts] = await Promise.all([
    idbKeys("folio-notes"),
    idbKeys("folio-drafts"),
  ]);
  const stale = async (key: string, checkVersion: boolean) => {
    const parsed = parseKey(key);
    if (!parsed || parsed.userId !== userId) return true;
    const version = versions.get(parsed.noteId);
    if (version === undefined) return true;
    if (!checkVersion) return false;
    const entry = await idbGet<CachedBody>("folio-notes", key);
    return !entry || entry.version < version;
  };
  for (const key of bodies) {
    if (await stale(key, true)) await idbDelete("folio-notes", key);
  }
  for (const key of drafts) {
    if (await stale(key, false)) await idbDelete("folio-drafts", key);
  }
}

let registered = false;

export function registerCacheCleanup() {
  if (registered) return;
  registered = true;
  const check = () => {
    const { identity, isAuthenticated, isVerifying } = authStore.getSnapshot();
    const owner = readStorage("localStorage", OWNER_KEY) ?? "";
    if (identity) {
      const current = String(identity.user_id);
      if (owner !== current) {
        if (owner) void idbClearAll();
        writeStorage("localStorage", OWNER_KEY, current);
      }
      return;
    }
    if (!isAuthenticated && !isVerifying && owner) {
      writeStorage("localStorage", OWNER_KEY, "");
      void idbClearAll();
    }
  };
  authStore.subscribe(check);
  check();
}
