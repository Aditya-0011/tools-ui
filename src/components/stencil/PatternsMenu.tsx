import { useDeferredValue, useState } from "react";

import { ChevronDown, Pencil, Plus, Trash2 } from "lucide-react";
import { DateTime } from "luxon";

import { formatCount } from "@/lib/folio/paths";
import { delimiterLabel } from "@/lib/stencil/delimiters";
import { MAX_PATTERNS, type SavedPattern } from "@/lib/stencil/types";
import { popoverClass } from "@/lib/stencil/ui";
import { formatTimestamp } from "@/lib/time";
import { searchInputClass } from "@/lib/styles";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Highlight } from "@/components/folio/Highlight";
import { ListSearch } from "@/components/folio/ListSearch";

type PatternsMenuProps = {
  patterns: SavedPattern[] | undefined;
  loading: boolean;
  failed: boolean;
  activeId: number | null;
  onRetry: () => void;
  onNew: () => void;
  onLoad: (pattern: SavedPattern) => void;
  onRename: (pattern: SavedPattern) => void;
  onDelete: (pattern: SavedPattern) => void;
};

function meta(pattern: SavedPattern): string {
  const parts = [delimiterLabel(pattern.delimiter || ",")];
  if (pattern.has_header) parts.push("header");
  if (pattern.trim) parts.push("trim");
  const updated = formatTimestamp(pattern.updated_at, DateTime.DATE_MED);
  if (updated) parts.push(updated);
  return parts.join(" · ");
}

const rowAction =
  "rounded-md text-neutral-400 opacity-0 group-focus-within/item:opacity-100 group-hover/item:opacity-100 pointer-coarse:opacity-100";

export function PatternsMenu({
  patterns,
  loading,
  failed,
  activeId,
  onRetry,
  onNew,
  onLoad,
  onRename,
  onDelete,
}: PatternsMenuProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const query = useDeferredValue(search);
  const needle = query.trim().toLowerCase();
  const list = patterns ?? [];
  const matches = needle
    ? list.filter((entry) => entry.title.toLowerCase().includes(needle))
    : list;

  const close = (action: () => void) => {
    setOpen(false);
    setSearch("");
    action();
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
    >
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="rounded-md text-neutral-200 hover:bg-white/5 aria-expanded:bg-white/5"
          />
        }
      >
        Patterns
        <span className="text-muted-foreground tabular-nums">
          {patterns ? formatCount(list.length) : ""}
        </span>
        <ChevronDown data-icon="inline-end" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        aria-label="Saved patterns"
        className={cn(popoverClass, "w-[min(22rem,calc(100vw-2rem))] gap-0")}
      >
        <div className="flex flex-col gap-2 p-2">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-semibold tracking-wider text-neutral-400 uppercase">
              Saved patterns
            </p>
            <p className="text-muted-foreground text-xs tabular-nums">
              {patterns ? `${formatCount(list.length)} / ${MAX_PATTERNS}` : ""}
            </p>
          </div>
          <ListSearch
            label="Search saved patterns"
            placeholder="Search titles…"
            value={search}
            onChange={setSearch}
            className={searchInputClass}
          />
        </div>
        <div className="max-h-[min(22rem,60svh)] scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent overflow-y-auto overscroll-contain border-t border-white/10 p-1">
          <button
            type="button"
            onClick={() => close(onNew)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-violet-300 outline-none hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-violet-500"
          >
            <Plus aria-hidden="true" className="size-4" />
            New pattern
          </button>
          {loading ? (
            <p
              role="status"
              className="text-muted-foreground px-2 py-3 text-sm"
            >
              Loading saved patterns…
            </p>
          ) : failed ? (
            <p role="alert" className="text-muted-foreground px-2 py-3 text-sm">
              Couldn’t load saved patterns.{" "}
              <button
                type="button"
                onClick={onRetry}
                className="text-violet-300 underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
              >
                Retry
              </button>
            </p>
          ) : list.length === 0 ? (
            <p className="text-muted-foreground px-2 py-3 text-sm text-pretty">
              No saved patterns yet. Use Save to keep the current one.
            </p>
          ) : matches.length === 0 ? (
            <p
              aria-live="polite"
              className="text-muted-foreground px-2 py-3 text-sm wrap-anywhere"
            >
              No patterns match “{query.trim()}”.
            </p>
          ) : (
            <ul className="flex flex-col gap-px">
              {matches.map((entry) => {
                const active = entry.id === activeId;
                return (
                  <li
                    key={entry.id}
                    className={cn(
                      "group/item flex items-center gap-0.5 rounded-md pr-1 hover:bg-white/5",
                      active && "bg-violet-500/15 hover:bg-violet-500/20",
                    )}
                  >
                    <button
                      type="button"
                      aria-current={active ? "true" : undefined}
                      onClick={() => close(() => onLoad(entry))}
                      className="flex min-w-0 flex-1 flex-col items-start rounded-md px-2 py-1.5 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                    >
                      <span
                        className={cn(
                          "w-full truncate",
                          active ? "text-violet-100" : "text-neutral-200",
                        )}
                      >
                        <Highlight text={entry.title} query={query} />
                      </span>
                      <span className="text-muted-foreground w-full truncate text-xs">
                        {meta(entry)}
                      </span>
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Rename ${entry.title}`}
                      title="Rename"
                      className={cn(rowAction, "hover:text-violet-300")}
                      onClick={() => close(() => onRename(entry))}
                    >
                      <Pencil aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Delete ${entry.title}`}
                      title="Delete"
                      className={cn(rowAction, "hover:text-red-400")}
                      onClick={() => close(() => onDelete(entry))}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
