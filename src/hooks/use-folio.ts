import { createContext, use } from "react";

import type { FolderNode } from "@/lib/folio/paths";
import type { NoteSummary, NotesList } from "@/lib/folio/types";

export type FolioDialog =
  | { type: "create"; folder: string }
  | { type: "rename"; note: NoteSummary }
  | { type: "delete-note"; note: NoteSummary }
  | { type: "move-folder"; folder: string }
  | { type: "delete-folder"; folder: string }
  | { type: "import"; folder: string; files: File[] };

export type FolioContextValue = {
  userId: number;
  list: NotesList;
  tree: FolderNode;
  folders: string[];
  notesById: Map<number, NoteSummary>;
  selectedNoteId: number | null;
  selectedFolder: string;
  expanded: ReadonlySet<string>;
  dialog: FolioDialog | null;
  noteHref: (id: number) => string;
  folderHref: (folder: string) => string;
  openNote: (id: number) => void;
  openFolder: (folder: string) => void;
  setExpanded: (folder: string, open: boolean) => void;
  openDialog: (dialog: FolioDialog) => void;
  closeDialog: () => void;
};

export const FolioContext = createContext<FolioContextValue | null>(null);

export function useFolio(): FolioContextValue {
  const value = use(FolioContext);
  if (!value) throw new Error("useFolio must be used inside FolioProvider");
  return value;
}

export function useCurrentFolder(): string {
  const { selectedNoteId, selectedFolder, notesById } = useFolio();
  if (selectedNoteId !== null) {
    return notesById.get(selectedNoteId)?.folder ?? "";
  }
  return selectedFolder;
}
