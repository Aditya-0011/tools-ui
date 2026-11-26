import { useFolio } from "@/hooks/use-folio";

import {
  DeleteFolderDialog,
  DeleteNoteDialog,
} from "@/components/folio/DeleteDialogs";
import { FolderDialog } from "@/components/folio/FolderDialog";
import { ImportDialog } from "@/components/folio/ImportDialog";
import { NoteDialog } from "@/components/folio/NoteDialog";

export function DialogHost() {
  const { dialog } = useFolio();
  if (!dialog) return null;
  switch (dialog.type) {
    case "create":
      return <NoteDialog mode="create" folder={dialog.folder} />;
    case "rename":
      return (
        <NoteDialog key={dialog.note.id} mode="rename" note={dialog.note} />
      );
    case "delete-note":
      return <DeleteNoteDialog note={dialog.note} />;
    case "move-folder":
      return <FolderDialog folder={dialog.folder} />;
    case "delete-folder":
      return <DeleteFolderDialog folder={dialog.folder} />;
    case "import":
      return <ImportDialog folder={dialog.folder} files={dialog.files} />;
  }
}
