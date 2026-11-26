import { readStorage, writeStorage } from "@/lib/storage";
import { describeUserAgent } from "@/lib/user-agent";
import { uuidv7 } from "@/lib/uuid";

const EDITOR_KEY = "tools-editor-id";
const UUID_V7 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function createId(): string {
  const id = uuidv7();
  writeStorage("sessionStorage", EDITOR_KEY, id);
  return id;
}

let editorId = (() => {
  const stored = readStorage("sessionStorage", EDITOR_KEY);
  return stored && UUID_V7.test(stored) ? stored : createId();
})();

export function getEditorId(): string {
  return editorId;
}

export function regenerateEditorId(): string {
  editorId = createId();
  return editorId;
}

export const EDITOR_LABEL = describeUserAgent(navigator.userAgent).slice(0, 60);
