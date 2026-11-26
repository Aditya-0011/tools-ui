import { describe, expect, test } from "bun:test";

import { StencilError } from "@/lib/stencil/errors";
import { parseDelimited } from "@/lib/stencil/parse";
import { compilePattern } from "@/lib/stencil/pattern";
import { renderProgram } from "@/lib/stencil/render";
import {
  compileIssue,
  countLines,
  createRunner,
  previewOf,
  utf8Length,
} from "@/lib/stencil/run";

function render(
  pattern: string,
  data: string,
  options: { delimiter?: string; hasHeader?: boolean; trim?: boolean } = {},
) {
  const parsed = parseDelimited(data, {
    delimiter: options.delimiter ?? ",",
    hasHeader: options.hasHeader ?? false,
    trim: options.trim ?? false,
  });
  return renderProgram(compilePattern(pattern), parsed);
}

function failure(run: () => unknown): StencilError {
  try {
    run();
  } catch (error) {
    if (error instanceof StencilError) return error;
    throw error;
  }
  throw new Error("expected a StencilError");
}

describe("placeholders", () => {
  test("$0..$n by index", () => {
    expect(render("$1-$0", "a,b\nc,d")).toBe("b-a\nd-c");
  });

  test("digits are greedy", () => {
    const row = Array.from({ length: 13 }, (_, i) => `c${i}`).join(",");
    expect(render("$12|$1 2", row)).toBe("c12|c1 2");
  });

  test("${index} lets a digit follow a column", () => {
    expect(render("${1}2", "a,b")).toBe("b2");
  });

  test("$$ is a literal dollar", () => {
    expect(render("$$$0 costs $$5", "9")).toBe("$9 costs $5");
    expect(render("$$ROW", "x")).toBe("$ROW");
  });

  test("a lone or unknown $ stays literal", () => {
    expect(render("a $ b $x $", "1")).toBe("a $ b $x $");
  });

  test("$ROW, $ROWNUM and $COUNT", () => {
    expect(render("$ROW/$ROWNUM/$COUNT:$0", "a\nb\nc")).toBe(
      "0/1/3:a\n1/2/3:b\n2/3/3:c",
    );
  });

  test("$ROWNUMBER reads as $ROWNUM followed by text", () => {
    expect(render("$ROWNUMBER", "a")).toBe("1BER");
  });

  test("keywords are case-sensitive", () => {
    expect(render("$row $Count", "a")).toBe("$row $Count");
  });

  test("header names match case-insensitively and trimmed", () => {
    const data = " Id , Full Name \n1,Ann\n2,Bo";
    expect(
      render("${id}:${ full name }:${FULL NAME}", data, { hasHeader: true }),
    ).toBe("1:Ann:Ann\n2:Bo:Bo");
  });

  test("the first of duplicate header names wins", () => {
    expect(render("${a}", "a,a\n1,2", { hasHeader: true })).toBe("1");
  });

  test("${0} is always an index even with a header", () => {
    expect(render("${0}", "0,x\nv,w", { hasHeader: true })).toBe("v");
  });

  test("multi-line per-row pattern", () => {
    expect(render("<li>\n  $0\n</li>", "a\nb")).toBe(
      "<li>\n  a\n</li>\n<li>\n  b\n</li>",
    );
  });

  test("a single trailing newline in the pattern is ignored", () => {
    expect(render("$0\n", "a\nb")).toBe("a\nb");
    expect(render("$0\n\n", "a\nb")).toBe("a\n\nb\n");
  });

  test("CRLF patterns produce LF output", () => {
    expect(render("$0\r\n-$1\r\n", "a,b")).toBe("a\n-b");
  });

  test("no rows renders nothing for a per-row pattern", () => {
    expect(render("$0", "")).toBe("");
  });
});

