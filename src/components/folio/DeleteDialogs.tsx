import type { ReactNode } from "react";
import { toast } from "sonner";

import { useDeleteFolder, useDeleteNote } from "@/api/folio";
import { useFolio } from "@/hooks/use-folio";
import { getEditorId } from "@/lib/folio/editor";
import {
  findFolder,
  formatCount,
  isWithin,
  parentFolder,
} from "@/lib/folio/paths";
import type { NoteSummary } from "@/lib/folio/types";
import { destructiveButtonClass, destructiveDialogClass } from "@/lib/styles";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function ConfirmDelete({
  name,
  description,
  pending,
  onConfirm,
  onClose,
}: {
  name: string;
  description: ReactNode;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <AlertDialogContent className={destructiveDialogClass}>
        <AlertDialogHeader>
          <AlertDialogTitle>
            How <span className="font-medium text-emerald-500/50">high</span>{" "}
            are you?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {description}{" "}
            <span
              className="line-clamp-3 font-medium wrap-anywhere text-red-500"
              title={name}
            >
              {name}
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-md" disabled={pending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            className={destructiveButtonClass}
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function DeleteNoteDialog({ note }: { note: NoteSummary }) {
  const { userId, closeDialog, openFolder, selectedNoteId } = useFolio();
  const remove = useDeleteNote(userId);
  return (
    <ConfirmDelete
      name={note.title}
      description="This can't be undone. This permanently deletes the note"
      pending={remove.isPending}
      onClose={closeDialog}
      onConfirm={() => {
        remove.mutate(
          { id: note.id, editor_id: getEditorId() },
          {
            onSuccess: () => {
              toast.success(`Deleted “${note.title}”`);
              closeDialog();
              if (selectedNoteId === note.id) openFolder(note.folder);
            },
          },
        );
      }}
    />
  );
}

export function DeleteFolderDialog({ folder }: { folder: string }) {
  const { userId, tree, closeDialog, openFolder, selectedNoteId, notesById } =
    useFolio();
  const remove = useDeleteFolder(userId);
  const count = findFolder(tree, folder)?.count ?? 0;
  const label = count === 1 ? "1 note" : `${formatCount(count)} notes`;
  return (
    <ConfirmDelete
      name={folder}
      description={`This can't be undone. This permanently deletes ${label} in the folder`}
      pending={remove.isPending}
      onClose={closeDialog}
      onConfirm={() => {
        remove.mutate(
          { folder },
          {
            onSuccess: () => {
              toast.success(`Deleted ${label}`);
              closeDialog();
              const selected =
                selectedNoteId !== null ? notesById.get(selectedNoteId) : null;
              if (
                selectedNoteId === null ||
                (selected && isWithin(selected.folder, folder))
              ) {
                openFolder(parentFolder(folder));
              }
            },
          },
        );
      }}
    />
  );
}
