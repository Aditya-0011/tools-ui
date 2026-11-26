import { uuidv7 } from "@/lib/uuid";
import { getEditorId, regenerateEditorId } from "@/lib/folio/editor";

type PeerState = { noteId: number | null; editing: boolean };

type Message =
  | { type: "hello"; tab: string; editor: string }
  | { type: "state"; tab: string; editor: string; state: PeerState }
  | { type: "bye"; tab: string };

const TAB_ID = uuidv7();
const channel =
  typeof BroadcastChannel === "undefined"
    ? null
    : new BroadcastChannel("tools-folio");

let self: PeerState = { noteId: null, editing: false };
let peers = new Map<string, PeerState>();
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function post(message: Message) {
  try {
    channel?.postMessage(message);
  } catch {
    return;
  }
}

function announce() {
  post({ type: "state", tab: TAB_ID, editor: getEditorId(), state: self });
}

function setPeer(tab: string, state: PeerState | null) {
  const next = new Map(peers);
  if (state) next.set(tab, state);
  else next.delete(tab);
  peers = next;
  emit();
}

if (channel) {
  channel.onmessage = (event: MessageEvent<Message>) => {
    const message = event.data;
    if (!message || message.tab === TAB_ID) return;
    if (message.type === "bye") {
      setPeer(message.tab, null);
      return;
    }
    if (message.editor === getEditorId()) regenerateEditorId();
    if (message.type === "hello") {
      announce();
      return;
    }
    setPeer(message.tab, message.state);
  };
  post({ type: "hello", tab: TAB_ID, editor: getEditorId() });
  window.addEventListener("pagehide", () => post({ type: "bye", tab: TAB_ID }));
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      post({ type: "hello", tab: TAB_ID, editor: getEditorId() });
      announce();
    }
  });
}

export function setPresence(noteId: number | null, editing: boolean) {
  if (self.noteId === noteId && self.editing === editing) return;
  self = { noteId, editing };
  announce();
}

export const presenceStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot: () => peers,
};

export type NotePresence = "none" | "open" | "editing";

export function presenceFor(
  map: Map<string, PeerState>,
  noteId: number,
): NotePresence {
  let result: NotePresence = "none";
  for (const state of map.values()) {
    if (state.noteId !== noteId) continue;
    if (state.editing) return "editing";
    result = "open";
  }
  return result;
}
