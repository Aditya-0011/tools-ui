import { describe, expect, test } from "bun:test";

import { createRunner } from "@/lib/stencil/run";

type Example = {
  id: string;
  label: string;
  summary: string;
  data: string;
  pattern: string;
  delimiter: string;
  hasHeader: boolean;
  trim: boolean;
};

const EXAMPLES: Example[] = [
  {
    id: "sql",
    label: "SQL INSERT",
    summary:
      "One multi-row INSERT: sqlquote escapes quotes, $SEP{,} puts commas between rows.",
    data: "id,name,email\n1,Ann O'Neil,ANN@example.com\n2,Bob Stone, bob@example.com \n3,Chloé Ruiz,chloe@example.com",
    pattern:
      "$ONCE\nINSERT INTO customers (id, name, email) VALUES\n$EACH\n  (${id}, '${name|sqlquote}', '${email|trim|lower}')$SEP{,}\n$ONCE\n;",
    delimiter: ",",
    hasHeader: true,
    trim: false,
  },
  {
    id: "json",
    label: "JSON array",
    summary:
      "Valid JSON: jsonstr escapes text, $ONCE adds the brackets, $SEP{,} skips the last comma.",
    data: 'name,quote\nAda,"Say ""hello"", then\nwave"\nLinus,Talk is cheap\\show code',
    pattern:
      '$ONCE\n[\n$EACH\n  { "id": $ROWNUM, "name": "${name|jsonstr}", "quote": "${quote|jsonstr}" }$SEP{,}\n$ONCE\n]',
    delimiter: ",",
    hasHeader: true,
    trim: false,
  },
  {
    id: "markdown",
    label: "Markdown table",
    summary:
      "A table header once, then one row per line, with title case and a default.",
    data: "name;role;start\nmaria lopez;Design;2026-01-12\nKEN ITO;Engineering;\njo baker;Support;2026-03-02",
    pattern:
      "$ONCE\n| # | Name | Role | Start date |\n| --- | --- | --- | --- |\n$EACH\n| $ROWNUM | ${name|title} | ${role} | ${start|default:TBD} |",
    delimiter: ";",
    hasHeader: true,
    trim: true,
  },
  {
    id: "html",
    label: "HTML list",
    summary: "Wrap rows in a <ul>, trimming the link before use.",
    data: "Docs | https://example.com/docs \nPricing | https://example.com/pricing\nBlog | https://example.com/blog",
    pattern: '$ONCE\n<ul>\n$EACH\n  <li><a href="$1">$0</a></li>\n$ONCE\n</ul>',
    delimiter: "|",
    hasHeader: false,
    trim: true,
  },
  {
    id: "shell",
    label: "Rename files",
    summary: "Tab-separated data into mv commands with lower case and replace.",
    data: "IMG_0412.JPG\tBeach Sunset\nIMG_0413.JPG\tOld Town Square\nIMG_0420.JPG\tHarbour At Night",
    pattern: 'mv -n -- "$0" "${1|lower|replace: :-}-$ROWNUM.jpg"',
    delimiter: "\t",
    hasHeader: false,
    trim: false,
  },
  {
    id: "names",
    label: "Header names",
    summary:
      "Use ${column name} with padding and replace; header names ignore case.",
    data: "SKU::Product name::Qty::Price\n7::Desk lamp::3::24,90\n12::Monitor arm::::89,00\n305::USB-C hub::12::39,50",
    pattern:
      "${sku|padleft:5:0}  ${PRODUCT NAME|padright:12}  qty ${qty|default:0|padleft:3}  € ${price|replace:,:.}",
    delimiter: "::",
    hasHeader: true,
    trim: false,
  },
];

describe("fixtures", () => {
  for (const example of EXAMPLES) {
    test(`${example.label} renders without errors`, () => {
      const result = createRunner()(example);
      expect(result.error).toBeNull();
      expect(result.rows).toBeGreaterThan(0);
      expect(result.output.length).toBeGreaterThan(0);
    });
  }

  test("SQL example escapes quotes and trims emails", () => {
    const result = createRunner()(EXAMPLES.find((e) => e.id === "sql")!);
    expect(result.output).toContain("'Ann O''Neil', 'ann@example.com'");
    expect(result.output).toContain("'bob@example.com'");
    expect(result.output).toBe(
      "INSERT INTO customers (id, name, email) VALUES\n" +
        "  (1, 'Ann O''Neil', 'ann@example.com'),\n" +
        "  (2, 'Bob Stone', 'bob@example.com'),\n" +
        "  (3, 'Chloé Ruiz', 'chloe@example.com')\n" +
        ";",
    );
  });

  test("JSON example keeps embedded newlines escaped", () => {
    const result = createRunner()(EXAMPLES.find((e) => e.id === "json")!);
    expect(result.output).toContain('"quote": "Say \\"hello\\", then\\nwave"');
    expect(result.output).toContain("Talk is cheap\\\\show code");
    const parsed = JSON.parse(result.output) as { id: number; quote: string }[];
    expect(parsed).toEqual([
      { id: 1, name: "Ada", quote: 'Say "hello", then\nwave' },
      { id: 2, name: "Linus", quote: "Talk is cheap\\show code" },
    ]);
  });

  test("header names example uses the custom delimiter", () => {
    const result = createRunner()(EXAMPLES.find((e) => e.id === "names")!);
    expect(result.output.split("\n")[1]).toBe(
      "00012  Monitor arm   qty   0  € 89.00",
    );
  });
});
