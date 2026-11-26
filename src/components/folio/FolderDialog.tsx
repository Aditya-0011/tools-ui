import { useForm } from "@tanstack/react-form";
import { toast } from "sonner";

import { useMoveFolder } from "@/api/folio";
import { useFolio } from "@/hooks/use-folio";
import {
  canonicalFolder,
  isWithin,
  normalizeFolder,
  sameFolder,
  validateFolder,
} from "@/lib/folio/paths";
import {
  dialogClass,
  outlineButtonClass,
  submitButtonClass,
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
import { Button } from "@/components/ui/button";
import { FolderInput } from "@/components/folio/FolderInput";

export function FolderDialog({ folder }: { folder: string }) {
  const { userId, tree, folders, closeDialog, openFolder, selectedNoteId } =
    useFolio();
  const move = useMoveFolder(userId);

  const form = useForm({
    defaultValues: { to: folder },
    onSubmit: async ({ value }) => {
      const to = canonicalFolder(tree, normalizeFolder(value.to));
      try {
        await move.mutateAsync({ from_folder: folder, to_folder: to });
        toast.success(to ? `Moved to “${to}”` : "Moved to the top level");
        closeDialog();
        if (selectedNoteId === null) openFolder(to);
      } catch {
        return;
      }
    },
  });

  const choices = folders.filter((path) => !isWithin(path, folder));

  return (
    <Dialog
      open
      disablePointerDismissal
      onOpenChange={(open) => {
        if (!open && !move.isPending) closeDialog();
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
              Rename or move{" "}
              <span className="wrap-anywhere text-violet-400">{folder}</span>
            </DialogTitle>
            <DialogDescription>
              Every note and subfolder inside moves with it.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <form.Field
              name="to"
              validators={{
                onSubmit: ({ value }) => {
                  const to = normalizeFolder(value);
                  const invalid = validateFolder(to);
                  if (invalid) return invalid;
                  if (to === folder) return "Pick a different name or location";
                  if (
                    to !== "" &&
                    !sameFolder(to, folder) &&
                    isWithin(to, folder)
                  ) {
                    return "A folder can't move inside itself";
                  }
                  return undefined;
                },
              }}
              children={(field) => {
                const error = field.state.meta.errors[0] as string | undefined;
                return (
                  <Field data-invalid={!!error}>
                    <FieldLabel htmlFor="folder-path">New path</FieldLabel>
                    <FolderInput
                      id="folder-path"
                      name={field.name}
                      value={field.state.value}
                      folders={choices}
                      disabled={move.isPending}
                      invalid={!!error}
                      onChange={field.handleChange}
                      onBlur={field.handleBlur}
                      describedBy="folder-path-hint"
                    />
                    <FieldDescription id="folder-path-hint">
                      The full path, e.g. Archive/2026. Leave empty to move the
                      contents to the top level.
                    </FieldDescription>
                    <FieldError errors={error ? [{ message: error }] : []} />
                  </Field>
                );
              }}
            />
          </FieldGroup>
          <DialogFooter>
            <DialogClose
              render={
                <Button
                  type="button"
                  variant="outline"
                  className={outlineButtonClass}
                  disabled={move.isPending}
                />
              }
            >
              Cancel
            </DialogClose>
            <Button
              type="submit"
              disabled={move.isPending}
              className={submitButtonClass}
            >
              {move.isPending ? "Moving…" : "Move Folder"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
