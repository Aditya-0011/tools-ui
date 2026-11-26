import { StencilError } from "@/lib/stencil/errors";
import type { ParsedData } from "@/lib/stencil/parse";
import type { ColumnPart, Part, Program } from "@/lib/stencil/pattern";

export const MAX_OUTPUT_CHARS = 64 * 1024 * 1024;

type Bound =
  | { type: "text"; value: string }
  | { type: "column"; index: number; part: ColumnPart }
  | { type: "row" | "rownum" | "count" }
  | { type: "sep"; value: string };

export function normalizeHeader(name: string): string {
  return name.trim().toLowerCase();
}

function columnList(headers: string[]): string {
  const names = headers
    .map((name, index) => `${name.trim() || "(blank)"} ($${index})`)
    .slice(0, 12);
  const more = headers.length > 12 ? `, and ${headers.length - 12} more` : "";
  return names.join(", ") + more;
}

function bind(
  parts: Part[],
  lookup: Map<string, number> | null,
  headers: string[] | null,
): Bound[] {
  return parts.map((part) => {
    if (part.type !== "column") return part;
    if (part.index !== null) {
      return { type: "column", index: part.index, part };
    }
    const name = part.name ?? "";
    if (!lookup || !headers) {
      throw new StencilError(
        "header-required",
        `${part.source} uses a column name, which needs the first row to be a header. Turn on Header row, or use a number like $0.`,
        part.span,
      );
    }
    const index = lookup.get(normalizeHeader(name));
    if (index === undefined) {
      throw new StencilError(
        "unknown-column",
        `No column named “${name}”. Columns: ${columnList(headers)}.`,
        part.span,
      );
    }
    return { type: "column", index, part };
  });
}

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function outOfRange(
  bound: { index: number; part: ColumnPart },
  row: string[],
  rowNumber: number,
): never {
  const range =
    row.length === 0
      ? ""
      : row.length === 1
        ? " ($0)"
        : ` ($0–$${row.length - 1})`;
  const named = bound.part.name !== null ? ` (column $${bound.index})` : "";
  throw new StencilError(
    "out-of-range",
    `Row ${rowNumber} has ${plural(row.length, "column")}${range}, but the pattern uses ${bound.part.source}${named}.`,
    bound.part.span,
    rowNumber,
  );
}

export function renderProgram(program: Program, data: ParsedData): string {
  let lookup: Map<string, number> | null = null;
  if (data.headers) {
    lookup = new Map();
    data.headers.forEach((name, index) => {
      const key = normalizeHeader(name);
      if (!lookup!.has(key)) lookup!.set(key, index);
    });
  }

  const sections = program.sections.map((section) => ({
    each: section.each,
    parts: bind(section.parts, lookup, data.headers),
  }));

  const count = String(data.rows.length);
  const pieces: string[] = [];
  let size = 0;
  const push = (piece: string) => {
    size += piece.length + 1;
    if (size > MAX_OUTPUT_CHARS) {
      throw new StencilError(
        "output-too-large",
        "The output would be larger than 64 MB. Use less data or a shorter pattern.",
      );
    }
    pieces.push(piece);
  };

  for (const section of sections) {
    if (!section.each) {
      let out = "";
      for (const part of section.parts) {
        out +=
          part.type === "text"
            ? part.value
            : part.type === "count"
              ? count
              : "";
      }
      push(out);
      continue;
    }
    const parts = section.parts;
    const rows = data.rows;
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      let out = "";
      for (let p = 0; p < parts.length; p++) {
        const part = parts[p];
        switch (part.type) {
          case "text":
            out += part.value;
            break;
          case "column": {
            let value = row[part.index];
            if (value === undefined) outOfRange(part, row, r + 1);
            const transforms = part.part.transforms;
            for (let t = 0; t < transforms.length; t++)
              value = transforms[t](value);
            out += value;
            break;
          }
          case "row":
            out += r;
            break;
          case "rownum":
            out += r + 1;
            break;
          case "count":
            out += count;
            break;
          case "sep":
            if (r < rows.length - 1) out += part.value;
            break;
        }
      }
      push(out);
    }
  }

  return pieces.join("\n");
}