describe("functions", () => {
  test("upper, lower, trim, title", () => {
    expect(
      render(
        "${0|upper}|${0|lower}|${1|trim}|${2|title}",
        "MiXed,  pad  ,hello wORLD  again",
      ),
    ).toBe("MIXED|mixed|pad|Hello World  Again");
  });

  test("function names are case-insensitive and chain left to right", () => {
    expect(render("${0|TRIM|Upper}", "  ab ")).toBe("AB");
    expect(render("${0|upper|lower}", "Ab")).toBe("ab");
  });

  test("replace, including escapes", () => {
    expect(render("${0|replace:-:_}", "a-b-c")).toBe("a_b_c");
    expect(render("${0|replace:-:}", "a-b")).toBe("ab");
    expect(render("${0|replace:\\::=}", "a:b")).toBe("a=b");
    expect(render("${0|replace:\\|:/}", "a|b", { delimiter: "," })).toBe("a/b");
    expect(render("${0|replace:x:\\}}", "axb")).toBe("a}b");
    expect(render("${0|replace:\\\\:/}", "a\\b")).toBe("a/b");
    expect(render("${0|replace: :%20}", "a b c")).toBe("a%20b%20c");
  });

  test("other backslashes are literal", () => {
    expect(render("${0|replace:a:\\n}", "cat")).toBe("c\\nt");
    expect(render("C:\\$0", "x")).toBe("C:\\x");
  });

  test("padleft and padright", () => {
    expect(render("${0|padleft:5:0}", "42")).toBe("00042");
    expect(render("${0|padleft:3}", "7")).toBe("  7");
    expect(render("[${0|padright:4}]", "ab")).toBe("[ab  ]");
    expect(render("${0|padright:4:.}", "abcdef")).toBe("abcdef");
    expect(render("${0|padleft:4:\\:}", "a")).toBe(":::a");
    expect(render("${0|padleft:3:*}", "😀")).toBe("**😀");
  });

  test("sqlquote doubles single quotes", () => {
    expect(render("'${0|sqlquote}'", "O'Brien's")).toBe("'O''Brien''s'");
  });

  test("jsonstr escapes without the quotes", () => {
    expect(render('"${0|jsonstr}"', '"say ""hi""\\ now"')).toBe(
      '"say \\"hi\\"\\\\ now"',
    );
    expect(render("${0|jsonstr}", '"a\nb\tc"')).toBe("a\\nb\\tc");
  });

  test("default fills empty fields only", () => {
    expect(render("${1|default:n/a}", "a,\nb,x")).toBe("n/a\nx");
    expect(render("${1|trim|default:none}", "a,   ")).toBe("none");
    expect(render("${1|default:}", "a,")).toBe("");
    expect(render("${1|default:12\\:00}", "a,")).toBe("12:00");
  });

  test("functions work with header names", () => {
    expect(render("${Name|upper}", "name\nann", { hasHeader: true })).toBe(
      "ANN",
    );
  });
});

describe("$ONCE and $EACH", () => {
  test("header and footer", () => {
    const pattern =
      "$ONCE\nINSERT INTO t VALUES\n$EACH\n('$0', '$1'),\n$ONCE\n-- $COUNT rows";
    expect(render(pattern, "a,b\nc,d")).toBe(
      "INSERT INTO t VALUES\n('a', 'b'),\n('c', 'd'),\n-- 2 rows",
    );
  });

  test("text before any marker is per-row", () => {
    expect(render("$0\n$ONCE\nend", "a\nb")).toBe("a\nb\nend");
  });

  test("markers may have surrounding spaces and CRLF", () => {
    expect(render("  $ONCE \r\n[\r\n$EACH\r\n$0,\r\n$ONCE\r\n]", "a")).toBe(
      "[\na,\n]",
    );
  });

  test("once sections still render with zero rows", () => {
    expect(render("$ONCE\n[\n$EACH\n$0\n$ONCE\n]", "")).toBe("[\n]");
  });

  test("empty sections are skipped", () => {
    expect(render("$ONCE\n$EACH\n$0", "a")).toBe("a");
  });

  test("a marker inside a line is literal text", () => {
    expect(render("x $ONCE y", "a")).toBe("x $ONCE y");
  });

  test("$COUNT works in once sections", () => {
    expect(render("$ONCE\nTotal: $COUNT", "a\nb\nc")).toBe("Total: 3");
  });

  test("columns and $ROW are rejected in once sections", () => {
    expect(failure(() => compilePattern("$ONCE\n$0")).kind).toBe("not-per-row");
    expect(failure(() => compilePattern("$ONCE\n$ROW")).kind).toBe(
      "not-per-row",
    );
    expect(failure(() => compilePattern("$ONCE\n$ROWNUM")).kind).toBe(
      "not-per-row",
    );
    expect(failure(() => compilePattern("$ONCE\n${name}")).message).toContain(
      "${name}",
    );
  });
});

