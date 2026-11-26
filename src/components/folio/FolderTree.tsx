import { useRef, useState, type KeyboardEvent } from "react";

import { ChevronRight, FileText, Folder, FolderOpen } from "lucide-react";

import { useFolio } from "@/hooks/use-folio";
import { folderKey, sameFolder, type FolderNode } from "@/lib/folio/paths";
import type { NoteSummary } from "@/lib/folio/types";
import { cn } from "@/lib/utils";

type Row =
  | {
      kind: "folder";
      id: string;
      node: FolderNode;
      level: number;
      parentId: string | null;
      position: number;
      size: number;
    }
  | {
      kind: "note";
      id: string;
      note: NoteSummary;
      level: number;
      parentId: string | null;
      position: number;
      size: number;
    };

const folderId = (path: string) => `f:${folderKey(path)}`;
const noteId = (id: number) => `n:${id}`;

function flatten(
  node: FolderNode,
  expanded: ReadonlySet<string>,
  level: number,
  parentId: string | null,
  rows: Row[],
) {
  const size = node.folders.length + node.notes.length;
  let position = 0;
  for (const child of node.folders) {
    position += 1;
    const id = folderId(child.path);
    rows.push({
      kind: "folder",
      id,
      node: child,
      level,
      parentId,
      position,
      size,
    });
    if (expanded.has(folderKey(child.path)))
      flatten(child, expanded, level + 1, id, rows);
  }
  for (const note of node.notes) {
    position += 1;
    rows.push({
      kind: "note",
      id: noteId(note.id),
      note,
      level,
      parentId,
      position,
      size,
    });
  }
  return rows;
}

const rowClass =
  "flex min-h-8 w-full cursor-pointer items-center gap-1.5 rounded-md pr-2 text-sm text-neutral-300 outline-none select-none hover:bg-white/5 hover:text-white focus-visible:ring-2 focus-visible:ring-violet-500 pointer-coarse:min-h-10";

const activeClass =
  "bg-violet-500/15 text-violet-100 hover:bg-violet-500/20 hover:text-violet-50";

