import { Autocomplete } from "@base-ui/react/autocomplete";

import { Folder } from "lucide-react";

import { inputClass } from "@/lib/styles";
import { cn } from "@/lib/utils";

type FolderInputProps = {
  id: string;
  name: string;
  value: string;
  folders: string[];
  disabled?: boolean;
  invalid?: boolean;
  onChange: (value: string) => void;
  onBlur?: () => void;
  describedBy?: string;
};

export function FolderInput({
  id,
  name,
  value,
  folders,
  disabled,
  invalid,
  onChange,
  onBlur,
  describedBy,
}: FolderInputProps) {
  return (
    <Autocomplete.Root
      items={folders}
      value={value}
      onValueChange={(next) => onChange(next)}
      openOnInputClick
    >
      <Autocomplete.Input
        id={id}
        name={name}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onBlur={onBlur}
        placeholder="Top level, or e.g. Work/Projects…"
        autoComplete="off"
        spellCheck={false}
        className={cn(
          "bg-input/50 placeholder:text-muted-foreground aria-invalid:border-destructive h-8 w-full min-w-0 px-2.5 py-1 text-base outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          inputClass,
        )}
      />
      <Autocomplete.Portal>
        <Autocomplete.Positioner
          className="isolate z-50 outline-none"
          sideOffset={6}
        >
          <Autocomplete.Popup className="bg-popover text-popover-foreground border-input data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 w-(--anchor-width) max-w-(--available-width) origin-(--transform-origin) overflow-hidden rounded-md border shadow-lg duration-100">
            <Autocomplete.List className="max-h-[min(16rem,var(--available-height))] scroll-py-1 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent overflow-y-auto overscroll-contain p-1 data-empty:p-0">
              {(folder: string) => (
                <Autocomplete.Item
                  key={folder}
                  value={folder}
                  className="flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none select-none data-highlighted:bg-violet-500/15 data-highlighted:text-violet-100"
                >
                  <Folder
                    aria-hidden="true"
                    className="size-4 shrink-0 text-violet-400"
                  />
                  <span className="truncate">{folder}</span>
                </Autocomplete.Item>
              )}
            </Autocomplete.List>
          </Autocomplete.Popup>
        </Autocomplete.Positioner>
      </Autocomplete.Portal>
    </Autocomplete.Root>
  );
}