describe("$SEP", () => {
  test("emits between rows but not after the last", () => {
    expect(render("$0$SEP{,}", "a\nb\nc")).toBe("a,\nb,\nc");
  });

  test("a single row gets no separator", () => {
    expect(render("[$0]$SEP{, }", "only")).toBe("[only]");
  });

  test("text is literal and supports escapes", () => {
    expect(render("$0$SEP{$1 \\} \\\\ \\n}", "a,b\nc,d")).toBe(
      "a$1 } \\ \\n\nc",
    );
    expect(render("$0$SEP{}", "a\nb")).toBe("a\nb");
  });

  test("works inside a JSON array", () => {
    const pattern = '$ONCE\n[\n$EACH\n  "${0|jsonstr}"$SEP{,}\n$ONCE\n]';
    expect(JSON.parse(render(pattern, 'x\n"y ""q"""'))).toEqual(["x", 'y "q"']);
    expect(render(pattern, "")).toBe("[\n]");
  });

  test("$SEP without { stays literal", () => {
    expect(render("$0 $SEP $SEPX", "a")).toBe("a $SEP $SEPX");
  });

  test("is an error in $ONCE sections", () => {
    const error = failure(() => compilePattern("$ONCE\n]$SEP{,}"));
    expect(error.kind).toBe("not-per-row");
    expect(error.message.startsWith("$SEP only works in per-row lines")).toBe(
      true,
    );
  });

  test("unclosed $SEP{", () => {
    const error = failure(() => compilePattern("$0$SEP{,"));
    expect(error.kind).toBe("unclosed-brace");
    expect(error.span).toEqual({ start: 2, end: 7 });
    expect(failure(() => compilePattern("$SEP{a\\}")).kind).toBe(
      "unclosed-brace",
    );
  });
});

describe("errors", () => {
  test("out of range names the row and its column count", () => {
    const error = failure(() => render("$0 $4", "a,b,c,d,e\nf,g\nh,i,j,k,l"));
    expect(error.kind).toBe("out-of-range");
    expect(error.row).toBe(2);
    expect(error.message).toBe(
      "Row 2 has 2 columns ($0–$1), but the pattern uses $4.",
    );
    expect(error.span).toEqual({ start: 3, end: 5 });
  });

  test("out of range for a single column row and a named column", () => {
    expect(failure(() => render("$1", "a")).message).toBe(
      "Row 1 has 1 column ($0), but the pattern uses $1.",
    );
    const named = failure(() =>
      render("${email}", "id,email\n1", { hasHeader: true }),
    );
    expect(named.message).toBe(
      "Row 1 has 1 column ($0), but the pattern uses ${email} (column $1).",
    );
  });

  test("row numbers count data rows after the header", () => {
    expect(
      failure(() => render("$2", "a,b,c\n1,2,3\n4,5", { hasHeader: true })).row,
    ).toBe(2);
  });

  test("unknown column name lists the columns", () => {
    const error = failure(() =>
      render("${mail}", "id,email\n1,x", { hasHeader: true }),
    );
    expect(error.kind).toBe("unknown-column");
    expect(error.message).toBe(
      "No column named “mail”. Columns: id ($0), email ($1).",
    );
  });

  test("column names need a header row", () => {
    const error = failure(() => render("${name}", "a"));
    expect(error.kind).toBe("header-required");
    expect(error.message).toContain("Header row");
  });

  test("unknown column is reported even with no data rows", () => {
    expect(failure(() => render("${x}", "id", { hasHeader: true })).kind).toBe(
      "unknown-column",
    );
  });

  test("unknown function with a suggestion", () => {
    const error = failure(() => compilePattern("ab ${0|uper}"));
    expect(error.kind).toBe("unknown-function");
    expect(error.message).toContain("“uper”");
    expect(error.message).toContain("Did you mean upper?");
    expect(error.span).toEqual({ start: 7, end: 11 });
  });

  test("empty function name", () => {
    expect(failure(() => compilePattern("${0|}")).kind).toBe(
      "unknown-function",
    );
  });

  test("bad function arguments", () => {
    const cases = [
      "${0|upper:x}",
      "${0|replace:a}",
      "${0|replace::b}",
      "${0|replace:a:b:c}",
      "${0|padleft}",
      "${0|padleft:x}",
      "${0|padleft:-1}",
      "${0|padleft:3:ab}",
      "${0|padleft:3:}",
      "${0|padright:99999}",
      "${0|default}",
      "${0|default:a:b}",
      "${0|sqlquote:1}",
      "${0|jsonstr:1}",
    ];
    for (const pattern of cases) {
      const error = failure(() => compilePattern(pattern));
      expect(error.kind).toBe("bad-arguments");
      expect(error.message).toContain("Usage:");
    }
  });

  test("unclosed ${", () => {
    const error = failure(() => compilePattern("ok\nx ${name|upper"));
    expect(error.kind).toBe("unclosed-brace");
    expect(error.span).toEqual({ start: 5, end: 7 });
  });

  test("${ does not close on a later line", () => {
    expect(failure(() => compilePattern("${name\n}")).kind).toBe(
      "unclosed-brace",
    );
  });

  test("an escaped brace does not close", () => {
    expect(failure(() => compilePattern("${0\\}")).kind).toBe("unclosed-brace");
  });

  test("empty ${}", () => {
    expect(failure(() => compilePattern("${ }")).kind).toBe("empty-column");
  });
});

