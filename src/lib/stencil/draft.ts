import { z } from "zod";

import { authStore } from "@/lib/auth";

const PREFIX = "stencil:draft:";

const DraftSchema = z.object({
  pattern: z.string().catch(""),
  delimiter: z.string().catch(","),
  custom: z.boolean().catch(false),
  hasHeader: z.boolean().catch(false),
  trim: z.boolean().catch(false),
  loadedId: z.number().nullable().catch(null),
  title: z.string().catch(""),
});
export type Draft = z.infer<typeof DraftSchema>;

export const EMPTY_DRAFT: Draft = {
  pattern: "",
  delimiter: ",",
  custom: false,
  hasHeader: false,
  trim: false,
  loadedId: null,
  title: "",
};

function session(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function readDraft(userId: number): Draft {
  try {
    const raw = session()?.getItem(PREFIX + userId);
    if (!raw) return EMPTY_DRAFT;
    const parsed = DraftSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : EMPTY_DRAFT;
  } catch {
    return EMPTY_DRAFT;
  }
}

export function writeDraft(userId: number, draft: Draft) {
  try {
    session()?.setItem(PREFIX + userId, JSON.stringify(draft));
  } catch {
    return;
  }
}

function clearDrafts(keep: string | null) {
  const store = session();
  if (!store) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (key?.startsWith(PREFIX) && key !== keep) keys.push(key);
    }
    for (const key of keys) store.removeItem(key);
  } catch {
    return;
  }
}

let registered = false;

export function registerDraftCleanup() {
  if (registered) return;
  registered = true;
  const check = () => {
    const { identity, isAuthenticated, isVerifying } = authStore.getSnapshot();
    if (identity) {
      clearDrafts(PREFIX + identity.user_id);
      return;
    }
    if (!isAuthenticated && !isVerifying) clearDrafts(null);
  };
  authStore.subscribe(check);
  check();
}
