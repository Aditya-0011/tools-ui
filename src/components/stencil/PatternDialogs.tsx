import { useForm } from "@tanstack/react-form";
import { toast } from "sonner";

import { useDeletePattern, useSavePattern } from "@/api/stencil";
import { saveErrorMessage, validateTitle } from "@/lib/stencil/save";
import { MAX_TITLE_LENGTH, type SavedPattern } from "@/lib/stencil/types";
import {
  destructiveButtonClass,
  destructiveDialogClass,
  dialogClass,
  inputClass,
  outlineButtonClass,
  submitButtonClass,
} from "@/lib/styles";

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
import { Button } from "@/components/ui/button";
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
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const toErrors = (message: string | null | undefined) =>
  message ? [{ message }] : [];

export function RenamePatternDialog({
  userId,
  pattern,
  patterns,
  onRenamed,
  onClose,
}: {
  userId: number;
  pattern: SavedPattern;
  patterns: SavedPattern[];
  onRenamed: (saved: SavedPattern, previousTitle: string) => void;
  onClose: () => void;
}) {
  const save = useSavePattern(userId);
  const pending = save.isPending;

  const form = useForm({
    defaultValues: { title: pattern.title },
    onSubmit: async ({ value, formApi }) => {
      const title = value.title.trim();
      try {
        const saved = await save.mutateAsync({
          id: pattern.id,
          title,
          pattern: pattern.pattern,
          delimiter: pattern.delimiter || ",",
          has_header: pattern.has_header,
          trim: pattern.trim,
        });
        toast.success(`Renamed to “${saved.title}”`);
        onRenamed(saved, pattern.title);
        onClose();
      } catch (error) {
        const message = saveErrorMessage(error, title);
        formApi.setFieldMeta("title", (meta) => ({
          ...meta,
          errorMap: {
            ...meta.errorMap,
            onSubmit: message.title ?? message.form,
          },
        }));
      }
    },
  });

  return (
    <Dialog
      open
      disablePointerDismissal
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent
        className={`${dialogClass} sm:max-w-md`}
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
              Rename{" "}
              <span className="wrap-anywhere text-violet-400">
                {pattern.title}
              </span>
            </DialogTitle>
            <DialogDescription>
              Only the title changes. The pattern and its settings stay the
              same.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <form.Field
              name="title"
              validators={{
                onSubmit: ({ value }) =>
                  validateTitle(value, patterns, pattern.id) ?? undefined,
              }}
              children={(field) => {
                const error = field.state.meta.errors[0] as string | undefined;
                return (
                  <Field data-invalid={!!error}>
                    <FieldLabel htmlFor="pattern-title">Title</FieldLabel>
                    <Input
                      id="pattern-title"
                      name={field.name}
                      value={field.state.value}
                      autoComplete="off"
                      maxLength={MAX_TITLE_LENGTH}
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
              {pending ? "Saving…" : "Rename"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeletePatternDialog({
  userId,
  pattern,
  onDeleted,
  onClose,
}: {
  userId: number;
  pattern: SavedPattern;
  onDeleted: (pattern: SavedPattern) => void;
  onClose: () => void;
}) {
  const remove = useDeletePattern(userId);
  const pending = remove.isPending;
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
            This can&apos;t be undone. This permanently deletes the pattern{" "}
            <span
              className="line-clamp-3 font-medium wrap-anywhere text-red-500"
              title={pattern.title}
            >
              {pattern.title}
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-md" disabled={pending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            className={destructiveButtonClass}
            disabled={pending}
            onClick={() =>
              remove.mutate(
                { id: pattern.id },
                {
                  onSuccess: () => {
                    toast.success(`Deleted “${pattern.title}”`);
                    onDeleted(pattern);
                    onClose();
                  },
                },
              )
            }
          >
            {pending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