describe("runner", () => {
  test("returns structured issues with line and column", () => {
    const run = createRunner();
    const result = run({
      data: "a,b",
      pattern: "first\n  ${0|nope}",
      delimiter: ",",
      hasHeader: false,
      trim: false,
    });
    expect(result.error).toMatchObject({
      kind: "unknown-function",
      line: 2,
      column: 7,
      lineText: "  ${0|nope}",
      row: null,
    });
    expect(result.output).toBe("");
    expect(result.rows).toBe(1);
  });

  test("render error carries the row", () => {
    const run = createRunner();
    const result = run({
      data: "a,b\nc",
      pattern: "$1",
      delimiter: ",",
      hasHeader: false,
      trim: false,
    });
    expect(result.error).toMatchObject({
      kind: "out-of-range",
      row: 2,
      line: 1,
      column: 1,
    });
  });

  test("reports counts and truncates the preview", () => {
    const run = createRunner();
    const data = Array.from({ length: 2500 }, (_, i) => `r${i}`).join("\n");
    const result = run({
      data,
      pattern: "$0",
      delimiter: ",",
      hasHeader: false,
      trim: false,
    });
    expect(result.lineCount).toBe(2500);
    expect(result.truncated).toBe(true);
    expect(countLines(result.preview)).toBe(2000);
    expect(result.output.endsWith("r2499")).toBe(true);
  });

  test("columns include the header width", () => {
    const run = createRunner();
    const result = run({
      data: "a,b,c\n1",
      pattern: "$0",
      delimiter: ",",
      hasHeader: true,
      trim: false,
    });
    expect(result).toMatchObject({
      rows: 1,
      minColumns: 1,
      maxColumns: 3,
      headers: ["a", "b", "c"],
    });
  });

  test("compileIssue reports syntax errors without data", () => {
    expect(compileIssue("$0 ${x|upper}")).toBeNull();
    expect(compileIssue("${x|nope}")).toMatchObject({
      kind: "unknown-function",
      line: 1,
      column: 5,
    });
  });

  test("an empty pattern renders nothing but still reports the data shape", () => {
    const result = createRunner()({
      data: "a,b\nc,d",
      pattern: "",
      delimiter: ",",
      hasHeader: false,
      trim: false,
    });
    expect(result).toMatchObject({
      output: "",
      lineCount: 0,
      rows: 2,
      maxColumns: 2,
      error: null,
    });
  });

  test("preview helpers", () => {
    expect(countLines("")).toBe(0);
    expect(countLines("a\nb\n")).toBe(3);
    expect(previewOf("a\nb\nc", 2)).toEqual({
      preview: "a\nb",
      truncated: true,
    });
    expect(previewOf("a\nb", 2)).toEqual({ preview: "a\nb", truncated: false });
    for (const text of ["", "abc", "é€", "😀x", "a\u00ffb"]) {
      expect(utf8Length(text)).toBe(new TextEncoder().encode(text).length);
    }
  });

  test("renders ~10 MB quickly", () => {
    const run = createRunner();
    const data =
      "id,name,email\n" + '42,"Doe, Jane",jane@example.com\n'.repeat(320_000);
    const started = performance.now();
    const result = run({
      data,
      pattern:
        "$ONCE\nINSERT INTO people (id, name) VALUES\n$EACH\n(${id}, '${name|sqlquote}'),",
      delimiter: ",",
      hasHeader: true,
      trim: false,
    });
    expect(result.error).toBeNull();
    expect(result.lineCount).toBe(320_001);
    expect(performance.now() - started).toBeLessThan(5000);
  });
});
