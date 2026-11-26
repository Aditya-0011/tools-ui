import { useId } from "react";

import { formatCount } from "@/lib/folio/paths";
import { MOD_KEY } from "@/lib/stencil/save";
import { MAX_PATTERNS, MAX_TITLE_LENGTH } from "@/lib/stencil/types";
import { popoverClass } from "@/lib/stencil/ui";
import {
  inputClass,
  outlineButtonClass,
  primaryButtonClass,
} from "@/lib/styles";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type SaveState = {
  title: string;
  loadedTitle: string | null;
  dirty: boolean;
  pending: "update" | "new" | null;
  titleError: string | null;
  formError: string | null;
  count: number;
  ready: boolean;
};

type SavePopoverProps = {
  open: boolean;
  save: SaveState;
  onOpenChange: (open: boolean) => void;
  onTitleChange: (title: string) => void;
  onSave: (mode: "update" | "new") => void;
};

export function SavePopover({
  open,
  save,
  onOpenChange,
  onTitleChange,
  onSave,
}: SavePopoverProps) {
  const ids = useId();
  const busy = save.pending !== null || !save.ready;
  const atLimit = save.count >= MAX_PATTERNS;
  const loaded = save.loadedTitle;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            size="sm"
            className={cn(primaryButtonClass, "relative")}
          />
        }
      >
        Save
        {loaded && save.dirty && (
          <span
            aria-label="unsaved changes"
            className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-amber-400"
          />
        )}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className={cn(
          popoverClass,
          "w-[min(20rem,calc(100vw-2rem))] gap-3 p-3",
        )}
      >
        <form
          noValidate
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            onSave(loaded ? "update" : "new");
          }}
        >
          <Field data-invalid={!!save.titleError} className="gap-1.5">
            <FieldLabel htmlFor={`${ids}-title`} className="text-xs">
              Title
            </FieldLabel>
            <Input
              id={`${ids}-title`}
              name="title"
              value={save.title}
              maxLength={MAX_TITLE_LENGTH}
              autoComplete="off"
              placeholder="Customers to SQL…"
              aria-invalid={!!save.titleError}
              disabled={save.pending !== null}
              onChange={(event) => onTitleChange(event.target.value)}
              className={inputClass}
            />
            {save.titleError && (
              <FieldError className="text-xs">{save.titleError}</FieldError>
            )}
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            {loaded ? (
              <>
                <Button
                  type="submit"
                  size="sm"
                  disabled={busy || !save.dirty}
                  className={cn(primaryButtonClass, "max-w-full min-w-0")}
                >
                  <span className="truncate">
                    {save.pending === "update"
                      ? "Updating…"
                      : save.dirty
                        ? `Update “${loaded}”`
                        : "Saved"}
                  </span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy || atLimit}
                  className={outlineButtonClass}
                  onClick={() => onSave("new")}
                >
                  {save.pending === "new" ? "Saving…" : "Save as New"}
                </Button>
              </>
            ) : (
              <Button
                type="submit"
                size="sm"
                disabled={busy || atLimit}
                className={primaryButtonClass}
              >
                {save.pending === "new" ? "Saving…" : "Save as New"}
              </Button>
            )}
          </div>
          <div aria-live="polite">
            {save.formError ? (
              <p role="alert" className="text-xs text-red-400">
                {save.formError}
              </p>
            ) : atLimit && !loaded ? (
              <p className="text-xs text-amber-400">
                You can save up to {MAX_PATTERNS} patterns. Delete one to save
                another.
              </p>
            ) : null}
          </div>
          <p className="text-muted-foreground text-xs text-pretty">
            {loaded
              ? `Update replaces “${loaded}”; Save as New adds a copy.`
              : "Saves the pattern, delimiter, header and trim settings."}{" "}
            Your data is never saved. {formatCount(save.count)} / {MAX_PATTERNS}{" "}
            used · {MOD_KEY}+S
          </p>
        </form>
      </PopoverContent>
    </Popover>
  );
}
