export type ParseOptions = {
  delimiter: string;
  hasHeader: boolean;
  trim: boolean;
};

export type ParsedData = {
  headers: string[] | null;
  rows: string[][];
  minColumns: number;
  maxColumns: number;
  warning: string | null;
};

const QUOTE = 34;
const LF = 10;
const CR = 13;
const SPACE = 32;
const TAB = 9;

export function parseDelimited(
  text: string,
  options: ParseOptions,
): ParsedData {
  const delimiter = options.delimiter || ",";
  const first = delimiter.charCodeAt(0);
  const single = delimiter.length === 1;
  const width = delimiter.length;
  const trim = options.trim;
  const length = text.length;

  const rows: string[][] = [];
  let headers: string[] | null = null;
  let minColumns = Infinity;
  let maxColumns = 0;
  let warning: string | null = null;

  const atDelimiter = (at: number) =>
    text.charCodeAt(at) === first && (single || text.startsWith(delimiter, at));

  let row: string[] = [];
  let firstQuoted = false;

  const endRow = () => {
    const current = row;
    row = [];
    if (current.length === 1 && !firstQuoted && current[0].trim() === "") {
      return;
    }
    if (options.hasHeader && headers === null) {
      headers = current;
      return;
    }
    rows.push(current);
    if (current.length < minColumns) minColumns = current.length;
    if (current.length > maxColumns) maxColumns = current.length;
  };

  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;

  while (i <= length) {
    let p = i;
    if (trim) {
      while (p < length) {
        const code = text.charCodeAt(p);
        if ((code !== SPACE && code !== TAB) || atDelimiter(p)) break;
        p++;
      }
    }

    let value: string;
    let quoted = false;
    if (p < length && text.charCodeAt(p) === QUOTE) {
      quoted = true;
      p++;
      let content = "";
      let segment = p;
      let closed = false;
      while (p < length) {
        const quote = text.indexOf('"', p);
        if (quote === -1) break;
        if (text.charCodeAt(quote + 1) === QUOTE) {
          content += text.slice(segment, quote + 1);
          p = quote + 2;
          segment = p;
          continue;
        }
        content += text.slice(segment, quote);
        p = quote + 1;
        closed = true;
        break;
      }
      if (!closed) {
        content += text.slice(segment, length);
        p = length;
        if (warning === null) {
          const where =
            options.hasHeader && headers === null
              ? "The header row"
              : `Row ${rows.length + 1}`;
          warning = `${where} opens a quote that never closes, so the rest of the data was read as one field.`;
        }
      }
      const restStart = p;
      while (p < length) {
        const code = text.charCodeAt(p);
        if (code === LF || code === CR || atDelimiter(p)) break;
        p++;
      }
      const rest = text.slice(restStart, p);
      value = content + (trim ? rest.trim() : rest);
    } else {
      const start = p;
      while (p < length) {
        const code = text.charCodeAt(p);
        if (code === LF || code === CR || atDelimiter(p)) break;
        p++;
      }
      value = text.slice(start, p);
      if (trim) value = value.trim();
    }

    if (row.length === 0) firstQuoted = quoted;
    row.push(value);

    if (p >= length) {
      endRow();
      break;
    }
    if (atDelimiter(p)) {
      i = p + width;
      continue;
    }
    p += text.charCodeAt(p) === CR && text.charCodeAt(p + 1) === LF ? 2 : 1;
    endRow();
    i = p;
    if (i >= length) break;
  }

  return {
    headers,
    rows,
    minColumns: rows.length === 0 ? 0 : minColumns,
    maxColumns,
    warning,
  };
}