export function FolderTree() {
  const {
    tree,
    expanded,
    selectedNoteId,
    selectedFolder,
    setExpanded,
    openFolder,
    openNote,
  } = useFolio();
  const container = useRef<HTMLUListElement>(null);
  const rows = flatten(tree, expanded, 1, null, []);

  const activeId =
    selectedNoteId !== null
      ? noteId(selectedNoteId)
      : selectedFolder
        ? folderId(selectedFolder)
        : null;
  const [focusId, setFocusId] = useState<string | null>(null);
  const tabbableId =
    (focusId && rows.some((row) => row.id === focusId) && focusId) ||
    (activeId && rows.some((row) => row.id === activeId) && activeId) ||
    rows[0]?.id;

  const focusRow = (id: string | undefined) => {
    if (!id) return;
    setFocusId(id);
    const element = container.current?.querySelector<HTMLElement>(
      `[data-tree-id="${CSS.escape(id)}"]`,
    );
    element?.focus();
  };

  const activate = (row: Row) => {
    if (row.kind === "note") {
      openNote(row.note.id);
      return;
    }
    const isOpen = expanded.has(folderKey(row.node.path));
    if (selectedNoteId === null && sameFolder(selectedFolder, row.node.path)) {
      setExpanded(row.node.path, !isOpen);
    } else {
      setExpanded(row.node.path, true);
    }
    openFolder(row.node.path);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const index = rows.findIndex((row) => row.id === tabbableId);
    const row = rows[index];
    if (!row) return;
    switch (event.key) {
      case "ArrowDown":
        focusRow(rows[index + 1]?.id);
        break;
      case "ArrowUp":
        focusRow(rows[index - 1]?.id);
        break;
      case "Home":
        focusRow(rows[0]?.id);
        break;
      case "End":
        focusRow(rows.at(-1)?.id);
        break;
      case "ArrowRight":
        if (row.kind === "folder") {
          if (!expanded.has(folderKey(row.node.path)))
            setExpanded(row.node.path, true);
          else if (rows[index + 1]?.parentId === row.id) {
            focusRow(rows[index + 1].id);
          }
        }
        break;
      case "ArrowLeft":
        if (row.kind === "folder" && expanded.has(folderKey(row.node.path))) {
          setExpanded(row.node.path, false);
        } else if (row.parentId) {
          focusRow(row.parentId);
        }
        break;
      case "Enter":
      case " ":
        activate(row);
        break;
      default:
        if (event.key.length === 1 && /\S/.test(event.key)) {
          const key = event.key.toLowerCase();
          const ordered = [...rows.slice(index + 1), ...rows.slice(0, index)];
          const match = ordered.find((candidate) =>
            (candidate.kind === "folder"
              ? candidate.node.name
              : candidate.note.title
            )
              .toLowerCase()
              .startsWith(key),
          );
          focusRow(match?.id);
          break;
        }
        return;
    }
    event.preventDefault();
  };

  return (
    <ul
      ref={container}
      role="tree"
      aria-label="Notes and folders"
      onKeyDown={onKeyDown}
      className="flex flex-col gap-px"
    >
      {rows.map((row) => {
        const isActive = row.id === activeId;
        const indent = { paddingLeft: `${(row.level - 1) * 0.875 + 0.25}rem` };
        if (row.kind === "folder") {
          const isOpen = expanded.has(folderKey(row.node.path));
          const Icon = isOpen ? FolderOpen : Folder;
          return (
            <li
              key={row.id}
              role="treeitem"
              data-tree-id={row.id}
              aria-level={row.level}
              aria-posinset={row.position}
              aria-setsize={row.size}
              aria-expanded={isOpen}
              aria-selected={isActive}
              tabIndex={row.id === tabbableId ? 0 : -1}
              onFocus={() => setFocusId(row.id)}
              onClick={() => activate(row)}
              className={cn(rowClass, isActive && activeClass)}
              style={indent}
            >
              <span
                aria-hidden="true"
                onClick={(event) => {
                  event.stopPropagation();
                  setFocusId(row.id);
                  setExpanded(row.node.path, !isOpen);
                }}
                className="flex size-5 shrink-0 items-center justify-center rounded text-neutral-500 hover:bg-white/10 hover:text-white pointer-coarse:size-8"
              >
                <ChevronRight
                  className={cn(
                    "size-3.5 transition-transform duration-150 ease-out",
                    isOpen && "rotate-90",
                  )}
                />
              </span>
              <Icon
                aria-hidden="true"
                className="size-4 shrink-0 text-violet-400"
              />
              <span className="min-w-0 flex-1 truncate">{row.node.name}</span>
              <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                <span className="sr-only">, </span>
                {row.node.count}
                <span className="sr-only"> notes</span>
              </span>
            </li>
          );
        }
        return (
          <li
            key={row.id}
            role="treeitem"
            data-tree-id={row.id}
            aria-level={row.level}
            aria-posinset={row.position}
            aria-setsize={row.size}
            aria-selected={isActive}
            aria-current={isActive ? "page" : undefined}
            tabIndex={row.id === tabbableId ? 0 : -1}
            onFocus={() => setFocusId(row.id)}
            onClick={() => activate(row)}
            className={cn(rowClass, isActive && activeClass)}
            style={{
              paddingLeft: `${(row.level - 1) * 0.875 + 1.5}rem`,
            }}
          >
            <FileText
              aria-hidden="true"
              className={cn(
                "size-4 shrink-0",
                isActive ? "text-violet-300" : "text-neutral-500",
              )}
            />
            <span className="min-w-0 flex-1 truncate">{row.note.title}</span>
          </li>
        );
      })}
    </ul>
  );
}
