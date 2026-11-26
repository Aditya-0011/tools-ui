import { StencilError, type Span } from "@/lib/stencil/errors";
import { buildFunction, type Transform } from "@/lib/stencil/functions";

export type ColumnPart = {
  type: "column";
  index: number | null;
  name: string | null;
  transforms: Transform[];
  source: string;
  span: Span;
};

export type Part =
  | { type: "text"; value: string }
  | ColumnPart
  | { type: "row" | "rownum"; span: Span }
  | { type: "sep"; value: string; span: Span }
  | { type: "count" };

export type Section = { each: boolean; parts: Part[] };

export type Program = { sections: Section[] };

const ESCAPABLE = new Set([":", "|", "}", "\\"]);

function isDigit(code: number) {
  return code >= 48 && code <= 57;
}

type Piece = { values: string[]; start: number };

function parseBraced(
  line: string,
  offset: number,
  dollar: number,
): { part: ColumnPart; next: number } {
  const pieces: Piece[] = [{ values: [""], start: dollar + 2 }];
  let current = pieces[0];
  let k = dollar + 2;
  let closed = false;
  while (k < line.length) {
    const char = line[k];
    if (char === "\\" && k + 1 < line.length && ESCAPABLE.has(line[k + 1])) {
      current.values[current.values.length - 1] += line[k + 1];
      k += 2;
      continue;
    }
    if (char === "}") {
      closed = true;
      break;
    }
    if (char === "|") {
      current = { values: [""], start: k + 1 };
      pieces.push(current);
      k++;
      continue;
    }
    if (char === ":") {
      current.values.push("");
      k++;
      continue;
    }
    current.values[current.values.length - 1] += char;
    k++;
  }

  const span = { start: offset + dollar, end: offset + k + (closed ? 1 : 0) };
  if (!closed) {
    throw new StencilError(
      "unclosed-brace",
      "This ${ is never closed. Add } after the column, like ${name}.",
      { start: offset + dollar, end: offset + dollar + 2 },
    );
  }

  const source = line.slice(dollar, k + 1);
  const ref = pieces[0].values.join(":").trim();
  if (ref === "") {
    throw new StencilError(
      "empty-column",
      "Empty ${}. Put a column number or name inside, like ${0} or ${name}.",
      span,
    );
  }

  const transforms = pieces.slice(1).map((piece, index) => {
    const end = index + 2 < pieces.length ? pieces[index + 2].start - 1 : k;
    return buildFunction(piece.values[0], piece.values.slice(1), {
      start: offset + piece.start,
      end: offset + end,
    });
  });

  const numeric = /^\d+$/.test(ref);
  return {
    part: {
      type: "column",
      index: numeric ? Number(ref) : null,
      name: numeric ? null : ref,
      transforms,
      source,
      span,
    },
    next: k + 1,
  };
}

function parseSeparator(
  line: string,
  offset: number,
  dollar: number,
): { value: string; next: number } {
  let value = "";
  let k = dollar + 5;
  while (k < line.length) {
    const char = line[k];
    if (char === "\\" && (line[k + 1] === "}" || line[k + 1] === "\\")) {
      value += line[k + 1];
      k += 2;
      continue;
    }
    if (char === "}") return { value, next: k + 1 };
    value += char;
    k++;
  }
  throw new StencilError(
    "unclosed-brace",
    "This $SEP{ is never closed. Add } after the separator, like $SEP{,}.",
    { start: offset + dollar, end: offset + dollar + 5 },
  );
}

function notPerRow(token: string, span: Span): never {
  throw new StencilError(
    "not-per-row",
    `${token} only works in per-row lines. Move it below $EACH, or remove the $ONCE above it.`,
    span,
  );
}

function compileLine(
  line: string,
  offset: number,
  each: boolean,
  parts: Part[],
) {
  let text = "";
  const flush = () => {
    if (text === "") return;
    const last = parts[parts.length - 1];
    if (last?.type === "text") last.value += text;
    else parts.push({ type: "text", value: text });
    text = "";
  };

  let i = 0;
  while (i < line.length) {
    const dollar = line.indexOf("$", i);
    if (dollar === -1) {
      text += line.slice(i);
      break;
    }
    text += line.slice(i, dollar);
    const next = line.charCodeAt(dollar + 1);

    if (next === 36) {
      text += "$";
      i = dollar + 2;
      continue;
    }

    if (isDigit(next)) {
      let end = dollar + 1;
      while (end < line.length && isDigit(line.charCodeAt(end))) end++;
      const span = { start: offset + dollar, end: offset + end };
      const source = line.slice(dollar, end);
      if (!each) notPerRow(source, span);
      flush();
      parts.push({
        type: "column",
        index: Number(line.slice(dollar + 1, end)),
        name: null,
        transforms: [],
        source,
        span,
      });
      i = end;
      continue;
    }

    if (next === 123) {
      const { part, next: after } = parseBraced(line, offset, dollar);
      if (!each) notPerRow(part.source, part.span);
      flush();
      parts.push(part);
      i = after;
      continue;
    }

    if (line.startsWith("SEP{", dollar + 1)) {
      const { value, next: after } = parseSeparator(line, offset, dollar);
      const span = { start: offset + dollar, end: offset + after };
      if (!each) notPerRow("$SEP", span);
      flush();
      parts.push({ type: "sep", value, span });
      i = after;
      continue;
    }

    if (line.startsWith("ROWNUM", dollar + 1)) {
      const span = { start: offset + dollar, end: offset + dollar + 7 };
      if (!each) notPerRow("$ROWNUM", span);
      flush();
      parts.push({ type: "rownum", span });
      i = dollar + 7;
      continue;
    }

    if (line.startsWith("ROW", dollar + 1)) {
      const span = { start: offset + dollar, end: offset + dollar + 4 };
      if (!each) notPerRow("$ROW", span);
      flush();
      parts.push({ type: "row", span });
      i = dollar + 4;
      continue;
    }

    if (line.startsWith("COUNT", dollar + 1)) {
      flush();
      parts.push({ type: "count" });
      i = dollar + 6;
      continue;
    }

    text += "$";
    i = dollar + 1;
  }
  flush();
}

export function compilePattern(pattern: string): Program {
  const lines: { text: string; offset: number }[] = [];
  let start = 0;
  while (start <= pattern.length) {
    let end = pattern.indexOf("\n", start);
    if (end === -1) end = pattern.length;
    let text = pattern.slice(start, end);
    if (text.endsWith("\r")) text = text.slice(0, -1);
    lines.push({ text, offset: start });
    start = end + 1;
  }
  if (lines.length > 1 && lines[lines.length - 1].text === "") lines.pop();

  const sections: Section[] = [];
  let section: Section | null = null;
  let each = true;
  let lineCount = 0;

  for (const line of lines) {
    const marker = line.text.trim();
    if (marker === "$ONCE" || marker === "$EACH") {
      each = marker === "$EACH";
      section = null;
      continue;
    }
    if (section === null) {
      section = { each, parts: [] };
      sections.push(section);
      lineCount = 0;
    }
    if (lineCount > 0) {
      const last = section.parts[section.parts.length - 1];
      if (last?.type === "text") last.value += "\n";
      else section.parts.push({ type: "text", value: "\n" });
    }
    compileLine(line.text, line.offset, each, section.parts);
    lineCount++;
  }

  return { sections };
}
