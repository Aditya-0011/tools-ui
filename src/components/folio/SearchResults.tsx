import { Link } from "react-router";

import { FileText } from "lucide-react";

import { useFolio } from "@/hooks/use-folio";
import { canonicalFolder, compareText } from "@/lib/folio/paths";
import { cn } from "@/lib/utils";

import { Highlight } from "@/components/folio/Highlight";

export function SearchResults({ query }: { query: string }) {
  const { list, tree, selectedNoteId, noteHref } = useFolio();
  const needle = query.trim().toLowerCase();
  const matches = list.notes
    .filter((note) => note.title.toLowerCase().includes(needle))
    .sort((a, b) => compareText(a.title, b.title));

  return (
    <div className="flex flex-col gap-2">
      <p
        aria-live="polite"
        className="text-muted-foreground px-2 text-xs tabular-nums"
      >
        {matches.length === 1 ? "1 match" : `${matches.length} matches`}
      </p>
      {matches.length === 0 ? (
        <p className="text-muted-foreground px-2 text-sm">
          No notes match “{query.trim()}”.
        </p>
      ) : (
        <ul className="flex flex-col gap-px">
          {matches.map((note) => {
            const isActive = note.id === selectedNoteId;
            return (
              <li key={note.id}>
                <Link
                  to={noteHref(note.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex items-start gap-2 rounded-md px-2 py-1.5 text-sm text-neutral-300 outline-none hover:bg-white/5 hover:text-white focus-visible:ring-2 focus-visible:ring-violet-500",
                    isActive &&
                      "bg-violet-500/15 text-violet-100 hover:bg-violet-500/20",
                  )}
                >
                  <FileText
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-neutral-500"
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">
                      <Highlight text={note.title} query={query} />
                    </span>
                    <span className="text-muted-foreground truncate text-xs">
                      {canonicalFolder(tree, note.folder) || "Top level"}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
