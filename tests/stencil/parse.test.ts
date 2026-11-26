import { describe, expect, test } from "bun:test";

import { parseDelimited } from "@/lib/stencil/parse";

const csv = { delimiter: ",", hasHeader: false, trim: false };

describe("parseDelimited", () => {
  test("splits simple rows and columns", () => {
    const data = parseDelimited("a,b,c\n1,2,3", csv);
    expect(data.rows).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
    expect(data.headers).toBeNull();
    expect(data.minColumns).toBe(3);
    expect(data.maxColumns).toBe(3);
  });

  test("handles CRLF, lone CR and a trailing newline", () => {
    expect(parseDelimited("a,b\r\nc,d\r\n", csv).rows).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
    expect(parseDelimited("a\rb", csv).rows).toEqual([["a"], ["b"]]);
  });

  test("skips blank and whitespace-only lines", () => {
    expect(parseDelimited("\n\na\n\n   \nb\n\n", csv).rows).toEqual([
      ["a"],
      ["b"],
    ]);
  });

  test("keeps empty fields, including a trailing one", () => {
    expect(parseDelimited("a,,c,", csv).rows).toEqual([["a", "", "c", ""]]);
    expect(parseDelimited(",", csv).rows).toEqual([["", ""]]);
  });

  test("quoted fields contain delimiters, doubled quotes and newlines", () => {
    const data = parseDelimited(
      '"a,b","say ""hi""","line1\nline2"\nx,y,z',
      csv,
    );
    expect(data.rows).toEqual([
      ["a,b", 'say "hi"', "line1\nline2"],
      ["x", "y", "z"],
    ]);
  });

  test("quoted CRLF newline is kept verbatim", () => {
    expect(parseDelimited('"a\r\nb",c', csv).rows).toEqual([["a\r\nb", "c"]]);
  });

  test("a quoted empty line is a row, not a blank line", () => {
    expect(parseDelimited('a\n""\nb', csv).rows).toEqual([["a"], [""], ["b"]]);
  });

  test("quotes in the middle of a field are literal", () => {
    expect(parseDelimited('5" pipe,x', csv).rows).toEqual([['5" pipe', "x"]]);
  });

  test("text after a closing quote is appended", () => {
    expect(parseDelimited('"a"b,c', csv).rows).toEqual([["ab", "c"]]);
  });

  test("an unclosed quote reads to the end and warns with the row", () => {
    const data = parseDelimited('x,y\n"open,still\nmore', csv);
    expect(data.rows).toEqual([["x", "y"], ["open,still\nmore"]]);
    expect(data.warning).toContain("Row 2");
  });

  test("strips a byte order mark", () => {
    expect(
      parseDelimited("﻿id,name", { ...csv, hasHeader: true }).headers,
    ).toEqual(["id", "name"]);
  });

  test("tab delimiter", () => {
    expect(
      parseDelimited("a\tb c\td\n1\t2\t3", { ...csv, delimiter: "\t" }).rows,
    ).toEqual([
      ["a", "b c", "d"],
      ["1", "2", "3"],
    ]);
  });

  test("custom multi-character delimiter", () => {
    const options = { ...csv, delimiter: "::" };
    expect(parseDelimited("a::b:c::d\n1::2", options).rows).toEqual([
      ["a", "b:c", "d"],
      ["1", "2"],
    ]);
    expect(parseDelimited('"x::y"::z', options).rows).toEqual([["x::y", "z"]]);
  });

  test("eight-character delimiter with overlapping prefix", () => {
    const options = { ...csv, delimiter: "<=><=><>" };
    expect(parseDelimited("a<=><=><>b<=>c", options).rows).toEqual([
      ["a", "b<=>c"],
    ]);
  });

  test("semicolon and pipe delimiters", () => {
    expect(parseDelimited("a;b,c", { ...csv, delimiter: ";" }).rows).toEqual([
      ["a", "b,c"],
    ]);
    expect(parseDelimited("a|b|c", { ...csv, delimiter: "|" }).rows).toEqual([
      ["a", "b", "c"],
    ]);
  });

  test("header row is taken from the first non-blank row", () => {
    const data = parseDelimited("\nid,name\n1,Ann\n2,Bo", {
      ...csv,
      hasHeader: true,
    });
    expect(data.headers).toEqual(["id", "name"]);
    expect(data.rows).toEqual([
      ["1", "Ann"],
      ["2", "Bo"],
    ]);
  });

  test("header only means zero rows", () => {
    const data = parseDelimited("id,name\n", { ...csv, hasHeader: true });
    expect(data.headers).toEqual(["id", "name"]);
    expect(data.rows).toEqual([]);
    expect(data.minColumns).toBe(0);
  });

  test("trim removes spaces around unquoted fields only", () => {
    const options = { ...csv, trim: true };
    expect(parseDelimited("  a , b  ,\tc\t", options).rows).toEqual([
      ["a", "b", "c"],
    ]);
    expect(parseDelimited('  "  keep  "  , x', options).rows).toEqual([
      ["  keep  ", "x"],
    ]);
  });

  test("without trim, spaces are kept and a leading space disables quoting", () => {
    expect(parseDelimited(' a , "b"', csv).rows).toEqual([[" a ", ' "b"']]);
  });

  test("trim with a tab delimiter keeps empty tab fields", () => {
    expect(
      parseDelimited("a\t\t b ", {
        delimiter: "\t",
        hasHeader: false,
        trim: true,
      }).rows,
    ).toEqual([["a", "", "b"]]);
  });

  test("reports varying column counts", () => {
    const data = parseDelimited("a,b,c\nd\ne,f", csv);
    expect(data.minColumns).toBe(1);
    expect(data.maxColumns).toBe(3);
  });

  test("empty input", () => {
    expect(parseDelimited("", csv)).toEqual({
      headers: null,
      rows: [],
      minColumns: 0,
      maxColumns: 0,
      warning: null,
    });
  });

  test("parses a large input quickly", () => {
    const line = 'id-123,"Doe, Jane",jane@example.com,"note with ""quotes"""\n';
    const text = line.repeat(160_000);
    const started = performance.now();
    const data = parseDelimited(text, csv);
    const elapsed = performance.now() - started;
    expect(text.length).toBeGreaterThan(9_000_000);
    expect(data.rows.length).toBe(160_000);
    expect(data.rows[42]).toEqual([
      "id-123",
      "Doe, Jane",
      "jane@example.com",
      'note with "quotes"',
    ]);
    expect(elapsed).toBeLessThan(3000);
  });
});
