import { useForm } from "@tanstack/react-form";
import { toast } from "sonner";

import { useCreateNote, useRenameNote } from "@/api/folio";
import { useFolio } from "@/hooks/use-folio";
import { getEditorId } from "@/lib/folio/editor";
import {
  byteLength,
  canonicalFolder,
  hasDuplicateTitle,
  normalizeFolder,
  validateFolder,
  validateTitle,
} from "@/lib/folio/paths";
import { MAX_NOTE_BYTES, type NoteSummary } from "@/lib/folio/types";
import {
  dialogClass,
  inputClass,
  outlineButtonClass,
  submitButtonClass,
  textareaClass,
} from "@/lib/styles";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FolderInput } from "@/components/folio/FolderInput";

type NoteDialogProps =
  | { mode: "create"; folder: string; note?: undefined }
  | { mode: "rename"; note: NoteSummary; folder?: undefined };

const toErrors = (message: string | null | undefined) =>
  message ? [{ message }] : [];

export function NoteDialog(props: NoteDialogProps) {
  const { userId, list, tree, folders, closeDialog, openNote } = useFolio();
  const create = useCreateNote(userId);
  const rename = useRenameNote(userId);
  const isRename = props.mode === "rename";
  const pending = create.isPending || rename.isPending;

  const form = useForm({
    defaultValues: {
      folder: isRename ? props.note.folder : props.folder,
      title: isRename ? props.note.title : "",
      content: "",
    },
    onSubmit: async ({ value }) => {
      const folder = canonicalFolder(tree, normalizeFolder(value.folder));
      const title = value.title.trim();
      try {
        if (isRename) {
          const summary = await rename.mutateAsync({
            id: props.note.id,
            folder,
            title,
            editor_id: getEditorId(),
          });
          toast.success(`Saved “${summary.title}”`);
        } else {
          const summary = await create.mutateAsync({
            folder,
            title,
            content: value.content,
          });
          toast.success(`Created “${summary.title}”`);
          openNote(summary.id);
        }
        closeDialog();
      } catch {
        return;
      }
    },
  });

  const exceptId = isRename ? props.note.id : undefined;

  return (
    <Dialog
      open
      disablePointerDismissal
      onOpenChange={(open) => {
        if (!open && !pending) closeDialog();
      }}
    >
      <DialogContent
        className={`${dialogClass} sm:max-w-lg`}
        showCloseButton={false}
      >
        <form
          noValidate
          className="grid gap-6"
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {isRename ? (
                <>
                  Rename or move{" "}
                  <span className="wrap-anywhere text-violet-400">
                    {props.note.title}
                  </span>
                </>
              ) : (
                <>
                  New <span className="text-violet-400">note</span>
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {isRename
                ? "Change the title or pick another folder. The content stays the same."
                : "Folders are created automatically from the path you type."}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <form.Field
              name="folder"
              validators={{
                onSubmit: ({ value }) =>
                  validateFolder(normalizeFolder(value)) ?? undefined,
              }}
              children={(field) => {
                const error = field.state.meta.errors[0] as string | undefined;
                return (
                  <Field data-invalid={!!error}>
                    <FieldLabel htmlFor="note-folder">Folder</FieldLabel>
                    <FolderInput
                      id="note-folder"
                      name={field.name}
                      value={field.state.value}
                      folders={folders}
                      disabled={pending}
                      invalid={!!error}
                      onChange={field.handleChange}
                      onBlur={field.handleBlur}
                      describedBy="note-folder-hint"
                    />
                    <FieldDescription id="note-folder-hint">
                      Use / for subfolders. Leave empty for the top level.
                    </FieldDescription>
                    <FieldError errors={toErrors(error)} />
                  </Field>
                );
              }}
            />
            <form.Field
              name="title"
              validators={{
                onSubmit: ({ value, fieldApi }) => {
                  const title = value.trim();
                  const invalid = validateTitle(title);
                  if (invalid) return invalid;
                  const folder = normalizeFolder(
                    fieldApi.form.getFieldValue("folder"),
                  );
                  if (hasDuplicateTitle(list.notes, folder, title, exceptId)) {
                    return "A note with this title already exists in that folder";
                  }
                  return undefined;
                },
              }}
              children={(field) => {
                const error = field.state.meta.errors[0] as string | undefined;
                return (
                  <Field data-invalid={!!error}>
                    <FieldLabel htmlFor="note-title">Title</FieldLabel>
                    <Input
                      id="note-title"
                      name={field.name}
                      value={field.state.value}
                      autoComplete="off"
                      maxLength={120}
                      placeholder="Meeting notes…"
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      aria-invalid={!!error}
                      disabled={pending}
                      className={inputClass}
                    />
                    <FieldError errors={toErrors(error)} />
                  </Field>
                );
              }}
            />
            {!isRename && (
              <form.Field
                name="content"
                validators={{
                  onSubmit: ({ value }) =>
                    byteLength(value) > MAX_NOTE_BYTES
                      ? "Notes can be at most 1 MB"
                      : undefined,
                }}
                children={(field) => {
                  const error = field.state.meta.errors[0] as
                    string | undefined;
                  return (
                    <Field data-invalid={!!error}>
                      <FieldLabel htmlFor="note-content">
                        Content{" "}
                        <span className="text-muted-foreground font-normal">
                          (optional)
                        </span>
                      </FieldLabel>
                      <Textarea
                        id="note-content"
                        name={field.name}
                        value={field.state.value}
                        placeholder="# Start writing…"
                        spellCheck
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        aria-invalid={!!error}
                        disabled={pending}
                        className={`${textareaClass} max-h-60 min-h-28`}
                      />
                      <FieldError errors={toErrors(error)} />
                    </Field>
                  );
                }}
              />
            )}
          </FieldGroup>
          <DialogFooter>
            <DialogClose
              render={
                <Button
                  type="button"
                  variant="outline"
                  className={outlineButtonClass}
                  disabled={pending}
                />
              }
            >
              Cancel
            </DialogClose>
            <Button
              type="submit"
              disabled={pending}
              className={submitButtonClass}
            >
              {pending ? "Saving…" : isRename ? "Save" : "Create Note"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
