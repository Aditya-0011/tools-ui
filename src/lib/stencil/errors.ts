export type StencilErrorKind =
  | "unclosed-brace"
  | "empty-column"
  | "unknown-function"
  | "bad-arguments"
  | "unknown-column"
  | "header-required"
  | "not-per-row"
  | "out-of-range"
  | "output-too-large";

export type Span = { start: number; end: number };

export class StencilError extends Error {
  kind: StencilErrorKind;
  span: Span | null;
  row: number | null;

  constructor(
    kind: StencilErrorKind,
    message: string,
    span: Span | null = null,
    row: number | null = null,
  ) {
    super(message);
    this.name = "StencilError";
    this.kind = kind;
    this.span = span;
    this.row = row;
  }
}

export type Issue = {
  kind: StencilErrorKind;
  message: string;
  row: number | null;
  start: number | null;
  end: number | null;
  line: number | null;
  column: number | null;
  lineText: string | null;
};

export function toIssue(error: StencilError, pattern: string): Issue {
  if (!error.span) {
    return {
      kind: error.kind,
      message: error.message,
      row: error.row,
      start: null,
      end: null,
      line: null,
      column: null,
      lineText: null,
    };
  }
  const { start, end } = error.span;
  const lineStart = pattern.lastIndexOf("\n", start - 1) + 1;
  let lineEnd = pattern.indexOf("\n", start);
  if (lineEnd === -1) lineEnd = pattern.length;
  let line = 1;
  for (let i = pattern.indexOf("\n"); i !== -1 && i < start;) {
    line++;
    i = pattern.indexOf("\n", i + 1);
  }
  return {
    kind: error.kind,
    message: error.message,
    row: error.row,
    start,
    end,
    line,
    column: start - lineStart + 1,
    lineText: pattern.slice(lineStart, lineEnd).replace(/\r$/, ""),
  };
}
