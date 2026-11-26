import { useMemo, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router";

import {
  FolioContext,
  type FolioContextValue,
  type FolioDialog,
} from "@/hooks/use-folio";
import {
  allFolders,
  ancestorsOf,
  buildTree,
  folderKey,
} from "@/lib/folio/paths";
import type { NotesList } from "@/lib/folio/types";

function parseNoteId(value: string | null): number | null {
  if (!value) return null;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function FolioProvider({
  userId,
  list,
  children,
}: {
  userId: number;
  list: NotesList;
  children: ReactNode;
}) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const selectedNoteId = parseNoteId(searchParams.get("note"));
  const selectedFolder = searchParams.get("folder") ?? "";

  const tree = useMemo(() => buildTree(list.notes), [list.notes]);
  const folders = useMemo(() => allFolders(tree), [tree]);
  const notesById = useMemo(
    () => new Map(list.notes.map((note) => [note.id, note])),
    [list.notes],
  );

  const activeFolder =
    selectedNoteId !== null
      ? (notesById.get(selectedNoteId)?.folder ?? "")
      : selectedFolder;

  const [expandedState, setExpandedState] = useState<Set<string>>(
    () => new Set(ancestorsOf(activeFolder).map(folderKey)),
  );
  const [trackedFolder, setTrackedFolder] = useState(activeFolder);
  if (trackedFolder !== activeFolder) {
    setTrackedFolder(activeFolder);
    const missing = ancestorsOf(activeFolder)
      .map(folderKey)
      .filter((folder) => !expandedState.has(folder));
    if (missing.length > 0) {
      setExpandedState(new Set([...expandedState, ...missing]));
    }
  }

  const [dialog, setDialog] = useState<FolioDialog | null>(null);

  const noteHref = (id: number) => `/folio?note=${id}`;
  const folderHref = (folder: string) =>
    folder ? `/folio?${new URLSearchParams({ folder }).toString()}` : "/folio";

  const value: FolioContextValue = {
    userId,
    list,
    tree,
    folders,
    notesById,
    selectedNoteId,
    selectedFolder,
    expanded: expandedState,
    dialog,
    noteHref,
    folderHref,
    openNote: (id) => {
      void navigate(noteHref(id));
    },
    openFolder: (folder) => {
      void navigate(folderHref(folder));
    },
    setExpanded: (folder, open) => {
      const key = folderKey(folder);
      setExpandedState((current) => {
        if (current.has(key) === open) return current;
        const next = new Set(current);
        if (open) next.add(key);
        else next.delete(key);
        return next;
      });
    },
    openDialog: setDialog,
    closeDialog: () => setDialog(null),
  };

  return <FolioContext value={value}>{children}</FolioContext>;
}
