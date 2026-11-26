import { Link } from "react-router";

import {
  Ellipsis,
  FilePlus,
  FileText,
  Folder,
  FolderPen,
  Trash2,
} from "lucide-react";

import { useFolio } from "@/hooks/use-folio";
import { findFolder, formatBytes, parentFolder } from "@/lib/folio/paths";
import { formatTimestamp } from "@/lib/time";
import { primaryButtonClass, quietActionClass } from "@/lib/styles";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FolioBreadcrumbs } from "@/components/folio/FolioBreadcrumbs";
import { ImportButton } from "@/components/folio/FolioExplorer";
import { BackButton, PaneBar } from "@/components/folio/PaneBar";

const rowClass =
  "flex h-10 items-center gap-3 px-4 text-sm text-neutral-300 outline-none transition-colors hover:bg-white/5 hover:text-white focus-visible:bg-white/5 focus-visible:shadow-[inset_2px_0_0_0_var(--color-violet-500)] pointer-coarse:h-12";

const scrollClass =
  "min-h-0 flex-1 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent overflow-y-auto overscroll-contain";

function plural(count: number, word: string) {
  return count === 1 ? `1 ${word}` : `${count} ${word}s`;
}

export function FolderView() {
  const { list, tree, selectedFolder, noteHref, folderHref, openDialog } =
    useFolio();
  const node = findFolder(tree, selectedFolder);
  const path = node?.path ?? "";
  const isRoot = path === "";

  const newNote = (
    <Button
      size="sm"
      className={primaryButtonClass}
      onClick={() => openDialog({ type: "create", folder: path })}
    >
      <FilePlus data-icon="inline-start" aria-hidden="true" />
      New Note
    </Button>
  );

  return (
    <section
      aria-label={isRoot ? "All notes" : node?.name}
      className="flex min-h-0 flex-1 flex-col"
    >
      <PaneBar
        actions={
          node && (
            <>
              {newNote}
              <ImportButton folder={path} />
              {!isRoot && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`More actions for ${node.name}`}
                        className={quietActionClass}
                      />
                    }
                  >
                    <Ellipsis aria-hidden="true" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52 rounded-md">
                    <DropdownMenuGroup>
                      <DropdownMenuItem
                        className="rounded-md"
                        onClick={() =>
                          openDialog({ type: "move-folder", folder: path })
                        }
                      >
                        <FolderPen aria-hidden="true" />
                        Rename or Move Folder
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        className="rounded-md"
                        onClick={() =>
                          openDialog({ type: "delete-folder", folder: path })
                        }
                      >
                        <Trash2 aria-hidden="true" />
                        Delete Folder
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </>
          )
        }
      >
        <BackButton fallback={folderHref(parentFolder(path))} />
        <FolioBreadcrumbs folder={path} />
        {node && node.count > 0 && (
          <span className="text-muted-foreground hidden shrink-0 text-xs tabular-nums sm:inline">
            {plural(node.count, "note")}
            {node.folders.length > 0 &&
              ` · ${plural(node.folders.length, "folder")}`}
          </span>
        )}
      </PaneBar>

      <div className={scrollClass}>
        {list.notes.length === 0 ? (
          <p className="text-muted-foreground px-4 py-3 text-sm text-pretty">
            No notes yet. Write one, or import .md files. Folders appear once a
            note lives in them.
          </p>
        ) : !node ? (
          <p className="text-muted-foreground px-4 py-3 text-sm text-pretty">
            This folder is empty.{" "}
            <Link
              to={folderHref("")}
              className="text-violet-400 underline-offset-4 hover:text-violet-300 hover:underline"
            >
              Back to all notes
            </Link>
          </p>
        ) : node.folders.length === 0 && node.notes.length === 0 ? (
          <p className="text-muted-foreground px-4 py-3 text-sm">
            Nothing here yet.
          </p>
        ) : (
          <ul className="divide-y divide-white/5 border-b border-white/5">
            {node.folders.map((child) => (
              <li key={child.path}>
                <Link to={folderHref(child.path)} className={rowClass}>
                  <Folder
                    aria-hidden="true"
                    className="size-4 shrink-0 text-violet-400"
                  />
                  <span className="min-w-0 flex-1 truncate font-medium text-neutral-100">
                    {child.name}
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                    {plural(child.count, "note")}
                  </span>
                </Link>
              </li>
            ))}
            {node.notes.map((note) => (
              <li key={note.id}>
                <Link to={noteHref(note.id)} className={rowClass}>
                  <FileText
                    aria-hidden="true"
                    className="size-4 shrink-0 text-neutral-500"
                  />
                  <span className="min-w-0 flex-1 truncate">{note.title}</span>
                  <span className="text-muted-foreground hidden shrink-0 text-xs sm:inline">
                    {note.updated_at
                      ? formatTimestamp(note.updated_at)
                      : "Never saved"}
                  </span>
                  <span className="text-muted-foreground w-16 shrink-0 text-right text-xs tabular-nums">
                    {formatBytes(note.size)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
