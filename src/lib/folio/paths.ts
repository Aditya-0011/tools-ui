import {
  MAX_FOLDER_DEPTH,
  MAX_FOLDER_LENGTH,
  MAX_SEGMENT_LENGTH,
  MAX_TITLE_LENGTH,
  type NoteSummary,
} from "@/lib/folio/types";

const SEGMENT = /^[\p{L}\p{N} ._()-]+$/u;
const TITLE_FORBIDDEN = /[/\\\p{Cc}]/u;
const TITLE_FORBIDDEN_GLOBAL = /[/\\\p{Cc}]+/gu;

const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

export const compareText = (a: string, b: string) => collator.compare(a, b);

export function normalizeFolder(raw: string): string {
  return raw
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .map((segment) => segment.trim())
    .join("/");
}

export function validateFolder(folder: string): string | null {
  if (folder === "") return null;
  if (folder.length > MAX_FOLDER_LENGTH) {
    return `Folder path can be at most ${MAX_FOLDER_LENGTH} characters long`;
  }
  const segments = folder.split("/");
  if (segments.length > MAX_FOLDER_DEPTH) {
    return `Folders can be nested at most ${MAX_FOLDER_DEPTH} levels deep`;
  }
  for (const segment of segments) {
    if (segment === "") return "Folder names can't be empty";
    if (segment === "." || segment === "..") {
      return "Folder names can't be . or ..";
    }
    if (segment.length > MAX_SEGMENT_LENGTH) {
      return `Each folder name can be at most ${MAX_SEGMENT_LENGTH} characters long`;
    }
    if (!SEGMENT.test(segment)) {
      return "Folder names can use letters, numbers, spaces and . _ ( ) -";
    }
  }
  return null;
}

export function validateTitle(title: string): string | null {
  if (title === "") return "Title is required";
  if (title.length > MAX_TITLE_LENGTH) {
    return `Title can be at most ${MAX_TITLE_LENGTH} characters long`;
  }
  if (TITLE_FORBIDDEN.test(title)) return "Title can't contain / or \\";
  return null;
}

export function titleFromFileName(name: string): string {
  return name
    .replace(/\.(md|markdown|txt)$/i, "")
    .replace(TITLE_FORBIDDEN_GLOBAL, "-")
    .trim()
    .slice(0, MAX_TITLE_LENGTH)
    .trim();
}

export function fileNameFromTitle(title: string): string {
  const safe = title.replace(/[<>:"|?*]+/g, "-").trim() || "note";
  return `${safe}.md`;
}

export function folderName(path: string): string {
  const index = path.lastIndexOf("/");
  return index === -1 ? path : path.slice(index + 1);
}

export function parentFolder(path: string): string {
  const index = path.lastIndexOf("/");
  return index === -1 ? "" : path.slice(0, index);
}

export function folderKey(path: string): string {
  return path.toLowerCase();
}

export function sameFolder(a: string, b: string): boolean {
  return folderKey(a) === folderKey(b);
}

export function isWithin(folder: string, ancestor: string): boolean {
  if (ancestor === "") return true;
  const key = folderKey(folder);
  const prefix = folderKey(ancestor);
  return key === prefix || key.startsWith(`${prefix}/`);
}

export function ancestorsOf(folder: string): string[] {
  if (!folder) return [];
  const segments = folder.split("/");
  return segments.map((_, index) => segments.slice(0, index + 1).join("/"));
}

export function rebaseFolder(folder: string, from: string, to: string) {
  if (!isWithin(folder, from)) return folder;
  const rest = folder.slice(from.length).replace(/^\//, "");
  if (!to) return rest;
  return rest ? `${to}/${rest}` : to;
}

export type FolderNode = {
  path: string;
  name: string;
  folders: FolderNode[];
  notes: NoteSummary[];
  count: number;
};

function byRecent(notes: NoteSummary[]): NoteSummary[] {
  return [...notes].sort((a, b) =>
    (b.updated_at ?? "").localeCompare(a.updated_at ?? ""),
  );
}

export function buildTree(notes: NoteSummary[]): FolderNode {
  const root: FolderNode = {
    path: "",
    name: "",
    folders: [],
    notes: [],
    count: 0,
  };
  const index = new Map<string, FolderNode>([["", root]]);

  const ensure = (path: string): FolderNode => {
    const existing = index.get(folderKey(path));
    if (existing) return existing;
    const parent = ensure(parentFolder(path));
    const name = folderName(path);
    const node: FolderNode = {
      path: parent.path ? `${parent.path}/${name}` : name,
      name,
      folders: [],
      notes: [],
      count: 0,
    };
    parent.folders.push(node);
    index.set(folderKey(path), node);
    return node;
  };

  for (const note of byRecent(notes)) {
    ensure(note.folder).notes.push(note);
    root.count += 1;
    for (const ancestor of ancestorsOf(note.folder)) {
      const node = index.get(folderKey(ancestor));
      if (node) node.count += 1;
    }
  }

  const sort = (node: FolderNode) => {
    node.folders.sort((a, b) => compareText(a.name, b.name));
    node.notes.sort((a, b) => compareText(a.title, b.title));
    node.folders.forEach(sort);
  };
  sort(root);
  return root;
}

export function findFolder(
  root: FolderNode,
  path: string,
): FolderNode | undefined {
  if (!path) return root;
  let node: FolderNode | undefined = root;
  for (const ancestor of ancestorsOf(path)) {
    node = node?.folders.find((child) => sameFolder(child.path, ancestor));
    if (!node) return undefined;
  }
  return node;
}

export function allFolders(root: FolderNode): string[] {
  const result: string[] = [];
  const walk = (node: FolderNode) => {
    for (const child of node.folders) {
      result.push(child.path);
      walk(child);
    }
  };
  walk(root);
  return result.sort(compareText);
}

export function canonicalFolder(root: FolderNode, folder: string): string {
  return findFolder(root, folder)?.path ?? folder;
}

export function hasDuplicateTitle(
  notes: NoteSummary[],
  folder: string,
  title: string,
  exceptId?: number,
): boolean {
  const key = folderKey(folder);
  const name = title.toLowerCase();
  return notes.some(
    (note) =>
      note.id !== exceptId &&
      folderKey(note.folder) === key &&
      note.title.toLowerCase() === name,
  );
}

const decimal = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat();

const UNITS = [
  { unit: "MB", size: 1024 * 1024 },
  { unit: "KB", size: 1024 },
];

function unitFor(bytes: number) {
  return UNITS.find(({ size }) => bytes >= size) ?? { unit: "B", size: 1 };
}

export function formatBytes(bytes: number): string {
  const { unit, size } = unitFor(bytes);
  return `${decimal.format(bytes / size)}\u00a0${unit}`;
}

export function formatBytesPair(used: number, max: number): string {
  const { unit, size } = unitFor(max);
  const total = `${decimal.format(max / size)}\u00a0${unit}`;
  if (used > 0 && used < size / 10) return `${formatBytes(used)} / ${total}`;
  return `${decimal.format(used / size)} / ${total}`;
}

export function formatCount(value: number): string {
  return integer.format(value);
}

export function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}
