import { useDeferredValue, useRef, useState } from "react";

import { FilePlus, Search, Upload } from "lucide-react";

import { useCurrentFolder, useFolio } from "@/hooks/use-folio";
import { paneLabelClass, quietActionClass } from "@/lib/styles";

import { Button } from "@/components/ui/button";
import { FolderTree } from "@/components/folio/FolderTree";
import { QuotaMeter } from "@/components/folio/QuotaMeter";
import { SearchResults } from "@/components/folio/SearchResults";

export function ImportButton({ folder }: { folder: string }) {
  const { openDialog } = useFolio();
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={
          folder ? `Import .md files into ${folder}` : "Import .md files"
        }
        title="Import .md files"
        className={quietActionClass}
        onClick={() => input.current?.click()}
      >
        <Upload aria-hidden="true" />
      </Button>
      <input
        ref={input}
        type="file"
        accept=".md,.markdown,text/markdown"
        multiple
        hidden
        tabIndex={-1}
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          event.target.value = "";
          if (files.length > 0) openDialog({ type: "import", folder, files });
        }}
      />
    </>
  );
}

export function FolioExplorer() {
  const { list, openDialog } = useFolio();
  const folder = useCurrentFolder();
  const [search, setSearch] = useState("");
  const query = useDeferredValue(search);
  const searching = query.trim() !== "";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-white/10 pr-2 pl-4">
        <h1 className={paneLabelClass}>Folio</h1>
        <div className="flex items-center gap-0.5 pointer-coarse:gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="New note"
            title="New note"
            className={quietActionClass}
            onClick={() => openDialog({ type: "create", folder })}
          >
            <FilePlus aria-hidden="true" />
          </Button>
          <ImportButton folder={folder} />
        </div>
      </div>
      <div className="relative shrink-0 border-b border-white/10 focus-within:border-violet-500/60">
        <Search
          aria-hidden="true"
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2"
        />
        <input
          type="search"
          name="search"
          aria-label="Search note titles"
          placeholder="Search titles…"
          autoComplete="off"
          spellCheck={false}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="placeholder:text-muted-foreground h-10 w-full bg-transparent pr-4 pl-10 text-sm text-neutral-100 outline-none [&::-webkit-search-cancel-button]:hidden"
        />
      </div>
      <div className="min-h-0 flex-1 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent overflow-y-auto overscroll-contain px-2 py-2">
        {list.notes.length === 0 ? (
          <p className="text-muted-foreground px-2 py-1 text-sm text-pretty">
            No notes yet. Create one or import .md files.
          </p>
        ) : searching ? (
          <SearchResults query={query} />
        ) : (
          <FolderTree />
        )}
      </div>
      <QuotaMeter quota={list.quota} />
    </div>
  );
}
